import { join } from 'node:path';
import pc from 'picocolors';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { HushContext } from '../types.js';

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

function getMigrationFiles(ctx: HushContext, root: string): MigrationFile[] {
  return FILE_MIGRATIONS.map(({ from, to }) => ({
    from,
    to,
    exists: ctx.fs.existsSync(join(root, from)),
  }));
}

function migrateConfig(ctx: HushContext, root: string, dryRun: boolean): boolean {
  const projectInfo = ctx.config.findProjectRoot(root);
  if (!projectInfo) return false;
  const configPath = projectInfo.configPath;

  const content = ctx.fs.readFileSync(configPath, 'utf-8') as string;
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
    ctx.fs.writeFileSync(configPath, newContent, 'utf-8');
  }

  return modified;
}

export async function migrateCommand(ctx: HushContext, options: MigrateOptions): Promise<void> {
  const { root, dryRun } = options;

  ctx.logger.log(pc.blue('Hush v4 → v5 Migration\n'));

  if (dryRun) {
    ctx.logger.log(pc.yellow('DRY RUN - no changes will be made\n'));
  }

  const migrations = getMigrationFiles(ctx, root);
  const filesToMigrate = migrations.filter(m => m.exists);

  if (filesToMigrate.length === 0) {
    ctx.logger.log(pc.dim('No v4 encrypted files found (.env.encrypted, etc.)'));
    ctx.logger.log(pc.dim('Already on v5 or no encrypted files exist.\n'));

    const configNeedsMigration = migrateConfig(ctx, root, true);
    if (configNeedsMigration) {
      ctx.logger.log(pc.yellow('hush.yaml contains v4 source paths that need updating.\n'));
      if (!dryRun) {
        migrateConfig(ctx, root, false);
        ctx.logger.log(pc.green('Updated hush.yaml source paths to v5 format.\n'));
      }
    }
    return;
  }

  ctx.logger.log(pc.bold('Files to migrate:'));
  for (const { from, to, exists } of migrations) {
    if (exists) {
      ctx.logger.log(`  ${pc.yellow(from)} → ${pc.green(to)}`);
    } else {
      ctx.logger.log(pc.dim(`  ${from} (not found, skipping)`));
    }
  }
  ctx.logger.log('');

  if (dryRun) {
    ctx.logger.log(pc.dim('Run without --dry-run to apply changes.'));
    return;
  }

  let migratedCount = 0;
  for (const { from, to, exists } of migrations) {
    if (!exists) continue;

    const fromPath = join(root, from);
    const toPath = join(root, to);

    if (ctx.fs.existsSync(toPath)) {
      ctx.logger.log(pc.yellow(`  Skipping ${from}: ${to} already exists`));
      continue;
    }

    const content = ctx.fs.readFileSync(fromPath, 'utf-8');
    ctx.fs.writeFileSync(toPath, content);
    ctx.fs.unlinkSync(fromPath);
    ctx.logger.log(pc.green(`  Migrated ${from} → ${to}`));
    migratedCount++;
  }

  const configUpdated = migrateConfig(ctx, root, false);
  if (configUpdated) {
    ctx.logger.log(pc.green('  Updated hush.yaml source paths'));
  }

  ctx.logger.log('');
  if (migratedCount > 0 || configUpdated) {
    ctx.logger.log(pc.green(pc.bold(`Migration complete.`)));
    ctx.logger.log(pc.dim('\nNext steps:'));
    ctx.logger.log(pc.dim('  1. git add .hush.encrypted .hush.*.encrypted hush.yaml'));
    ctx.logger.log(pc.dim('  2. git rm .env.encrypted .env.*.encrypted (if tracked)'));
    ctx.logger.log(pc.dim('  3. git commit -m "chore: migrate to Hush v5 format"'));
  } else {
    ctx.logger.log(pc.dim('No changes made.'));
  }
}
