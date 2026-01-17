import { execSync } from 'node:child_process';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { loadConfig } from '../config/loader.js';
import { filterVarsForTarget } from '../core/filter.js';
import { interpolateVars } from '../core/interpolate.js';
import { mergeVars } from '../core/merge.js';
import { parseEnvContent } from '../core/parse.js';
import { decrypt as sopsDecrypt } from '../core/sops.js';
import { loadLocalTemplates, resolveTemplateVars } from '../core/template.js';
import type { EnvVar, PushOptions, Target, CloudflarePagesPushConfig } from '../types.js';

function pushWorkerSecret(key: string, value: string, targetDir: string, dryRun: boolean, verbose: boolean): boolean {
  if (dryRun) {
    if (verbose) {
      console.log(pc.green(`    + ${key}`));
    } else {
      console.log(pc.dim(`    [dry-run] ${key}`));
    }
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

function pushPagesSecrets(
  vars: EnvVar[],
  projectName: string,
  targetDir: string,
  dryRun: boolean,
  verbose: boolean
): { success: number; failed: number } {
  if (dryRun) {
    for (const { key } of vars) {
      if (verbose) {
        console.log(pc.green(`    + ${key}`));
      } else {
        console.log(pc.dim(`    [dry-run] ${key}`));
      }
    }
    return { success: vars.length, failed: 0 };
  }

  const secretsJson: Record<string, string> = {};
  for (const { key, value } of vars) {
    secretsJson[key] = value;
  }

  const tempFile = join(targetDir, '.hush-secrets-temp.json');
  try {
    writeFileSync(tempFile, JSON.stringify(secretsJson, null, 2));

    execSync(`wrangler pages secret bulk "${tempFile}" --project-name "${projectName}"`, {
      cwd: targetDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: '/bin/bash',
    });

    for (const { key } of vars) {
      console.log(pc.green(`    ${key}`));
    }

    return { success: vars.length, failed: 0 };
  } catch (error) {
    const err = error as { stderr?: Buffer | string; message?: string };
    const stderrStr = err.stderr instanceof Buffer ? err.stderr.toString() : (err.stderr || err.message || 'Unknown error');
    console.error(pc.red(`    Failed to push secrets: ${stderrStr}`));
    return { success: 0, failed: vars.length };
  } finally {
    if (existsSync(tempFile)) {
      unlinkSync(tempFile);
    }
  }
}

function getTargetsWithPush(config: { targets: Target[] }, targetFilter?: string): Target[] {
  const pushableTargets = config.targets.filter(t => {
    const hasPushConfig = t.push_to !== undefined;
    const isWranglerFormat = t.format === 'wrangler';
    return hasPushConfig || isWranglerFormat;
  });

  if (targetFilter) {
    const filtered = pushableTargets.filter(t => t.name === targetFilter);
    if (filtered.length === 0) {
      const availableTargets = pushableTargets.map(t => t.name).join(', ');
      throw new Error(
        `Target "${targetFilter}" not found or has no push configuration.\n` +
        `Available pushable targets: ${availableTargets || '(none)'}`
      );
    }
    return filtered;
  }

  return pushableTargets;
}

function getPushType(target: Target): 'cloudflare-workers' | 'cloudflare-pages' {
  if (target.push_to) {
    return target.push_to.type;
  }
  return 'cloudflare-workers';
}

function getPagesProject(target: Target): string {
  if (target.push_to?.type === 'cloudflare-pages') {
    return (target.push_to as CloudflarePagesPushConfig).project;
  }
  throw new Error(`Target "${target.name}" is not configured for Cloudflare Pages`);
}

export async function pushCommand(options: PushOptions): Promise<void> {
  const { root, dryRun, verbose, target: targetFilter } = options;
  const config = loadConfig(root);

  console.log(pc.blue('Pushing production secrets to Cloudflare...'));
  if (dryRun) {
    console.log(pc.yellow('(dry-run mode)'));
    if (verbose) {
      console.log(pc.dim('(verbose output enabled)'));
    }
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
  const rootSecretsRecord: Record<string, string> = {};
  for (const { key, value } of interpolated) {
    rootSecretsRecord[key] = value;
  }

  let pushableTargets: Target[];
  try {
    pushableTargets = getTargetsWithPush(config, targetFilter);
  } catch (error) {
    console.error(pc.red((error as Error).message));
    process.exit(1);
  }

  if (pushableTargets.length === 0) {
    console.error(pc.red('No targets configured for push'));
    console.error(pc.dim('Add format: wrangler or push_to: { type: cloudflare-pages, project: ... } to a target'));
    process.exit(1);
  }

  for (const target of pushableTargets) {
    const targetDir = join(root, target.path);
    const pushType = getPushType(target);

    let filtered = filterVarsForTarget(interpolated, target);

    const localTemplate = loadLocalTemplates(targetDir, 'production');
    if (localTemplate.hasTemplate) {
      const templateVars = resolveTemplateVars(
        localTemplate.vars,
        rootSecretsRecord,
        { processEnv: process.env as Record<string, string> }
      );
      filtered = mergeVars(filtered, templateVars);
    }

    if (filtered.length === 0) {
      console.log(pc.dim(`\n${target.name} - no matching vars, skipped`));
      continue;
    }

    const typeLabel = pushType === 'cloudflare-pages' ? 'Pages' : 'Workers';

    if (dryRun && verbose) {
      console.log(pc.blue(`\n[DRY RUN] Would push to ${target.name} (${typeLabel}, ${target.path}/):`));
    } else {
      console.log(pc.blue(`\n${target.name} (${typeLabel}, ${target.path}/)`));
    }

    let success = 0;
    let failed = 0;

    if (pushType === 'cloudflare-pages') {
      const projectName = getPagesProject(target);
      const result = pushPagesSecrets(filtered, projectName, targetDir, dryRun, verbose);
      success = result.success;
      failed = result.failed;
    } else {
      for (const { key, value } of filtered) {
        if (pushWorkerSecret(key, value, targetDir, dryRun, verbose)) {
          if (!dryRun) console.log(pc.green(`    ${key}`));
          success++;
        } else {
          failed++;
        }
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
