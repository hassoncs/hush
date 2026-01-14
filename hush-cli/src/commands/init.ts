import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { stringify as stringifyYaml } from 'yaml';
import { findConfigPath } from '../config/loader.js';
import type { HushConfig, InitOptions, Target } from '../types.js';
import { DEFAULT_SOURCES } from '../types.js';

function detectTargets(root: string): Target[] {
  const targets: Target[] = [{ name: 'root', path: '.', format: 'dotenv' }];

  const entries = readdirSync(root, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

    const dirPath = join(root, entry.name);
    const packageJsonPath = join(dirPath, 'package.json');
    const wranglerPath = join(dirPath, 'wrangler.toml');

    if (!existsSync(packageJsonPath)) continue;

    if (existsSync(wranglerPath)) {
      targets.push({
        name: entry.name,
        path: `./${entry.name}`,
        format: 'wrangler',
        exclude: ['EXPO_PUBLIC_*', 'NEXT_PUBLIC_*', 'VITE_*'],
      });
    } else {
      targets.push({
        name: entry.name,
        path: `./${entry.name}`,
        format: 'dotenv',
      });
    }
  }

  return targets;
}

export async function initCommand(options: InitOptions): Promise<void> {
  const { root } = options;

  const existingConfig = findConfigPath(root);
  if (existingConfig) {
    console.error(pc.red(`Config already exists: ${existingConfig}`));
    process.exit(1);
  }

  console.log(pc.blue('Initializing hush...'));

  const targets = detectTargets(root);

  const config: HushConfig = {
    sources: DEFAULT_SOURCES,
    targets,
  };

  const yaml = stringifyYaml(config, { indent: 2 });
  const configPath = join(root, 'hush.yaml');

  writeFileSync(configPath, yaml, 'utf-8');

  console.log(pc.green(`\nCreated ${configPath}`));
  console.log(pc.dim('\nDetected targets:'));

  for (const target of targets) {
    console.log(`  ${pc.cyan(target.name)} ${pc.dim(target.path)} ${pc.magenta(target.format)}`);
  }

  console.log(pc.dim('\nNext steps:'));
  console.log('  1. Create your .env files (.env, .env.development, .env.production)');
  console.log('  2. Run "hush encrypt" to encrypt them');
  console.log('  3. Run "hush decrypt" to generate local env files');
}
