import { expand } from 'dotenv-expand';
import { existsSync, readFileSync } from 'node:fs';
import type { EnvVar, Environment } from '../types.js';
import { ENV_PREFIXES } from '../types.js';

/**
 * Parse a .env file content into key-value pairs
 */
export function parseEnvContent(content: string): EnvVar[] {
  const vars: EnvVar[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Find the first = sign
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    // Remove surrounding quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    vars.push({ key, value });
  }

  return vars;
}

/**
 * Parse a .env file from disk
 */
export function parseEnvFile(filePath: string): EnvVar[] {
  if (!existsSync(filePath)) {
    return [];
  }

  const content = readFileSync(filePath, 'utf-8');
  return parseEnvContent(content);
}

/**
 * Filter and transform variables for a specific environment
 * - Includes shared vars (no prefix)
 * - Includes vars with matching prefix (stripped)
 * - Excludes vars with other prefix
 */
export function getVarsForEnvironment(
  vars: EnvVar[],
  env: Environment
): EnvVar[] {
  const prefix = ENV_PREFIXES[env];
  const otherPrefix = env === 'dev' ? ENV_PREFIXES.prod : ENV_PREFIXES.dev;

  const result: EnvVar[] = [];

  for (const v of vars) {
    // Skip vars with other environment's prefix
    if (v.key.startsWith(otherPrefix)) {
      continue;
    }

    // Strip prefix if it matches this environment
    if (v.key.startsWith(prefix)) {
      result.push({
        key: v.key.slice(prefix.length),
        value: v.value,
        originalKey: v.key,
      });
    } else {
      // Shared var (no prefix)
      result.push(v);
    }
  }

  return result;
}

/**
 * Expand variable references in env vars
 * e.g., ${OTHER_VAR} gets replaced with its value
 */
export function expandVariables(vars: EnvVar[]): EnvVar[] {
  // Create a process.env-like object for expansion
  const envObject: Record<string, string> = {};
  for (const v of vars) {
    envObject[v.key] = v.value;
  }

  // Use dotenv-expand with processEnv set to empty object to avoid mixing with process.env
  const expanded = expand({ parsed: envObject, processEnv: {} });

  if (!expanded.parsed) {
    return vars;
  }

  return vars.map((v) => ({
    ...v,
    value: expanded.parsed![v.key] ?? v.value,
  }));
}

/**
 * Merge multiple env var arrays, later arrays override earlier ones
 */
export function mergeEnvVars(...varArrays: EnvVar[][]): EnvVar[] {
  const merged = new Map<string, EnvVar>();

  for (const vars of varArrays) {
    for (const v of vars) {
      merged.set(v.key, v);
    }
  }

  return Array.from(merged.values());
}

/**
 * Format env vars as .env file content
 */
export function formatEnvFile(vars: EnvVar[]): string {
  return vars.map((v) => `${v.key}=${v.value}`).join('\n') + '\n';
}
