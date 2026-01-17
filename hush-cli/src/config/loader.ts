import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { HushConfig } from '../types.js';
import { DEFAULT_SOURCES, CURRENT_SCHEMA_VERSION } from '../types.js';

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

export function findProjectRoot(startDir: string): { configPath: string; projectRoot: string } | null {
  let currentDir = resolve(startDir);
  
  while (true) {
    const configPath = findConfigPath(currentDir);
    if (configPath) {
      return { configPath, projectRoot: currentDir };
    }
    
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }
    currentDir = parentDir;
  }
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
  const parsed = parseYaml(content) as Partial<HushConfig> & { schema_version?: number };

  return {
    // Support both 'version' and 'schema_version' (prefer schema_version)
    version: parsed.schema_version ?? parsed.version,
    project: parsed.project,
    sources: { ...DEFAULT_SOURCES, ...parsed.sources },
    targets: parsed.targets ?? [{ name: 'root', path: '.', format: 'dotenv' }],
  };
}

export function checkSchemaVersion(config: HushConfig): { needsMigration: boolean; from: number; to: number } {
  const configVersion = config.version ?? 1;
  return {
    needsMigration: configVersion < CURRENT_SCHEMA_VERSION,
    from: configVersion,
    to: CURRENT_SCHEMA_VERSION,
  };
}

export function validateConfig(config: HushConfig): string[] {
  const errors: string[] = [];
  const validFormats = ['dotenv', 'wrangler', 'json', 'shell', 'yaml'];

  if (!config.sources.shared) {
    errors.push('sources.shared is required');
  }

  if (!config.targets || config.targets.length === 0) {
    errors.push('At least one target is required');
  }

  for (let i = 0; i < config.targets.length; i++) {
    const target = config.targets[i];
    const prefix = target.name ? `Target "${target.name}"` : `Target at index ${i}`;

    if (!target.name) {
      errors.push(`${prefix}: missing required field "name"`);
    }
    if (!target.path) {
      errors.push(`${prefix}: missing required field "path" (e.g., "." or "./apps/web")`);
    }
    if (!target.format) {
      errors.push(`${prefix}: missing required field "format" (one of: ${validFormats.join(', ')})`);
    } else if (!validFormats.includes(target.format)) {
      errors.push(`${prefix}: invalid format "${target.format}" (must be one of: ${validFormats.join(', ')})`);
    }
  }

  return errors;
}
