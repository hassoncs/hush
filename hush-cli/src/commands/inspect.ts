import { fs } from '../lib/fs.js';
import { join } from 'node:path';
import pc from 'picocolors';

import { filterVarsForTarget, describeFilter } from '../core/filter.js';
import { interpolateVars } from '../core/interpolate.js';
import { maskVars, formatMaskedVar } from '../core/mask.js';
import { mergeVars } from '../core/merge.js';
import { parseEnvContent } from '../core/parse.js';

import type { EnvVar, Environment, HushContext } from '../types.js';

export interface InspectOptions {
  root: string;
  env: Environment;
}

export async function inspectCommand(ctx: HushContext, options: InspectOptions): Promise<void> {
  const { root, env } = options;
  const config = ctx.config.loadConfig(root);

  const sharedEncrypted = join(root, config.sources.shared + '.encrypted');
  const envEncrypted = join(root, config.sources[env] + '.encrypted');

  const varSources: EnvVar[][] = [];

  if (fs.existsSync(sharedEncrypted)) {
    const content = ctx.sops.decrypt(sharedEncrypted);
    varSources.push(parseEnvContent(content));
  }

  if (fs.existsSync(envEncrypted)) {
    const content = ctx.sops.decrypt(envEncrypted);
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

  ctx.logger.log(pc.blue(`\nSecrets for ${env}:\n`));

  for (const v of masked) {
    const line = formatMaskedVar(v, maxKeyLen);
    ctx.logger.log(`  ${v.isSet ? pc.green(v.key.padEnd(maxKeyLen)) : pc.yellow(v.key.padEnd(maxKeyLen))} = ${v.isSet ? pc.dim(v.masked + ` (${v.length} chars)`) : pc.yellow('(not set)')}`);
  }

  ctx.logger.log(pc.dim(`\nTotal: ${masked.length} variables\n`));

  ctx.logger.log(pc.blue('Target distribution:\n'));

  for (const target of config.targets) {
    const filtered = filterVarsForTarget(interpolated, target);
    const filter = describeFilter(target);
    
    ctx.logger.log(`  ${pc.cyan(target.name)} ${pc.dim(`(${target.path}/)`)} - ${filtered.length} vars`);
    if (filter !== 'all vars') {
      ctx.logger.log(`    ${pc.dim(filter)}`);
    }
  }

  ctx.logger.log('');
}
