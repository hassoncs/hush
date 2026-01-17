import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import pc from 'picocolors';
import { loadConfig, findProjectRoot } from '../config/loader.js';
import { parseEnvContent } from '../core/parse.js';
import type { Environment, EnvVar } from '../types.js';

export interface ExpansionsOptions {
  root: string;
  env: Environment;
}

const TEMPLATE_FILES = ['.env', '.env.development', '.env.production', '.env.local'];

function findTemplateDirectories(projectRoot: string, maxDepth = 4): string[] {
  const templateDirs: string[] = [];
  
  function walk(dir: string, depth: number): void {
    if (depth > maxDepth) return;
    
    const hasTemplate = TEMPLATE_FILES.some(f => existsSync(join(dir, f)));
    if (hasTemplate && dir !== projectRoot) {
      templateDirs.push(dir);
    }
    
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.')) continue;
        if (entry.name === 'node_modules') continue;
        if (entry.name === 'dist') continue;
        if (entry.name === 'build') continue;
        
        walk(join(dir, entry.name), depth + 1);
      }
    } catch {
      return;
    }
  }
  
  walk(projectRoot, 0);
  return templateDirs;
}

function loadTemplateVars(dir: string, env: Environment): EnvVar[] {
  const varSources: EnvVar[][] = [];
  
  const basePath = join(dir, '.env');
  if (existsSync(basePath)) {
    varSources.push(parseEnvContent(readFileSync(basePath, 'utf-8')));
  }
  
  const envPath = join(dir, env === 'development' ? '.env.development' : '.env.production');
  if (existsSync(envPath)) {
    varSources.push(parseEnvContent(readFileSync(envPath, 'utf-8')));
  }
  
  const localPath = join(dir, '.env.local');
  if (existsSync(localPath)) {
    varSources.push(parseEnvContent(readFileSync(localPath, 'utf-8')));
  }
  
  const merged: Record<string, string> = {};
  for (const vars of varSources) {
    for (const { key, value } of vars) {
      merged[key] = value;
    }
  }
  
  return Object.entries(merged).map(([key, value]) => ({ key, value }));
}

export async function expansionsCommand(options: ExpansionsOptions): Promise<void> {
  const { root, env } = options;
  
  const projectInfo = findProjectRoot(root);
  
  if (!projectInfo) {
    console.error(pc.red('No hush.yaml found in current directory or any parent directory.'));
    console.error(pc.dim('Run: npx hush init'));
    process.exit(1);
  }

  const { projectRoot } = projectInfo;
  
  const templateDirs = findTemplateDirectories(projectRoot);
  
  if (templateDirs.length === 0) {
    console.log(pc.yellow('No subdirectory templates found.'));
    console.log(pc.dim('Templates are .env files in subdirectories that reference root secrets.'));
    console.log(pc.dim('Create apps/myapp/.env with content like: MY_VAR=${ROOT_SECRET}'));
    return;
  }
  
  console.log('');
  console.log(pc.bold(`Expansion Graph (from ${projectRoot})`));
  console.log(pc.dim(`Environment: ${env}`));
  console.log('');
  
  for (const dir of templateDirs) {
    const relPath = relative(projectRoot, dir);
    const vars = loadTemplateVars(dir, env);
    
    const expansions = vars.filter(v => v.value.includes('${'));
    const literals = vars.filter(v => !v.value.includes('${'));
    
    console.log(pc.cyan(`${relPath}/`));
    
    if (expansions.length > 0) {
      for (const { key, value } of expansions) {
        const isEnvRef = value.includes('${env:');
        const symbol = isEnvRef ? pc.blue('←') : pc.green('←');
        console.log(`  ${key.padEnd(30)} ${symbol} ${pc.dim(value)}`);
      }
    }
    
    if (literals.length > 0) {
      for (const { key } of literals) {
        console.log(`  ${key.padEnd(30)} ${pc.dim('= (literal)')}`);
      }
    }
    
    console.log('');
  }
  
  console.log(pc.dim(`Found ${templateDirs.length} subdirectory templates.`));
  console.log('');
}
