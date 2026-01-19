import { fs } from '../lib/fs.js';
import { join, dirname, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { HushConfig } from '../types.js';
import { DEFAULT_SOURCES, CURRENT_SCHEMA_VERSION } from '../types.js';

const CONFIG_FILENAMES = ['hush.yaml', 'hush.yml'];

export function findConfigPath(root: string): string | null {
  for (const filename of CONFIG_FILENAMES) {
    const configPath = join(root, filename);
    if (fs.existsSync(configPath)) {
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

  const content = fs.readFileSync(configPath, 'utf-8') as string;
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
  const validPushTypes = ['cloudflare-workers', 'cloudflare-pages'];

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

    // Validate push_to configuration
    if (target.push_to) {
      if (!target.push_to.type) {
        errors.push(`${prefix}: push_to.type is required (one of: ${validPushTypes.join(', ')})`);
      } else if (!validPushTypes.includes(target.push_to.type)) {
        errors.push(`${prefix}: invalid push_to.type "${target.push_to.type}" (must be one of: ${validPushTypes.join(', ')})`);
      } else if (target.push_to.type === 'cloudflare-pages') {
        const pagesConfig = target.push_to as { type: string; project?: string };
        if (!pagesConfig.project) {
          errors.push(`${prefix}: push_to.project is required for cloudflare-pages`);
        }
      }
    }
  }

  return errors;
}
