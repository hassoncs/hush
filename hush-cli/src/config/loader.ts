import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { HushConfig, Target } from '../types.js';
import { DEFAULT_SOURCES } from '../types.js';

const CONFIG_FILENAMES = ['hush.yaml', 'hush.yml'];

export function findConfigPath(root: string): string | null {
  for (const filename of CONFIG_FILENAMES) {
    const configPath = join(root, filename);
    if (existsSync(configPath)) {
      return configPath;
    }
  }
  return null;
}

export function loadConfig(root: string): HushConfig {
  const configPath = findConfigPath(root);

  if (!configPath) {
    return {
      sources: DEFAULT_SOURCES,
      targets: [{ name: 'root', path: '.', format: 'dotenv' }],
    };
  }

  const content = readFileSync(configPath, 'utf-8');
  const parsed = parseYaml(content) as Partial<HushConfig>;

  return {
    sources: { ...DEFAULT_SOURCES, ...parsed.sources },
    targets: parsed.targets ?? [{ name: 'root', path: '.', format: 'dotenv' }],
  };
}

export function validateConfig(config: HushConfig): string[] {
  const errors: string[] = [];

  if (!config.sources.shared) {
    errors.push('sources.shared is required');
  }

  for (const target of config.targets) {
    if (!target.name) {
      errors.push('Each target must have a name');
    }
    if (!target.path) {
      errors.push(`Target "${target.name}" must have a path`);
    }
    if (!target.format) {
      errors.push(`Target "${target.name}" must have a format`);
    }
    if (!['dotenv', 'wrangler', 'json', 'shell'].includes(target.format)) {
      errors.push(`Target "${target.name}" has invalid format "${target.format}"`);
    }
  }

  return errors;
}
