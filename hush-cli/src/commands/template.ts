import { join, relative } from 'node:path';
import pc from 'picocolors';
import { interpolateVars } from '../core/interpolate.js';
import { mergeVars } from '../core/merge.js';
import { parseEnvContent } from '../core/parse.js';
import { maskValue } from '../core/mask.js';
import { loadLocalTemplates, resolveTemplateVars } from '../core/template.js';
import type { Environment, EnvVar, HushConfig, HushContext } from '../types.js';

export interface TemplateOptions {
  root: string;
  env: Environment;
}

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

export async function templateCommand(ctx: HushContext, options: TemplateOptions): Promise<void> {
  const { root, env } = options;
  
  const contextDir = root;
  const projectInfo = ctx.config.findProjectRoot(contextDir);
  
  if (!projectInfo) {
    ctx.logger.error('No hush.yaml found in current directory or any parent directory.');
    ctx.logger.error(pc.dim('Run: npx hush init'));
    ctx.process.exit(1);
  }

  const { projectRoot } = projectInfo;
  const config = ctx.config.loadConfig(projectRoot);
  
  const localTemplate = loadLocalTemplates(contextDir, env, ctx.fs);
  
  if (!localTemplate.hasTemplate) {
    ctx.logger.log(pc.yellow('No local template found in current directory.'));
    ctx.logger.log(pc.dim(`Looked for: .hush, .hush.${env}, .hush.local`));
    ctx.logger.log('');
    ctx.logger.log(pc.dim('Without a local template, hush run will inject all root secrets.'));
    ctx.logger.log(pc.dim('Create a .hush file to define which variables this directory needs.'));
    return;
  }

  const rootSecrets = getDecryptedSecrets(ctx, projectRoot, env, config);
  const rootSecretsRecord = getRootSecretsAsRecord(rootSecrets);

  const resolvedVars = resolveTemplateVars(
    localTemplate.vars,
    rootSecretsRecord,
    { processEnv: ctx.process.env as Record<string, string> }
  );

  const relPath = relative(projectRoot, contextDir) || '.';
  
  ctx.logger.log('');
  ctx.logger.log(pc.bold(`Template: ${relPath}/`));
  ctx.logger.log(pc.dim(`Project root: ${projectRoot}`));
  ctx.logger.log(pc.dim(`Environment: ${env}`));
  ctx.logger.log(pc.dim(`Files: ${localTemplate.files.join(', ')}`));
  ctx.logger.log('');

  const templateVarKeys = new Set(localTemplate.vars.map(v => v.key));
  const rootSecretKeys = new Set(Object.keys(rootSecretsRecord));

  let fromRoot = 0;
  let fromLocal = 0;

  ctx.logger.log(pc.bold('Variables:'));
  ctx.logger.log('');

  const maxKeyLen = Math.max(...resolvedVars.map(v => v.key.length), 20);

  for (const resolved of resolvedVars) {
    const original = localTemplate.vars.find(v => v.key === resolved.key);
    const originalValue = original?.value ?? '';
    
    const hasReference = originalValue.includes('${');
    const masked = maskValue(resolved.value);
    
    const keyPadded = resolved.key.padEnd(maxKeyLen);
    
    if (hasReference) {
      const refMatch = originalValue.match(/\$\{([^}]+)\}/);
      const refName = refMatch ? refMatch[1] : '';
      const isEnvRef = refName.startsWith('env:');
      
      if (isEnvRef) {
        ctx.logger.log(`  ${pc.cyan(keyPadded)} = ${pc.dim(originalValue)} ${pc.dim('→')} ${masked}`);
        fromLocal++;
      } else if (rootSecretKeys.has(refName)) {
        ctx.logger.log(`  ${pc.green(keyPadded)} = ${pc.dim(originalValue)} ${pc.dim('→')} ${masked}`);
        fromRoot++;
      } else {
        ctx.logger.log(`  ${pc.yellow(keyPadded)} = ${pc.dim(originalValue)} ${pc.dim('→')} ${pc.yellow('(unresolved)')}`);
      }
    } else {
      ctx.logger.log(`  ${pc.white(keyPadded)} = ${masked} ${pc.dim('(literal)')}`);
      fromLocal++;
    }
  }

  ctx.logger.log('');
  ctx.logger.log(pc.dim(`Total: ${resolvedVars.length} variables (${fromRoot} from root, ${fromLocal} local/literal)`));
  ctx.logger.log('');
}
