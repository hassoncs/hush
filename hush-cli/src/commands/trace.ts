import { join } from 'node:path';
import pc from 'picocolors';
import { parseEnvContent } from '../core/parse.js';
import type { Environment, Target, HushContext } from '../types.js';

export interface TraceOptions {
  root: string;
  env: Environment;
  key: string;
}

function matchesPattern(key: string, pattern: string): boolean {
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  return regex.test(key);
}

function matchesAnyPattern(key: string, patterns: string[]): string | null {
  for (const pattern of patterns) {
    if (matchesPattern(key, pattern)) {
      return pattern;
    }
  }
  return null;
}

type TargetDisposition = 
  | { status: 'included' }
  | { status: 'excluded'; reason: string }
  | { status: 'not_included'; reason: string };

function getTargetDisposition(key: string, target: Target): TargetDisposition {
  if (target.include && target.include.length > 0) {
    const matchedInclude = matchesAnyPattern(key, target.include);
    if (!matchedInclude) {
      return { status: 'not_included', reason: `not in include: ${target.include.join(', ')}` };
    }
  }

  if (target.exclude && target.exclude.length > 0) {
    const matchedExclude = matchesAnyPattern(key, target.exclude);
    if (matchedExclude) {
      return { status: 'excluded', reason: `matches exclude: ${matchedExclude}` };
    }
  }

  return { status: 'included' };
}

export async function traceCommand(ctx: HushContext, options: TraceOptions): Promise<void> {
  const { root, env, key } = options;
  const config = ctx.config.loadConfig(root);

  ctx.logger.log(pc.bold(`\nTracing variable: ${pc.cyan(key)}\n`));

  ctx.logger.log(pc.blue('Source Status:'));

  const sources: { name: string; path: string; found: boolean }[] = [
    { name: config.sources.shared, path: join(root, config.sources.shared + '.encrypted'), found: false },
    { name: config.sources.development, path: join(root, config.sources.development + '.encrypted'), found: false },
    { name: config.sources.production, path: join(root, config.sources.production + '.encrypted'), found: false },
    { name: config.sources.local, path: join(root, config.sources.local + '.encrypted'), found: false },
  ];

  const maxSourceLen = Math.max(...sources.map(s => s.name.length));

  for (const source of sources) {
    if (!ctx.fs.existsSync(source.path)) {
      ctx.logger.log(`  ${source.name.padEnd(maxSourceLen)} : ${pc.dim('(file not found)')}`);
      continue;
    }

    try {
      const content = ctx.sops.decrypt(source.path);
      const vars = parseEnvContent(content);
      const found = vars.some(v => v.key === key);
      source.found = found;

      if (found) {
        ctx.logger.log(`  ${source.name.padEnd(maxSourceLen)} : ${pc.green('✅ Present')}`);
      } else {
        ctx.logger.log(`  ${source.name.padEnd(maxSourceLen)} : ${pc.dim('❌ Not found')}`);
      }
    } catch {
      ctx.logger.log(`  ${source.name.padEnd(maxSourceLen)} : ${pc.red('⚠️  Decrypt failed')}`);
    }
  }

  const foundInAnySource = sources.some(s => s.found);

  ctx.logger.log(pc.blue(`\nTarget Disposition (Environment: ${env}):`));

  const maxTargetLen = Math.max(...config.targets.map(t => t.name.length));

  for (const target of config.targets) {
    const disposition = getTargetDisposition(key, target);

    const targetLabel = `[${target.name}]`.padEnd(maxTargetLen + 2);

    if (!foundInAnySource) {
      ctx.logger.log(`  ${targetLabel} : ${pc.yellow('⚠️  Variable not in any source')}`);
    } else if (disposition.status === 'included') {
      ctx.logger.log(`  ${targetLabel} : ${pc.green('✅ Included')}`);
    } else if (disposition.status === 'excluded') {
      ctx.logger.log(`  ${targetLabel} : ${pc.red(`🚫 Excluded`)} ${pc.dim(`(${disposition.reason})`)}`);
    } else {
      ctx.logger.log(`  ${targetLabel} : ${pc.red(`🚫 Not included`)} ${pc.dim(`(${disposition.reason})`)}`);
    }
  }

  ctx.logger.log('');
}
