import type { EnvVar } from '../types.js';

const VAR_PATTERN = /\$\{([^}]+)\}/g;

export function interpolateValue(value: string, context: Record<string, string>): string {
  return value.replace(VAR_PATTERN, (match, varName) => {
    if (varName in context) {
      return context[varName];
    }
    return match;
  });
}

export function interpolateVars(vars: EnvVar[]): EnvVar[] {
  const context: Record<string, string> = {};

  for (const { key, value } of vars) {
    context[key] = value;
  }

  const maxIterations = 10;
  let changed = true;
  let iteration = 0;

  while (changed && iteration < maxIterations) {
    changed = false;
    iteration++;

    for (const key of Object.keys(context)) {
      const original = context[key];
      const interpolated = interpolateValue(original, context);

      if (interpolated !== original) {
        context[key] = interpolated;
        changed = true;
      }
    }
  }

  return Object.entries(context).map(([key, value]) => ({ key, value }));
}

export function hasUnresolvedVars(value: string): boolean {
  return VAR_PATTERN.test(value);
}

export function getUnresolvedVars(vars: EnvVar[]): string[] {
  const unresolved: string[] = [];

  for (const { key, value } of vars) {
    if (hasUnresolvedVars(value)) {
      unresolved.push(key);
    }
  }

  return unresolved;
}
