import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { loadConfig } from '../config/loader.js';
import { filterVarsForTarget } from '../core/filter.js';
import { interpolateVars } from '../core/interpolate.js';
import { mergeVars } from '../core/merge.js';
import { parseEnvContent } from '../core/parse.js';
import { decrypt as sopsDecrypt } from '../core/sops.js';
import type { EnvVar, PushOptions } from '../types.js';

function pushSecret(key: string, value: string, targetDir: string, dryRun: boolean): boolean {
  if (dryRun) {
    console.log(pc.dim(`    [dry-run] ${key}`));
    return true;
  }

  try {
    execSync(`echo "${value}" | wrangler secret put ${key}`, {
      cwd: targetDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: '/bin/bash',
    });
    return true;
  } catch (error) {
    const err = error as { stderr?: string; message?: string };
    console.error(pc.red(`    Failed: ${key} - ${err.stderr || err.message}`));
    return false;
  }
}

export async function pushCommand(options: PushOptions): Promise<void> {
  const { root, dryRun } = options;
  const config = loadConfig(root);

  console.log(pc.blue('Pushing production secrets to Cloudflare Workers...'));
  if (dryRun) {
    console.log(pc.yellow('(dry-run mode)'));
  }

  const sharedEncrypted = join(root, config.sources.shared + '.encrypted');
  const prodEncrypted = join(root, config.sources.production + '.encrypted');

  const varSources: EnvVar[][] = [];

  if (existsSync(sharedEncrypted)) {
    const content = sopsDecrypt(sharedEncrypted);
    varSources.push(parseEnvContent(content));
  }

  if (existsSync(prodEncrypted)) {
    const content = sopsDecrypt(prodEncrypted);
    varSources.push(parseEnvContent(content));
  }

  if (varSources.length === 0) {
    console.error(pc.red('No encrypted files found'));
    process.exit(1);
  }

  const merged = mergeVars(...varSources);
  const interpolated = interpolateVars(merged);

  const wranglerTargets = config.targets.filter(t => t.format === 'wrangler');

  if (wranglerTargets.length === 0) {
    console.error(pc.red('No wrangler targets configured'));
    process.exit(1);
  }

  for (const target of wranglerTargets) {
    const targetDir = join(root, target.path);
    const filtered = filterVarsForTarget(interpolated, target);

    console.log(pc.blue(`\n${target.name} (${target.path}/)`));

    let success = 0;
    let failed = 0;

    for (const { key, value } of filtered) {
      if (pushSecret(key, value, targetDir, dryRun)) {
        if (!dryRun) console.log(pc.green(`    ${key}`));
        success++;
      } else {
        failed++;
      }
    }

    console.log(pc.dim(`  ${success} pushed, ${failed} failed`));
  }

  if (dryRun) {
    console.log(pc.yellow('\n[dry-run] No secrets were pushed'));
  } else {
    console.log(pc.green('\nPush complete'));
  }
}
