import { join } from 'node:path';
import pc from 'picocolors';
import { interpolateVars } from '../core/interpolate.js';
import { mergeVars } from '../core/merge.js';
import { parseEnvContent } from '../core/parse.js';
import { loadLocalTemplates } from '../core/template.js';
import type { EnvVar, Environment, Target, HushContext } from '../types.js';
import { FORMAT_OUTPUT_FILES } from '../types.js';

export interface ResolveOptions {
  root: string;
  env: Environment;
  target: string;
}

interface VarSource {
  key: string;
  value: string;
  source: string;
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

function getOutputFilename(target: Target, env: Environment): string {
  if ((target as Target & { filename?: string }).filename) {
    return (target as Target & { filename?: string }).filename!;
  }
  return FORMAT_OUTPUT_FILES[target.format][env];
}

export async function resolveCommand(ctx: HushContext, options: ResolveOptions): Promise<void> {
  const { root, env, target: targetName } = options;
  const config = ctx.config.loadConfig(root);

  const target = config.targets.find(t => t.name === targetName);
  if (!target) {
    ctx.logger.error(`Target not found: ${targetName}`);
    ctx.logger.error(pc.dim('Available targets: ' + config.targets.map(t => t.name).join(', ')));
    ctx.process.exit(1);
  }

  const sharedEncrypted = join(root, config.sources.shared + '.encrypted');
  const envEncrypted = join(root, config.sources[env] + '.encrypted');
  const localEncrypted = join(root, config.sources.local + '.encrypted');

  const varsBySource: Map<string, VarSource[]> = new Map();
  const allVars: Map<string, VarSource> = new Map();

  const loadSource = (path: string, sourceName: string) => {
    if (!ctx.fs.existsSync(path)) return;
    const content = ctx.sops.decrypt(path);
    const vars = parseEnvContent(content);
    const sourceVars: VarSource[] = [];
    for (const v of vars) {
      const varSource = { key: v.key, value: v.value, source: sourceName };
      sourceVars.push(varSource);
      allVars.set(v.key, varSource);
    }
    varsBySource.set(sourceName, sourceVars);
  };

  loadSource(sharedEncrypted, config.sources.shared);
  loadSource(envEncrypted, config.sources[env]);
  loadSource(localEncrypted, config.sources.local);

  if (allVars.size === 0) {
    ctx.logger.error('No encrypted files found');
    ctx.process.exit(1);
  }

  const merged = mergeVars(...Array.from(varsBySource.values()).map(sources => 
    sources.map(s => ({ key: s.key, value: s.value }))
  ));
  const interpolated = interpolateVars(merged);

  const included: { key: string; source: string }[] = [];
  const excluded: { key: string; pattern: string }[] = [];

  for (const v of interpolated) {
    const varSource = allVars.get(v.key);
    const source = varSource?.source || 'unknown';

    if (target.include && target.include.length > 0) {
      const matchedInclude = matchesAnyPattern(v.key, target.include);
      if (!matchedInclude) {
        excluded.push({ key: v.key, pattern: `not in include: ${target.include.join(', ')}` });
        continue;
      }
    }

    if (target.exclude && target.exclude.length > 0) {
      const matchedExclude = matchesAnyPattern(v.key, target.exclude);
      if (matchedExclude) {
        excluded.push({ key: v.key, pattern: matchedExclude });
        continue;
      }
    }

    included.push({ key: v.key, source });
  }

  const outputFile = getOutputFilename(target, env);

  ctx.logger.log(pc.bold(`\nTarget: ${pc.cyan(target.name)}`));
  ctx.logger.log(`Path: ${pc.dim(target.path + '/')}`);
  ctx.logger.log(`Format: ${pc.dim(target.format)} ${pc.dim(`(${outputFile})`)}`);
  ctx.logger.log(`Environment: ${pc.dim(env)}`);

  ctx.logger.log(pc.green(`\n✅ ROOT SECRETS (Matched Filters) (${included.length}):`));
  if (included.length === 0) {
    ctx.logger.log(pc.dim('  (none)'));
  } else {
    const maxKeyLen = Math.max(...included.map(v => v.key.length));
    for (const v of included) {
      ctx.logger.log(`  ${v.key.padEnd(maxKeyLen)}  ${pc.dim(`(source: ${v.source})`)}`);
    }
  }

  ctx.logger.log(pc.red(`\n🚫 EXCLUDED VARIABLES (${excluded.length}):`));
  if (excluded.length === 0) {
    ctx.logger.log(pc.dim('  (none)'));
  } else {
    const maxKeyLen = Math.max(...excluded.map(v => v.key.length));
    for (const v of excluded) {
      ctx.logger.log(`  ${v.key.padEnd(maxKeyLen)}  ${pc.dim(`(matches: ${v.pattern})`)}`);
    }
  }

  const targetAbsPath = join(root, target.path);
  const localTemplate = loadLocalTemplates(targetAbsPath, env, ctx.fs);

  if (localTemplate.hasTemplate) {
    ctx.logger.log(pc.blue(`\n📄 TEMPLATE EXPANSIONS (${pc.dim(join(target.path, '.hush'))}):`));
    const maxKeyLen = Math.max(...localTemplate.vars.map(v => v.key.length));
    
    for (const v of localTemplate.vars) {
      ctx.logger.log(`  ${v.key.padEnd(maxKeyLen)}  ${pc.dim(`← ${v.value}`)}`);
    }

    // Calculate final merged list for clarity
    const finalKeys = new Set([
      ...included.map(v => v.key),
      ...localTemplate.vars.map(v => v.key)
    ]);
    
    ctx.logger.log(pc.magenta(`\n📦 FINAL INJECTION (${finalKeys.size} total):`));
    const sortedKeys = Array.from(finalKeys).sort();
    for (const key of sortedKeys) {
      const isTemplate = localTemplate.vars.some(v => v.key === key);
      const isRoot = included.some(v => v.key === key);
      
      let sourceInfo = '';
      if (isTemplate && isRoot) sourceInfo = pc.dim('(template overrides root)');
      else if (isTemplate) sourceInfo = pc.dim('(template)');
      else if (isRoot) sourceInfo = pc.dim('(root)');
      
      ctx.logger.log(`  ${key}  ${sourceInfo}`);
    }
  }

  ctx.logger.log('');
}
