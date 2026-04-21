import pc from 'picocolors';
import { appendCommandReadAudit, resolveTargetEnvView } from './v3-command-helpers.js';
import type { ListOptions, HushContext } from '../types.js';

export async function listCommand(ctx: HushContext, options: ListOptions): Promise<void> {
  try {
    const view = resolveTargetEnvView(ctx, options.store, undefined, {
      name: 'list',
      args: [],
    });

    appendCommandReadAudit(ctx, options.store, view, { name: 'list', args: [] });

    ctx.logger.log(pc.blue(`Variables for target ${view.targetName}:\n`));

    for (const { key, value } of view.envVars) {
      const displayValue = value.length > 50 ? `${value.slice(0, 47)}...` : value;
      ctx.logger.log(`${pc.cyan(key)}=${pc.dim(displayValue)}`);
    }

    ctx.logger.log(pc.dim(`\nTotal: ${view.envVars.length} variables`));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ctx.logger.error(pc.red(message));
    ctx.process.exit(1);
  }
}
