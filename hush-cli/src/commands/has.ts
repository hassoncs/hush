import { existsSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { loadConfig } from '../config/loader.js';
import { interpolateVars } from '../core/interpolate.js';
import { mergeVars } from '../core/merge.js';
import { parseEnvContent } from '../core/parse.js';
import { decrypt as sopsDecrypt } from '../core/sops.js';
import type { EnvVar, Environment } from '../types.js';

export interface HasOptions {
  root: string;
  env: Environment;
  key: string;
  quiet: boolean;
}

export async function hasCommand(options: HasOptions): Promise<void> {
  const { root, env, key, quiet } = options;
  const config = loadConfig(root);

  const sharedEncrypted = join(root, config.sources.shared + '.encrypted');
  const envEncrypted = join(root, config.sources[env] + '.encrypted');

  const varSources: EnvVar[][] = [];

  if (existsSync(sharedEncrypted)) {
    const content = sopsDecrypt(sharedEncrypted);
    varSources.push(parseEnvContent(content));
  }

  if (existsSync(envEncrypted)) {
    const content = sopsDecrypt(envEncrypted);
    varSources.push(parseEnvContent(content));
  }

  if (varSources.length === 0) {
    if (!quiet) {
      console.error(pc.red('No encrypted files found'));
    }
    process.exit(2);
  }

  const merged = mergeVars(...varSources);
  const interpolated = interpolateVars(merged);

  const found = interpolated.find(v => v.key === key);
  const exists = found !== undefined && found.value.length > 0;

  if (!quiet) {
    if (exists) {
      console.log(pc.green(`${key} is set (${found!.value.length} chars)`));
    } else if (found) {
      console.log(pc.yellow(`${key} exists but is empty`));
    } else {
      console.log(pc.red(`${key} not found`));
    }
  }

  process.exit(exists ? 0 : 1);
}
