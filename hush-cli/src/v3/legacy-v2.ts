import { parse as parseYaml } from 'yaml';
import type {
  LegacyHushConfig,
  LegacySourceFiles,
  LegacyTarget,
  LegacyV2Inventory,
} from '../types.js';
import { DEFAULT_SOURCES } from '../types.js';
import { fs } from '../lib/fs.js';

function normalizeLegacyTargets(targets: LegacyTarget[] | undefined): LegacyTarget[] {
  return targets ?? [];
}

function parseLegacyV2Config(path: string, content: string): LegacyHushConfig {
  const parsed = parseYaml(content) as Partial<LegacyHushConfig> & { schema_version?: number };

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Expected YAML object in ${path}`);
  }

  return {
    version: parsed.schema_version ?? parsed.version,
    project: parsed.project,
    sources: { ...DEFAULT_SOURCES, ...(parsed.sources as Partial<LegacySourceFiles> | undefined) },
    targets: normalizeLegacyTargets(parsed.targets),
  };
}

export function loadLegacyV2Inventory(projectRoot: string, configPath: string): LegacyV2Inventory {
  const content = fs.readFileSync(configPath, 'utf-8') as string;
  const config = parseLegacyV2Config(configPath, content);

  return {
    kind: 'legacy-v2',
    projectRoot,
    configPath,
    config,
    sources: [
      { name: 'shared', path: config.sources.shared },
      { name: 'development', path: config.sources.development },
      { name: 'production', path: config.sources.production },
      { name: 'local', path: config.sources.local },
    ],
    targets: config.targets.map((target) => ({ ...target })),
  };
}
