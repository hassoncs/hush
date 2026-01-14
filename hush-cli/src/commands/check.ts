import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import pc from 'picocolors';
import { loadConfig, findConfigPath } from '../config/loader.js';
import { parseEnvContent } from '../core/parse.js';
import { decrypt as sopsDecrypt, isSopsInstalled } from '../core/sops.js';
import { computeDiff, isInSync } from '../lib/diff.js';
import type { CheckOptions, CheckFileResult, CheckResult, HushConfig } from '../types.js';

interface SourceEncryptedPair {
  source: string;
  encrypted: string;
  sourceKey: 'shared' | 'development' | 'production';
}

function getSourceEncryptedPairs(config: HushConfig): SourceEncryptedPair[] {
  const pairs: SourceEncryptedPair[] = [];
  
  if (config.sources.shared) {
    pairs.push({
      source: config.sources.shared,
      encrypted: config.sources.shared + '.encrypted',
      sourceKey: 'shared',
    });
  }
  if (config.sources.development) {
    pairs.push({
      source: config.sources.development,
      encrypted: config.sources.development + '.encrypted',
      sourceKey: 'development',
    });
  }
  if (config.sources.production) {
    pairs.push({
      source: config.sources.production,
      encrypted: config.sources.production + '.encrypted',
      sourceKey: 'production',
    });
  }
  
  return pairs;
}

function getGitChangedFiles(root: string): Set<string> {
  try {
    const staged = execSync('git diff --cached --name-only', { cwd: root, encoding: 'utf-8' });
    const unstaged = execSync('git diff --name-only', { cwd: root, encoding: 'utf-8' });
    const files = [...staged.split('\n'), ...unstaged.split('\n')].filter(Boolean);
    return new Set(files);
  } catch {
    return new Set();
  }
}

export async function check(options: CheckOptions): Promise<CheckResult> {
  const { root, requireSource, onlyChanged } = options;

  if (!isSopsInstalled()) {
    return {
      status: 'error',
      files: [{
        source: '',
        encrypted: '',
        inSync: false,
        added: [],
        removed: [],
        changed: [],
        error: 'SOPS_NOT_INSTALLED',
      }],
    };
  }

  const configPath = findConfigPath(root);
  if (!configPath) {
    const config = loadConfig(root);
    const pairs = getSourceEncryptedPairs(config);
    return checkPairs(root, pairs, requireSource, onlyChanged);
  }

  const config = loadConfig(root);
  const pairs = getSourceEncryptedPairs(config);
  return checkPairs(root, pairs, requireSource, onlyChanged);
}

function checkPairs(
  root: string,
  pairs: SourceEncryptedPair[],
  requireSource: boolean,
  onlyChanged: boolean
): CheckResult {
  const changedFiles = onlyChanged ? getGitChangedFiles(root) : null;
  const results: CheckFileResult[] = [];

  for (const { source, encrypted } of pairs) {
    const sourcePath = join(root, source);
    const encryptedPath = join(root, encrypted);

    if (onlyChanged && changedFiles) {
      const isSourceChanged = changedFiles.has(source);
      const isEncryptedChanged = changedFiles.has(encrypted);
      if (!isSourceChanged && !isEncryptedChanged) {
        continue;
      }
    }

    if (!existsSync(sourcePath)) {
      if (requireSource) {
        results.push({
          source,
          encrypted,
          inSync: false,
          added: [],
          removed: [],
          changed: [],
          error: 'SOURCE_MISSING',
        });
      }
      continue;
    }

    if (!existsSync(encryptedPath)) {
      const sourceContent = readFileSync(sourcePath, 'utf-8');
      const sourceVars = parseEnvContent(sourceContent);
      const allKeys = sourceVars.map(v => v.key);
      
      results.push({
        source,
        encrypted,
        inSync: false,
        added: allKeys,
        removed: [],
        changed: [],
        error: 'ENCRYPTED_MISSING',
      });
      continue;
    }

    try {
      const decryptedContent = sopsDecrypt(encryptedPath);
      const sourceContent = readFileSync(sourcePath, 'utf-8');
      
      const sourceVars = parseEnvContent(sourceContent);
      const encryptedVars = parseEnvContent(decryptedContent);
      
      const diff = computeDiff(sourceVars, encryptedVars);
      
      results.push({
        source,
        encrypted,
        inSync: isInSync(diff),
        added: diff.added,
        removed: diff.removed,
        changed: diff.changed,
      });
    } catch (error) {
      const err = error as Error;
      if (err.message.includes('No matching age key')) {
        results.push({
          source,
          encrypted,
          inSync: false,
          added: [],
          removed: [],
          changed: [],
          error: 'DECRYPT_FAILED',
        });
      } else {
        throw error;
      }
    }
  }

  const hasError = results.some(r => r.error === 'SOPS_NOT_INSTALLED' || r.error === 'DECRYPT_FAILED');
  const hasDrift = results.some(r => !r.inSync);

  let status: 'ok' | 'drift' | 'error';
  if (hasError) {
    status = 'error';
  } else if (hasDrift) {
    status = 'drift';
  } else {
    status = 'ok';
  }

  return { status, files: results };
}

function formatTextOutput(result: CheckResult): string {
  const lines: string[] = [];
  lines.push('Checking secrets...\n');

  for (const file of result.files) {
    if (file.error === 'SOPS_NOT_INSTALLED') {
      lines.push(pc.red('Error: SOPS is not installed'));
      lines.push(pc.dim('Run: brew install sops'));
      continue;
    }

    if (file.error === 'SOURCE_MISSING') {
      lines.push(pc.yellow(`Warning: ${file.source} not found (--require-source)`));
      continue;
    }

    lines.push(`${file.source} ${pc.dim('->')} ${file.encrypted}`);

    if (file.error === 'ENCRYPTED_MISSING') {
      lines.push(pc.yellow(`  Warning: ${file.encrypted} not found`));
      if (file.added.length > 0) {
        lines.push(`  ${pc.yellow('All keys need encryption:')} ${file.added.join(', ')}`);
      }
      continue;
    }

    if (file.error === 'DECRYPT_FAILED') {
      lines.push(pc.red(`  Error: Failed to decrypt ${file.encrypted}`));
      lines.push(pc.dim("  This usually means your age key doesn't match."));
      lines.push(pc.dim('  Check: ~/.config/sops/age/key.txt'));
      continue;
    }

    if (file.inSync) {
      lines.push(pc.green('  ✓ In sync'));
    } else {
      if (file.added.length > 0) {
        lines.push(`  ${pc.yellow('Added keys:')}   ${file.added.join(', ')}`);
      }
      if (file.removed.length > 0) {
        lines.push(`  ${pc.yellow('Removed keys:')} ${file.removed.join(', ')}`);
      }
      if (file.changed.length > 0) {
        lines.push(`  ${pc.yellow('Changed keys:')} ${file.changed.join(', ')}`);
      }
    }

    lines.push('');
  }

  const driftCount = result.files.filter(f => !f.inSync && !f.error).length;
  const errorCount = result.files.filter(f => f.error === 'ENCRYPTED_MISSING').length;
  const totalDrift = driftCount + errorCount;

  if (result.status === 'error') {
    const sopsError = result.files.find(f => f.error === 'SOPS_NOT_INSTALLED');
    if (sopsError) {
      return lines.join('\n');
    }
    lines.push(pc.red('✗ Errors occurred during check'));
  } else if (totalDrift > 0) {
    lines.push(pc.yellow(`✗ Drift detected in ${totalDrift} file(s)`));
    lines.push(pc.dim('Run: hush encrypt'));
  } else if (result.files.length > 0) {
    lines.push(pc.green('✓ All secrets in sync'));
  }

  return lines.join('\n');
}

function formatJsonOutput(result: CheckResult): string {
  return JSON.stringify(result, null, 2);
}

export async function checkCommand(options: CheckOptions): Promise<void> {
  const result = await check(options);

  if (!options.quiet) {
    if (options.json) {
      console.log(formatJsonOutput(result));
    } else {
      console.log(formatTextOutput(result));
    }
  }

  if (result.status === 'error') {
    const hasSopsError = result.files.some(f => f.error === 'SOPS_NOT_INSTALLED');
    const hasDecryptError = result.files.some(f => f.error === 'DECRYPT_FAILED');
    
    if (hasSopsError || hasDecryptError) {
      process.exit(3);
    }
    
    if (result.files.some(f => f.error === 'SOURCE_MISSING')) {
      process.exit(2);
    }
  }

  if (result.status === 'drift' && !options.warn) {
    process.exit(1);
  }

  process.exit(0);
}
