import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { findConfigPath, loadConfig } from '../config/loader.js';
import { describeFilter } from '../core/filter.js';
import { isAgeKeyConfigured, isSopsInstalled } from '../core/sops.js';
import { keyExists } from '../lib/age.js';
import { opInstalled } from '../lib/onepassword.js';
import type { StatusOptions } from '../types.js';
import { FORMAT_OUTPUT_FILES } from '../types.js';

function findRootPlaintextEnvFiles(root: string): string[] {
  const results: string[] = [];
  const plaintextPatterns = ['.env', '.env.development', '.env.production', '.env.local', '.env.staging', '.env.test', '.dev.vars'];

  for (const pattern of plaintextPatterns) {
    const filePath = join(root, pattern);
    if (existsSync(filePath)) {
      results.push(pattern);
    }
  }

  return results;
}

function getProjectFromConfig(root: string): string | null {
  const config = loadConfig(root);
  if (config.project) return config.project;

  const pkgPath = join(root, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(require('fs').readFileSync(pkgPath, 'utf-8'));
      if (typeof pkg.repository === 'string') {
        const match = pkg.repository.match(/github\.com[/:]([\w-]+\/[\w-]+)/);
        if (match) return match[1];
      }
      if (pkg.repository?.url) {
        const match = pkg.repository.url.match(/github\.com[/:]([\w-]+\/[\w-]+)/);
        if (match) return match[1];
      }
    } catch {
      return null;
    }
  }
  return null;
}

export async function statusCommand(options: StatusOptions): Promise<void> {
  const { root } = options;
  const config = loadConfig(root);
  const configPath = findConfigPath(root);

  console.log(pc.blue('Hush Status\n'));

  const plaintextFiles = findRootPlaintextEnvFiles(root);
  
  if (plaintextFiles.length > 0) {
    console.log(pc.bgRed(pc.white(pc.bold(' SECURITY WARNING '))));
    console.log(pc.red(pc.bold('\nUnencrypted .env files detected at project root!\n')));
    for (const file of plaintextFiles) {
      console.log(pc.red(`  ${file}`));
    }
    console.log('');
    console.log(pc.yellow('These files may expose secrets to AI assistants and version control.'));
    console.log(pc.bold('\nTo fix:'));
    console.log(pc.dim('  1. Run: npx hush encrypt'));
    console.log(pc.dim('  2. The plaintext files will be automatically deleted after encryption'));
    console.log(pc.dim('  3. Add to .gitignore: .env, .env.*, .dev.vars\n'));
  }

  console.log(pc.bold('Config:'));
  if (configPath) {
    console.log(pc.green(`  ${configPath.replace(root + '/', '')}`));
  } else {
    console.log(pc.dim('  No hush.yaml found (using defaults)'));
  }

  const project = getProjectFromConfig(root);
  if (configPath) {
    if (project) {
      console.log(pc.green(`  Project: ${project}`));
    } else {
      console.log(pc.yellow('  Project: not set'));
      console.log(pc.dim('    Add "project: my-org/my-repo" to hush.yaml for key management'));
    }
  }

  console.log(pc.bold('\nPrerequisites:'));
  console.log(
    isSopsInstalled()
      ? pc.green('  SOPS installed')
      : pc.red('  SOPS not installed (brew install sops)')
  );
  console.log(
    isAgeKeyConfigured()
      ? pc.green('  age key configured')
      : pc.yellow('  age key not found at ~/.config/sops/age/key.txt')
  );

  if (project) {
    const hasLocalKey = keyExists(project);

    console.log(pc.bold('\nKey Status:'));
    console.log(
      hasLocalKey
        ? pc.green(`  Local key: ~/.config/sops/age/keys/${project.replace(/\//g, '-')}.txt`)
        : pc.yellow('  Local key: not found')
    );

    if (opInstalled()) {
      console.log(pc.dim('  1Password CLI: installed'));
      console.log(pc.dim('    Run "npx hush keys list" to check backup status'));
    } else {
      console.log(pc.dim('  1Password CLI: not installed'));
    }

    if (!hasLocalKey) {
      console.log(pc.bold('\n  To set up keys:'));
      console.log(pc.dim('    npx hush keys setup   # Pull from 1Password or generate'));
    }
  }

  console.log(pc.bold('\nSource Files:'));
  const sources = [
    { key: 'shared', path: config.sources.shared },
    { key: 'development', path: config.sources.development },
    { key: 'production', path: config.sources.production },
  ];

  for (const { key, path } of sources) {
    const encryptedPath = join(root, path + '.encrypted');
    const exists = existsSync(encryptedPath);
    const label = `${path}.encrypted`;

    console.log(
      exists
        ? pc.green(`  ${label}`)
        : pc.dim(`  ${label} (not found)`)
    );
  }

  const localPath = join(root, '.env.local');
  console.log(
    existsSync(localPath)
      ? pc.green('  .env.local (overrides)')
      : pc.dim('  .env.local (optional, not found)')
  );

  console.log(pc.bold('\nTargets:'));
  for (const target of config.targets) {
    const filter = describeFilter(target);
    const devOutput = FORMAT_OUTPUT_FILES[target.format].development;
    console.log(
      `  ${pc.cyan(target.name)} ${pc.dim(target.path + '/')} ` +
      `${pc.magenta(target.format)} -> ${devOutput}`
    );
    if (filter !== 'all vars') {
      console.log(pc.dim(`    ${filter}`));
    }
  }

  console.log('');
}
