export type OutputFormat = 'dotenv' | 'wrangler' | 'json' | 'shell' | 'yaml';
export type Environment = 'development' | 'production';
export type PushDestinationType = 'cloudflare-workers' | 'cloudflare-pages';

export interface CloudflareWorkersPushConfig {
  type: 'cloudflare-workers';
}

export interface CloudflarePagesPushConfig {
  type: 'cloudflare-pages';
  project: string;
}

export type PushConfig = CloudflareWorkersPushConfig | CloudflarePagesPushConfig;

export interface Target {
  name: string;
  path: string;
  format: OutputFormat;
  include?: string[];
  exclude?: string[];
  push_to?: PushConfig;
}

export interface SourceFiles {
  shared: string;
  development: string;
  production: string;
  local: string;
}

export interface HushConfig {
  version?: number;
  project?: string;
  sources: SourceFiles;
  targets: Target[];
}

export const CURRENT_SCHEMA_VERSION = 2;

export interface EnvVar {
  key: string;
  value: string;
}

export interface EncryptOptions {
  root: string;
}

export interface DecryptOptions {
  root: string;
  env: Environment;
  force: boolean;
}

export interface EditOptions {
  root: string;
  file?: 'shared' | 'development' | 'production' | 'local';
}

export interface SetOptions {
  root: string;
  file?: 'shared' | 'development' | 'production' | 'local';
  key?: string;
  gui?: boolean;
}

export interface RunOptions {
  root: string;
  env: Environment;
  target?: string;
  command: string[];
}

export interface PushOptions {
  root: string;
  dryRun: boolean;
  verbose: boolean;
  target?: string;
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
  allowPlaintext?: boolean;
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

export interface PlaintextFileResult {
  file: string;
  keyCount: number;
}

export interface CheckResult {
  status: 'ok' | 'drift' | 'error' | 'plaintext';
  files: CheckFileResult[];
  plaintextFiles?: PlaintextFileResult[];
}

export interface SkillOptions {
  root: string;
  global?: boolean;
  local?: boolean;
}

export interface ResolveOptions {
  root: string;
  env: Environment;
  target: string;
}

export interface TraceOptions {
  root: string;
  env: Environment;
  key: string;
}

export const DEFAULT_SOURCES: SourceFiles = {
  shared: '.env',
  development: '.env.development',
  production: '.env.production',
  local: '.env.local',
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
