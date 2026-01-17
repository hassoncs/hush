import { existsSync, renameSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { findConfigPath } from '../config/loader.js';

export interface MigrateOptions {
  root: string;
  dryRun: boolean;
}

interface MigrationFile {
  from: string;
  to: string;
  exists: boolean;
}

const FILE_MIGRATIONS: Array<{ from: string; to: string }> = [
  { from: '.env.encrypted', to: '.hush.encrypted' },
  { from: '.env.development.encrypted', to: '.hush.development.encrypted' },
  { from: '.env.production.encrypted', to: '.hush.production.encrypted' },
  { from: '.env.local.encrypted', to: '.hush.local.encrypted' },
];

const SOURCE_MIGRATIONS: Record<string, string> = {
  '.env': '.hush',
  '.env.development': '.hush.development',
  '.env.production': '.hush.production',
  '.env.local': '.hush.local',
};

function getMigrationFiles(root: string): MigrationFile[] {
  return FILE_MIGRATIONS.map(({ from, to }) => ({
    from,
    to,
    exists: existsSync(join(root, from)),
  }));
}

function migrateConfig(root: string, dryRun: boolean): boolean {
  const configPath = findConfigPath(root);
  if (!configPath) return false;

  const content = readFileSync(configPath, 'utf-8');
  const config = parseYaml(content) as Record<string, unknown>;

  let modified = false;
  const sources = config.sources as Record<string, string> | undefined;

  if (sources) {
    for (const [oldValue, newValue] of Object.entries(SOURCE_MIGRATIONS)) {
      for (const [key, value] of Object.entries(sources)) {
        if (value === oldValue) {
          if (!dryRun) {
            sources[key] = newValue;
          }
          modified = true;
        }
      }
    }
  }

  if (modified && !dryRun) {
    const schemaComment = content.startsWith('#') ? content.split('\n')[0] + '\n' : '';
    const newContent = schemaComment + stringifyYaml(config, { indent: 2 });
    writeFileSync(configPath, newContent, 'utf-8');
  }

  return modified;
}

export async function migrateCommand(options: MigrateOptions): Promise<void> {
  const { root, dryRun } = options;

  console.log(pc.blue('Hush v4 → v5 Migration\n'));

  if (dryRun) {
    console.log(pc.yellow('DRY RUN - no changes will be made\n'));
  }

  const migrations = getMigrationFiles(root);
  const filesToMigrate = migrations.filter(m => m.exists);

  if (filesToMigrate.length === 0) {
    console.log(pc.dim('No v4 encrypted files found (.env.encrypted, etc.)'));
    console.log(pc.dim('Already on v5 or no encrypted files exist.\n'));
    
    const configNeedsMigration = migrateConfig(root, true);
    if (configNeedsMigration) {
      console.log(pc.yellow('hush.yaml contains v4 source paths that need updating.\n'));
      if (!dryRun) {
        migrateConfig(root, false);
        console.log(pc.green('Updated hush.yaml source paths to v5 format.\n'));
      }
    }
    return;
  }

  console.log(pc.bold('Files to migrate:'));
  for (const { from, to, exists } of migrations) {
    if (exists) {
      console.log(`  ${pc.yellow(from)} → ${pc.green(to)}`);
    } else {
      console.log(pc.dim(`  ${from} (not found, skipping)`));
    }
  }
  console.log('');

  if (dryRun) {
    console.log(pc.dim('Run without --dry-run to apply changes.'));
    return;
  }

  let migratedCount = 0;
  for (const { from, to, exists } of migrations) {
    if (!exists) continue;

    const fromPath = join(root, from);
    const toPath = join(root, to);

    if (existsSync(toPath)) {
      console.log(pc.yellow(`  Skipping ${from}: ${to} already exists`));
      continue;
    }

    renameSync(fromPath, toPath);
    console.log(pc.green(`  Migrated ${from} → ${to}`));
    migratedCount++;
  }

  const configUpdated = migrateConfig(root, false);
  if (configUpdated) {
    console.log(pc.green('  Updated hush.yaml source paths'));
  }

  console.log('');
  if (migratedCount > 0 || configUpdated) {
    console.log(pc.green(pc.bold(`Migration complete.`)));
    console.log(pc.dim('\nNext steps:'));
    console.log(pc.dim('  1. git add .hush.encrypted .hush.*.encrypted hush.yaml'));
    console.log(pc.dim('  2. git rm .env.encrypted .env.*.encrypted (if tracked)'));
    console.log(pc.dim('  3. git commit -m "chore: migrate to Hush v5 format"'));
  } else {
    console.log(pc.dim('No changes made.'));
  }
}
