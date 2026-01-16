import { existsSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { loadConfig } from '../config/loader.js';
import { interpolateVars } from '../core/interpolate.js';
import { mergeVars } from '../core/merge.js';
import { parseEnvContent } from '../core/parse.js';
import { decrypt as sopsDecrypt } from '../core/sops.js';
import type { EnvVar, Environment, Target } from '../types.js';
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

export async function resolveCommand(options: ResolveOptions): Promise<void> {
  const { root, env, target: targetName } = options;
  const config = loadConfig(root);

  const target = config.targets.find(t => t.name === targetName);
  if (!target) {
    console.error(pc.red(`Target not found: ${targetName}`));
    console.error(pc.dim('Available targets: ' + config.targets.map(t => t.name).join(', ')));
    process.exit(1);
  }

  const sharedEncrypted = join(root, config.sources.shared + '.encrypted');
  const envEncrypted = join(root, config.sources[env] + '.encrypted');
  const localEncrypted = join(root, config.sources.local + '.encrypted');

  const varsBySource: Map<string, VarSource[]> = new Map();
  const allVars: Map<string, VarSource> = new Map();

  const loadSource = (path: string, sourceName: string) => {
    if (!existsSync(path)) return;
    const content = sopsDecrypt(path);
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
    console.error(pc.red('No encrypted files found'));
    process.exit(1);
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

  console.log(pc.bold(`\nTarget: ${pc.cyan(target.name)}`));
  console.log(`Path: ${pc.dim(target.path + '/')}`);
  console.log(`Format: ${pc.dim(target.format)} ${pc.dim(`(${outputFile})`)}`);
  console.log(`Environment: ${pc.dim(env)}`);

  console.log(pc.green(`\n✅ INCLUDED VARIABLES (${included.length}):`));
  if (included.length === 0) {
    console.log(pc.dim('  (none)'));
  } else {
    const maxKeyLen = Math.max(...included.map(v => v.key.length));
    for (const v of included) {
      console.log(`  ${v.key.padEnd(maxKeyLen)}  ${pc.dim(`(source: ${v.source})`)}`);
    }
  }

  console.log(pc.red(`\n🚫 EXCLUDED VARIABLES (${excluded.length}):`));
  if (excluded.length === 0) {
    console.log(pc.dim('  (none)'));
  } else {
    const maxKeyLen = Math.max(...excluded.map(v => v.key.length));
    for (const v of excluded) {
      console.log(`  ${v.key.padEnd(maxKeyLen)}  ${pc.dim(`(matches: ${v.pattern})`)}`);
    }
  }

  console.log('');
}
