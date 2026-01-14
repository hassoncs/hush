/**
 * Package style for env file output
 * - wrangler: outputs .dev.vars (for Cloudflare Workers)
 * - standard: outputs .env, .env.development, .env.production
 */
export type PackageStyle = 'wrangler' | 'standard';

/**
 * Discovered package in the monorepo
 */
export interface Package {
  /** Package name from package.json */
  name: string;
  /** Relative path from monorepo root */
  path: string;
  /** Detected style */
  style: PackageStyle;
}

/**
 * Parsed environment variable
 */
export interface EnvVar {
  key: string;
  value: string;
  /** Original key before prefix stripping */
  originalKey?: string;
}

/**
 * Environment type for prefix handling
 */
export type Environment = 'dev' | 'prod';

/**
 * Prefix constants
 */
export const ENV_PREFIXES = {
  dev: 'DEV__',
  prod: 'PROD__',
} as const;
