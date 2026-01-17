import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import pc from 'picocolors';
import { loadConfig, findProjectRoot } from '../config/loader.js';
import { interpolateVars } from '../core/interpolate.js';
import { mergeVars } from '../core/merge.js';
import { parseEnvContent } from '../core/parse.js';
import { decrypt as sopsDecrypt } from '../core/sops.js';
import { maskValue } from '../core/mask.js';
import { loadLocalTemplates, resolveTemplateVars } from '../core/template.js';
import type { Environment, EnvVar, HushConfig } from '../types.js';

export interface TemplateOptions {
  root: string;
  env: Environment;
}

function getEncryptedPath(sourcePath: string): string {
  return sourcePath + '.encrypted';
}

function getDecryptedSecrets(projectRoot: string, env: Environment, config: HushConfig): EnvVar[] {
  const sharedEncrypted = join(projectRoot, getEncryptedPath(config.sources.shared));
  const envEncrypted = join(projectRoot, getEncryptedPath(config.sources[env]));
  const localEncrypted = join(projectRoot, getEncryptedPath(config.sources.local));

  const varSources: EnvVar[][] = [];

  if (existsSync(sharedEncrypted)) {
    const content = sopsDecrypt(sharedEncrypted);
    varSources.push(parseEnvContent(content));
  }

  if (existsSync(envEncrypted)) {
    const content = sopsDecrypt(envEncrypted);
    varSources.push(parseEnvContent(content));
  }

  if (existsSync(localEncrypted)) {
    const content = sopsDecrypt(localEncrypted);
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

export async function templateCommand(options: TemplateOptions): Promise<void> {
  const { root, env } = options;
  
  const contextDir = root;
  const projectInfo = findProjectRoot(contextDir);
  
  if (!projectInfo) {
    console.error(pc.red('No hush.yaml found in current directory or any parent directory.'));
    console.error(pc.dim('Run: npx hush init'));
    process.exit(1);
  }

  const { projectRoot } = projectInfo;
  const config = loadConfig(projectRoot);
  
  const localTemplate = loadLocalTemplates(contextDir, env);
  
  if (!localTemplate.hasTemplate) {
    console.log(pc.yellow('No local template found in current directory.'));
    console.log(pc.dim(`Looked for: .env, .env.${env}, .env.local`));
    console.log('');
    console.log(pc.dim('Without a local template, hush run will inject all root secrets.'));
    console.log(pc.dim('Create a .env file to define which variables this directory needs.'));
    return;
  }

  const rootSecrets = getDecryptedSecrets(projectRoot, env, config);
  const rootSecretsRecord = getRootSecretsAsRecord(rootSecrets);

  const resolvedVars = resolveTemplateVars(
    localTemplate.vars,
    rootSecretsRecord,
    { processEnv: process.env as Record<string, string> }
  );

  const relPath = relative(projectRoot, contextDir) || '.';
  
  console.log('');
  console.log(pc.bold(`Template: ${relPath}/`));
  console.log(pc.dim(`Project root: ${projectRoot}`));
  console.log(pc.dim(`Environment: ${env}`));
  console.log(pc.dim(`Files: ${localTemplate.files.join(', ')}`));
  console.log('');

  const templateVarKeys = new Set(localTemplate.vars.map(v => v.key));
  const rootSecretKeys = new Set(Object.keys(rootSecretsRecord));

  let fromRoot = 0;
  let fromLocal = 0;

  console.log(pc.bold('Variables:'));
  console.log('');

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
        console.log(`  ${pc.cyan(keyPadded)} = ${pc.dim(originalValue)} ${pc.dim('→')} ${masked}`);
        fromLocal++;
      } else if (rootSecretKeys.has(refName)) {
        console.log(`  ${pc.green(keyPadded)} = ${pc.dim(originalValue)} ${pc.dim('→')} ${masked}`);
        fromRoot++;
      } else {
        console.log(`  ${pc.yellow(keyPadded)} = ${pc.dim(originalValue)} ${pc.dim('→')} ${pc.yellow('(unresolved)')}`);
      }
    } else {
      console.log(`  ${pc.white(keyPadded)} = ${masked} ${pc.dim('(literal)')}`);
      fromLocal++;
    }
  }

  console.log('');
  console.log(pc.dim(`Total: ${resolvedVars.length} variables (${fromRoot} from root, ${fromLocal} local/literal)`));
  console.log('');
}
