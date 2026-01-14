import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { discoverPackages } from '../core/discover.js';
import {
  expandVariables,
  getVarsForEnvironment,
  parseEnvContent,
} from '../core/parse.js';
import { decrypt as sopsDecrypt } from '../core/sops.js';
import type { EnvVar } from '../types.js';

interface PushOptions {
  root: string;
  dryRun?: boolean;
}

/**
 * Filter variables that should be pushed to Wrangler
 * Excludes EXPO_PUBLIC_* vars
 */
function getWranglerVars(vars: EnvVar[]): EnvVar[] {
  return vars.filter((v) => !v.key.startsWith('EXPO_PUBLIC_'));
}

/**
 * Push a secret to Wrangler
 */
function pushSecret(
  key: string,
  value: string,
  wranglerDir: string,
  dryRun: boolean
): boolean {
  if (dryRun) {
    console.log(pc.dim(`  [dry-run] Would push: ${key}`));
    return true;
  }

  try {
    // Use echo to pipe the value to wrangler secret put
    // This avoids the interactive prompt
    execSync(`echo "${value}" | wrangler secret put ${key}`, {
      cwd: wranglerDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: '/bin/bash',
    });
    return true;
  } catch (error) {
    const err = error as { stderr?: string; message?: string };
    console.error(
      pc.red(`  Failed to push ${key}: ${err.stderr || err.message}`)
    );
    return false;
  }
}

/**
 * Push command - push production secrets to Cloudflare Workers
 */
export async function pushCommand(options: PushOptions): Promise<void> {
  const { root, dryRun = false } = options;

  const encryptedPath = join(root, '.env.encrypted');

  // Check encrypted file exists
  if (!existsSync(encryptedPath)) {
    console.error(pc.red(`Error: ${encryptedPath} not found`));
    process.exit(1);
  }

  // Find wrangler packages
  const packages = await discoverPackages(root);
  const wranglerPackages = packages.filter((p) => p.style === 'wrangler');

  if (wranglerPackages.length === 0) {
    console.error(pc.red('Error: No Wrangler packages found'));
    console.error(pc.dim('A Wrangler package must have a wrangler.toml file.'));
    process.exit(1);
  }

  console.log(pc.blue('Pushing secrets to Cloudflare Workers...'));
  if (dryRun) {
    console.log(pc.yellow('  (dry-run mode - no changes will be made)'));
  }

  // Decrypt and get production vars
  let decryptedContent: string;
  try {
    decryptedContent = sopsDecrypt(encryptedPath);
  } catch (error) {
    console.error(pc.red((error as Error).message));
    process.exit(1);
  }

  const allVars = parseEnvContent(decryptedContent);
  const prodVars = getVarsForEnvironment(allVars, 'prod');
  const expandedVars = expandVariables(prodVars);
  const wranglerVars = getWranglerVars(expandedVars);

  console.log(pc.dim(`  ${wranglerVars.length} secrets to push`));

  // Push to each wrangler package
  for (const pkg of wranglerPackages) {
    const pkgDir = pkg.path ? join(root, pkg.path) : root;
    console.log(pc.blue(`\n${pkg.path || '.'} (${pkg.name}):`));

    let successCount = 0;
    let failCount = 0;

    for (const v of wranglerVars) {
      const success = pushSecret(v.key, v.value, pkgDir, dryRun);
      if (success) {
        console.log(pc.green(`  ${v.key}`));
        successCount++;
      } else {
        failCount++;
      }
    }

    console.log(pc.dim(`  ${successCount} pushed, ${failCount} failed`));
  }

  if (dryRun) {
    console.log(pc.yellow('\n[dry-run] No secrets were actually pushed.'));
    console.log(pc.dim('Run without --dry-run to push secrets.'));
  } else {
    console.log(pc.green('\nPush complete'));
  }
}
