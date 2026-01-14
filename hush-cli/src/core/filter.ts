import type { EnvVar, Target } from '../types.js';

function matchesPattern(key: string, pattern: string): boolean {
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  return regex.test(key);
}

function matchesAnyPattern(key: string, patterns: string[]): boolean {
  return patterns.some(pattern => matchesPattern(key, pattern));
}

export function filterVarsForTarget(vars: EnvVar[], target: Target): EnvVar[] {
  let filtered = vars;

  if (target.include && target.include.length > 0) {
    filtered = filtered.filter(v => matchesAnyPattern(v.key, target.include!));
  }

  if (target.exclude && target.exclude.length > 0) {
    filtered = filtered.filter(v => !matchesAnyPattern(v.key, target.exclude!));
  }

  return filtered;
}

export function describeFilter(target: Target): string {
  const parts: string[] = [];

  if (target.include && target.include.length > 0) {
    parts.push(`include: ${target.include.join(', ')}`);
  }

  if (target.exclude && target.exclude.length > 0) {
    parts.push(`exclude: ${target.exclude.join(', ')}`);
  }

  return parts.length > 0 ? parts.join('; ') : 'all vars';
}
