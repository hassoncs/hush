import { join } from 'node:path';
import pc from 'picocolors';
import { interpolateVars } from '../core/interpolate.js';
import { mergeVars } from '../core/merge.js';
import { parseEnvContent } from '../core/parse.js';
import type { EnvVar, ListOptions, HushContext } from '../types.js';

export async function listCommand(ctx: HushContext, options: ListOptions): Promise<void> {
  const { root, env } = options;
  const config = ctx.config.loadConfig(root);

  ctx.logger.log(pc.blue(`Variables for ${env}:\n`));

  const sharedEncrypted = join(root, config.sources.shared + '.encrypted');
  const envEncrypted = join(root, config.sources[env] + '.encrypted');

  const varSources: EnvVar[][] = [];

  if (ctx.fs.existsSync(sharedEncrypted)) {
    const content = ctx.sops.decrypt(sharedEncrypted);
    varSources.push(parseEnvContent(content));
  }

  if (ctx.fs.existsSync(envEncrypted)) {
    const content = ctx.sops.decrypt(envEncrypted);
    varSources.push(parseEnvContent(content));
  }

  if (varSources.length === 0) {
    ctx.logger.error(pc.red('No encrypted files found'));
    ctx.process.exit(1);
  }

  const merged = mergeVars(...varSources);
  const interpolated = interpolateVars(merged);

  for (const { key, value } of interpolated) {
    const displayValue = value.length > 50 ? value.slice(0, 47) + '...' : value;
    ctx.logger.log(`${pc.cyan(key)}=${pc.dim(displayValue)}`);
  }

  ctx.logger.log(pc.dim(`\nTotal: ${interpolated.length} variables`));
}
