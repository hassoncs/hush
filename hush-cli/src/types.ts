export type OutputFormat = 'dotenv' | 'wrangler' | 'json' | 'shell' | 'yaml';
export type Environment = 'development' | 'production';

export interface Target {
  name: string;
  path: string;
  format: OutputFormat;
  include?: string[];
  exclude?: string[];
}

export interface SourceFiles {
  shared: string;
  development: string;
  production: string;
}

export interface HushConfig {
  sources: SourceFiles;
  targets: Target[];
}

export interface EnvVar {
  key: string;
  value: string;
}

export interface DecryptOptions {
  env: Environment;
  root: string;
}

export interface EncryptOptions {
  root: string;
}

export interface EditOptions {
  root: string;
  file?: 'shared' | 'development' | 'production';
}

export interface PushOptions {
  root: string;
  dryRun: boolean;
}

export interface StatusOptions {
  root: string;
}

export interface InitOptions {
  root: string;
}

export interface ListOptions {
  root: string;
  env: Environment;
}

export interface CheckOptions {
  root: string;
  warn: boolean;
  json: boolean;
  quiet: boolean;
  onlyChanged: boolean;
  requireSource: boolean;
}

export type CheckErrorType = 'SOURCE_MISSING' | 'ENCRYPTED_MISSING' | 'DECRYPT_FAILED' | 'SOPS_NOT_INSTALLED';

export interface CheckFileResult {
  source: string;
  encrypted: string;
  inSync: boolean;
  added: string[];
  removed: string[];
  changed: string[];
  error?: CheckErrorType;
}

export interface CheckResult {
  status: 'ok' | 'drift' | 'error';
  files: CheckFileResult[];
}

export const DEFAULT_SOURCES: SourceFiles = {
  shared: '.env',
  development: '.env.development',
  production: '.env.production',
};

export const FORMAT_OUTPUT_FILES: Record<OutputFormat, Record<Environment, string>> = {
  dotenv: {
    development: '.env.development',
    production: '.env.production',
  },
  wrangler: {
    development: '.dev.vars',
    production: '.dev.vars',
  },
  json: {
    development: '.env.development.json',
    production: '.env.production.json',
  },
  shell: {
    development: '.env.development.sh',
    production: '.env.production.sh',
  },
  yaml: {
    development: '.env.development.yaml',
    production: '.env.production.yaml',
  },
};
