import { existsSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { loadConfig } from '../config/loader.js';
import { filterVarsForTarget, describeFilter } from '../core/filter.js';
import { interpolateVars } from '../core/interpolate.js';
import { maskVars, formatMaskedVar } from '../core/mask.js';
import { mergeVars } from '../core/merge.js';
import { parseEnvContent } from '../core/parse.js';
import { decrypt as sopsDecrypt } from '../core/sops.js';
import type { EnvVar, Environment } from '../types.js';

export interface InspectOptions {
  root: string;
  env: Environment;
}

export async function inspectCommand(options: InspectOptions): Promise<void> {
  const { root, env } = options;
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
    console.error(pc.red('No encrypted files found'));
    console.error(pc.dim(`Expected: ${sharedEncrypted}`));
    process.exit(1);
  }

  const merged = mergeVars(...varSources);
  const interpolated = interpolateVars(merged);
  const masked = maskVars(interpolated);

  const maxKeyLen = Math.max(...masked.map(v => v.key.length));

  console.log(pc.blue(`\nSecrets for ${env}:\n`));

  for (const v of masked) {
    const line = formatMaskedVar(v, maxKeyLen);
    console.log(`  ${v.isSet ? pc.green(v.key.padEnd(maxKeyLen)) : pc.yellow(v.key.padEnd(maxKeyLen))} = ${v.isSet ? pc.dim(v.masked + ` (${v.length} chars)`) : pc.yellow('(not set)')}`);
  }

  console.log(pc.dim(`\nTotal: ${masked.length} variables\n`));

  console.log(pc.blue('Target distribution:\n'));

  for (const target of config.targets) {
    const filtered = filterVarsForTarget(interpolated, target);
    const filter = describeFilter(target);
    
    console.log(`  ${pc.cyan(target.name)} ${pc.dim(`(${target.path}/)`)} - ${filtered.length} vars`);
    if (filter !== 'all vars') {
      console.log(`    ${pc.dim(filter)}`);
    }
  }

  console.log('');
}
