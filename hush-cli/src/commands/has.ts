import { join } from 'node:path';
import pc from 'picocolors';
import { interpolateVars } from '../core/interpolate.js';
import { mergeVars } from '../core/merge.js';
import { parseEnvContent } from '../core/parse.js';
import type { EnvVar, Environment, HushContext } from '../types.js';

export interface HasOptions {
  root: string;
  env: Environment;
  key: string;
  quiet: boolean;
}

export async function hasCommand(ctx: HushContext, options: HasOptions): Promise<void> {
  const { root, env, key, quiet } = options;
  const config = ctx.config.loadConfig(root);

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
    if (!quiet) {
      ctx.logger.error(pc.red('No encrypted files found'));
    }
    ctx.process.exit(2);
  }

  const merged = mergeVars(...varSources);
  const interpolated = interpolateVars(merged);

  const found = interpolated.find(v => v.key === key);
  const exists = found !== undefined && found.value.length > 0;

  if (!quiet) {
    if (exists) {
      ctx.logger.log(pc.green(`${key} is set (${found!.value.length} chars)`));
    } else if (found) {
      ctx.logger.log(pc.yellow(`${key} exists but is empty`));
    } else {
      ctx.logger.log(pc.red(`${key} not found`));
    }
  }

  ctx.process.exit(exists ? 0 : 1);
}
