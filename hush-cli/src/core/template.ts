import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnvContent } from './parse.js';
import { mergeVars } from './merge.js';
import { interpolateVars, type InterpolateOptions } from './interpolate.js';
import type { EnvVar, Environment } from '../types.js';

const TEMPLATE_FILES = {
  base: '.env',
  development: '.env.development',
  production: '.env.production',
  local: '.env.local',
};

export interface LocalTemplateResult {
  hasTemplate: boolean;
  templateDir: string;
  vars: EnvVar[];
  files: string[];
}

export function loadLocalTemplates(
  contextDir: string,
  env: Environment
): LocalTemplateResult {
  const files: string[] = [];
  const varSources: EnvVar[][] = [];

  const basePath = join(contextDir, TEMPLATE_FILES.base);
  if (existsSync(basePath)) {
    files.push(TEMPLATE_FILES.base);
    varSources.push(parseEnvContent(readFileSync(basePath, 'utf-8')));
  }

  const envPath = join(contextDir, TEMPLATE_FILES[env]);
  if (existsSync(envPath)) {
    files.push(TEMPLATE_FILES[env]);
    varSources.push(parseEnvContent(readFileSync(envPath, 'utf-8')));
  }

  const localPath = join(contextDir, TEMPLATE_FILES.local);
  if (existsSync(localPath)) {
    files.push(TEMPLATE_FILES.local);
    varSources.push(parseEnvContent(readFileSync(localPath, 'utf-8')));
  }

  if (varSources.length === 0) {
    return {
      hasTemplate: false,
      templateDir: contextDir,
      vars: [],
      files: [],
    };
  }

  return {
    hasTemplate: true,
    templateDir: contextDir,
    vars: mergeVars(...varSources),
    files,
  };
}

export function resolveTemplateVars(
  templateVars: EnvVar[],
  rootSecrets: Record<string, string>,
  options: InterpolateOptions = {}
): EnvVar[] {
  const interpolated = interpolateVars(templateVars, { 
    ...options, 
    baseContext: rootSecrets 
  });
  
  const templateKeys = new Set(templateVars.map(v => v.key));
  return interpolated.filter(v => templateKeys.has(v.key));
}
