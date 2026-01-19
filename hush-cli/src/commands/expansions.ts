import { join, relative } from 'node:path';
import pc from 'picocolors';
import { parseEnvContent } from '../core/parse.js';
import type { Environment, EnvVar, HushContext } from '../types.js';

export interface ExpansionsOptions {
  root: string;
  env: Environment;
}

const TEMPLATE_FILES = ['.hush', '.hush.development', '.hush.production', '.hush.local'];

function findTemplateDirectories(ctx: HushContext, projectRoot: string, maxDepth = 4): string[] {
  const templateDirs: string[] = [];

  function walk(dir: string, depth: number): void {
    if (depth > maxDepth) return;

    const hasTemplate = TEMPLATE_FILES.some(f => ctx.fs.existsSync(join(dir, f)));
    if (hasTemplate && dir !== projectRoot) {
      templateDirs.push(dir);
    }

    try {
      const entries = ctx.fs.readdirSync(dir);
      for (const entry of entries) {
        const entryName = typeof entry === 'string' ? entry : entry.name;
        if (entryName.startsWith('.') || entryName === 'node_modules') continue;
        if (entryName === 'dist' || entryName === 'build') continue;

        const entryPath = join(dir, entryName);
        try {
          const stat = ctx.fs.statSync(entryPath);
          if (stat.isDirectory()) {
            walk(entryPath, depth + 1);
          }
        } catch {
          continue;
        }
      }
    } catch {
      return;
    }
  }

  walk(projectRoot, 0);
  return templateDirs;
}

function loadTemplateVars(ctx: HushContext, dir: string, env: Environment): EnvVar[] {
  const varSources: EnvVar[][] = [];

  const basePath = join(dir, '.hush');
  if (ctx.fs.existsSync(basePath)) {
    varSources.push(parseEnvContent(ctx.fs.readFileSync(basePath, 'utf-8') as string));
  }

  const envPath = join(dir, env === 'development' ? '.hush.development' : '.hush.production');
  if (ctx.fs.existsSync(envPath)) {
    varSources.push(parseEnvContent(ctx.fs.readFileSync(envPath, 'utf-8') as string));
  }

  const localPath = join(dir, '.hush.local');
  if (ctx.fs.existsSync(localPath)) {
    varSources.push(parseEnvContent(ctx.fs.readFileSync(localPath, 'utf-8') as string));
  }

  const merged: Record<string, string> = {};
  for (const vars of varSources) {
    for (const { key, value } of vars) {
      merged[key] = value;
    }
  }

  return Object.entries(merged).map(([key, value]) => ({ key, value }));
}

export async function expansionsCommand(ctx: HushContext, options: ExpansionsOptions): Promise<void> {
  const { root, env } = options;

  const projectInfo = ctx.config.findProjectRoot(root);

  if (!projectInfo) {
    ctx.logger.error(pc.red('No hush.yaml found in current directory or any parent directory.'));
    ctx.logger.error(pc.dim('Run: npx hush init'));
    ctx.process.exit(1);
  }

  const { projectRoot } = projectInfo;

  const templateDirs = findTemplateDirectories(ctx, projectRoot);

  if (templateDirs.length === 0) {
    ctx.logger.log(pc.yellow('No subdirectory templates found.'));
    ctx.logger.log(pc.dim('Templates are .hush files in subdirectories that reference root secrets.'));
    ctx.logger.log(pc.dim('Create apps/myapp/.hush with content like: MY_VAR=${ROOT_SECRET}'));
    return;
  }

  ctx.logger.log('');
  ctx.logger.log(pc.bold(`Expansion Graph (from ${projectRoot})`));
  ctx.logger.log(pc.dim(`Environment: ${env}`));
  ctx.logger.log('');

  for (const dir of templateDirs) {
    const relPath = relative(projectRoot, dir);
    const vars = loadTemplateVars(ctx, dir, env);

    const expansions = vars.filter(v => v.value.includes('${'));
    const literals = vars.filter(v => !v.value.includes('${'));

    ctx.logger.log(pc.cyan(`${relPath}/`));

    if (expansions.length > 0) {
      for (const { key, value } of expansions) {
        const isEnvRef = value.includes('${env:');
        const symbol = isEnvRef ? pc.blue('←') : pc.green('←');
        ctx.logger.log(`  ${key.padEnd(30)} ${symbol} ${pc.dim(value)}`);
      }
    }

    if (literals.length > 0) {
      for (const { key } of literals) {
        ctx.logger.log(`  ${key.padEnd(30)} ${pc.dim('= (literal)')}`);
      }
    }

    ctx.logger.log('');
  }

  ctx.logger.log(pc.dim(`Found ${templateDirs.length} subdirectory templates.`));
  ctx.logger.log('');
}
