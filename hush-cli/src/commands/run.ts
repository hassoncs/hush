import { join, resolve } from 'node:path';
import pc from 'picocolors';
import { filterVarsForTarget } from '../core/filter.js';
import { interpolateVars, getUnresolvedVars } from '../core/interpolate.js';
import { mergeVars } from '../core/merge.js';
import { parseEnvContent } from '../core/parse.js';
import { loadLocalTemplates, resolveTemplateVars } from '../core/template.js';
import type { RunOptions, EnvVar, HushConfig, Environment, HushContext } from '../types.js';

function getEncryptedPath(sourcePath: string): string {
  return sourcePath + '.encrypted';
}

function getDecryptedSecrets(ctx: HushContext, projectRoot: string, env: Environment, config: HushConfig): EnvVar[] {
  const sharedEncrypted = join(projectRoot, getEncryptedPath(config.sources.shared));
  const envEncrypted = join(projectRoot, getEncryptedPath(config.sources[env]));
  const localEncrypted = join(projectRoot, getEncryptedPath(config.sources.local));

  const varSources: EnvVar[][] = [];

  if (ctx.fs.existsSync(sharedEncrypted)) {
    const content = ctx.sops.decrypt(sharedEncrypted);
    varSources.push(parseEnvContent(content));
  }

  if (ctx.fs.existsSync(envEncrypted)) {
    const content = ctx.sops.decrypt(envEncrypted);
    varSources.push(parseEnvContent(content));
  }

  if (ctx.fs.existsSync(localEncrypted)) {
    const content = ctx.sops.decrypt(localEncrypted);
    varSources.push(parseEnvContent(content));
  }

  if (varSources.length === 0) {
    return [];
  }

  const merged = mergeVars(...varSources);
  return interpolateVars(merged);
}

function getRootSecretsAsRecord(vars: EnvVar[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (const { key, value } of vars) {
    record[key] = value;
  }
  return record;
}

export async function runCommand(ctx: HushContext, options: RunOptions): Promise<void> {
  const { root, env, target, command } = options;
  
  if (!command || command.length === 0) {
    ctx.logger.error('Usage: hush run -- <command>');
    ctx.logger.error(pc.dim('Example: hush run -- npm start'));
    ctx.logger.error(pc.dim('         hush run -e production -- npm run build'));
    ctx.logger.error(pc.dim('         hush run --target api -- wrangler dev'));
    ctx.process.exit(1);
  }

  const contextDir = root;
  const projectInfo = ctx.config.findProjectRoot(contextDir);
  
  if (!projectInfo) {
    ctx.logger.error('No hush.yaml found in current directory or any parent directory.');
    ctx.logger.error(pc.dim('Run: npx hush init'));
    ctx.process.exit(1);
  }

  const { projectRoot } = projectInfo;
  const config = ctx.config.loadConfig(projectRoot);
  
  const rootSecrets = getDecryptedSecrets(ctx, projectRoot, env, config);

  if (rootSecrets.length === 0) {
    ctx.logger.warn(pc.yellow('No encrypted files found. Running command without secrets.'));
    ctx.logger.warn(pc.dim('  To encrypt secrets, run: npx hush encrypt'));
  }

  const rootSecretsRecord = getRootSecretsAsRecord(rootSecrets);

  const localTemplate = loadLocalTemplates(contextDir, env, ctx.fs);

  // 1. Resolve Template Vars
  let templateVars: EnvVar[] = [];
  if (localTemplate.hasTemplate) {
    templateVars = resolveTemplateVars(
      localTemplate.vars,
      rootSecretsRecord,
      { processEnv: ctx.process.env as Record<string, string> }
    );
  }

  // 2. Resolve Target Vars
  let targetVars: EnvVar[] = [];
  
  // Find target config: either explicit by name, or implicit by directory matching
  const targetConfig = target 
    ? config.targets.find(t => t.name === target)
    : config.targets.find(t => resolve(projectRoot, t.path) === resolve(contextDir));

  if (target && !targetConfig) {
    ctx.logger.error(`Target "${target}" not found in hush.yaml`);
    ctx.logger.error(pc.dim(`Available targets: ${config.targets.map(t => t.name).join(', ')}`));
    ctx.process.exit(1);
  }

  if (targetConfig) {
    targetVars = filterVarsForTarget(rootSecrets, targetConfig);

    if (targetConfig.format === 'wrangler') {
      targetVars.push({ key: 'CLOUDFLARE_INCLUDE_PROCESS_ENV', value: 'true' });

      const devVarsPath = join(targetConfig.path, '.dev.vars');
      const absDevVarsPath = join(projectRoot, devVarsPath);
      
      if (ctx.fs.existsSync(absDevVarsPath)) {
        ctx.logger.warn('\n⚠️  Wrangler Conflict Detected');
        ctx.logger.warn(`   Found .dev.vars in ${targetConfig.path}`);
        ctx.logger.warn('   Wrangler will IGNORE Hush secrets while this file exists.');
        ctx.logger.warn(pc.bold(`   Fix: rm ${devVarsPath}\n`));
      }
    }
  } else if (!localTemplate.hasTemplate && !target) {
    // If no template and no target matched (and not running explicit target), fallback to all secrets
    // This maintains backward compatibility for running in root or non-target dirs without templates
    targetVars = rootSecrets;
  }

  // 3. Merge (Template overrides Target)
  let vars: EnvVar[];
  if (localTemplate.hasTemplate) {
    // Merge target vars with template vars. 
    // Template vars take precedence over target vars.
    // This allows "additive" behavior: get target vars + template vars.
    vars = mergeVars(targetVars, templateVars);
  } else {
    vars = targetVars;
  }

  const unresolved = getUnresolvedVars(vars);
  if (unresolved.length > 0) {
    ctx.logger.warn(`Warning: ${unresolved.length} vars have unresolved references: ${unresolved.join(', ')}`);
  }

  const childEnv: NodeJS.ProcessEnv = {
    ...ctx.process.env,
    ...Object.fromEntries(vars.map(v => [v.key, v.value])),
  };

  const [cmd, ...args] = command;
  
  const result = ctx.exec.spawnSync(cmd, args, {
    stdio: 'inherit',
    env: childEnv,
    cwd: contextDir,
  });

  if (result.error) {
    ctx.logger.error(`Failed to execute: ${result.error.message}`);
    ctx.process.exit(1);
  }

  ctx.process.exit(result.status ?? 1);
}
