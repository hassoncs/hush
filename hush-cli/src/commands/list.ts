import { existsSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { loadConfig } from '../config/loader.js';
import { interpolateVars } from '../core/interpolate.js';
import { mergeVars } from '../core/merge.js';
import { parseEnvContent } from '../core/parse.js';
import { decrypt as sopsDecrypt } from '../core/sops.js';
import type { EnvVar, ListOptions } from '../types.js';

export async function listCommand(options: ListOptions): Promise<void> {
  const { root, env } = options;
  const config = loadConfig(root);

  console.log(pc.blue(`Variables for ${env}:\n`));

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
    console.error(pc.red('No encrypted files found'));
    process.exit(1);
  }

  const merged = mergeVars(...varSources);
  const interpolated = interpolateVars(merged);

  for (const { key, value } of interpolated) {
    const displayValue = value.length > 50 ? value.slice(0, 47) + '...' : value;
    console.log(`${pc.cyan(key)}=${pc.dim(displayValue)}`);
  }

  console.log(pc.dim(`\nTotal: ${interpolated.length} variables`));
}
