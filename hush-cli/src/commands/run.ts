import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { loadConfig } from '../config/loader.js';
import { filterVarsForTarget } from '../core/filter.js';
import { interpolateVars, getUnresolvedVars } from '../core/interpolate.js';
import { mergeVars } from '../core/merge.js';
import { parseEnvContent } from '../core/parse.js';
import { decrypt as sopsDecrypt } from '../core/sops.js';
import type { RunOptions, EnvVar, HushConfig, Environment } from '../types.js';

function getEncryptedPath(sourcePath: string): string {
  return sourcePath + '.encrypted';
}

function getDecryptedSecrets(root: string, env: Environment, config: HushConfig): EnvVar[] {
  const sharedEncrypted = join(root, getEncryptedPath(config.sources.shared));
  const envEncrypted = join(root, getEncryptedPath(config.sources[env]));
  const localEncrypted = join(root, getEncryptedPath(config.sources.local));

  const varSources: EnvVar[][] = [];

  if (existsSync(sharedEncrypted)) {
    const content = sopsDecrypt(sharedEncrypted);
    varSources.push(parseEnvContent(content));
  }

  if (existsSync(envEncrypted)) {
    const content = sopsDecrypt(envEncrypted);
    varSources.push(parseEnvContent(content));
  }

  if (existsSync(localEncrypted)) {
    const content = sopsDecrypt(localEncrypted);
    varSources.push(parseEnvContent(content));
  }

  if (varSources.length === 0) {
    throw new Error(`No encrypted files found. Expected: ${sharedEncrypted}`);
  }

  const merged = mergeVars(...varSources);
  return interpolateVars(merged);
}

export async function runCommand(options: RunOptions): Promise<void> {
  const { root, env, target, command } = options;
  
  if (!command || command.length === 0) {
    console.error(pc.red('Usage: hush run -- <command>'));
    console.error(pc.dim('Example: hush run -- npm start'));
    console.error(pc.dim('         hush run -e production -- npm run build'));
    console.error(pc.dim('         hush run --target api -- wrangler dev'));
    process.exit(1);
  }

  const config = loadConfig(root);
  
  let vars = getDecryptedSecrets(root, env, config);

  if (target) {
    const targetConfig = config.targets.find(t => t.name === target);
    if (!targetConfig) {
      console.error(pc.red(`Target "${target}" not found in hush.yaml`));
      console.error(pc.dim(`Available targets: ${config.targets.map(t => t.name).join(', ')}`));
      process.exit(1);
    }
    vars = filterVarsForTarget(vars, targetConfig);

    if (targetConfig.format === 'wrangler') {
      vars.push({ key: 'CLOUDFLARE_INCLUDE_PROCESS_ENV', value: 'true' });

      const devVarsPath = join(targetConfig.path, '.dev.vars');
      const absDevVarsPath = join(root, devVarsPath);
      
      if (existsSync(absDevVarsPath)) {
        console.warn(pc.yellow('\n⚠️  Wrangler Conflict Detected'));
        console.warn(pc.yellow(`   Found .dev.vars in ${targetConfig.path}`));
        console.warn(pc.yellow('   Wrangler will IGNORE Hush secrets while this file exists.'));
        console.warn(pc.bold(`   Fix: rm ${devVarsPath}\n`));
      }
    }
  }

  const unresolved = getUnresolvedVars(vars);
  if (unresolved.length > 0) {
    console.warn(pc.yellow(`Warning: ${unresolved.length} vars have unresolved references`));
  }

  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ...Object.fromEntries(vars.map(v => [v.key, v.value])),
  };

  const [cmd, ...args] = command;
  
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: childEnv,
    shell: true,
    cwd: root,
  });

  if (result.error) {
    console.error(pc.red(`Failed to execute: ${result.error.message}`));
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}
