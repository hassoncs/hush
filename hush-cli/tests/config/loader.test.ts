import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { loadConfig, findConfigPath, validateConfig } from '../../src/config/loader.js';
import type { HushConfig } from '../../src/types.js';

const FIXTURES_DIR = join(__dirname, '../fixtures');

describe('findConfigPath', () => {
  it('finds hush.yaml in basic fixture', () => {
    const result = findConfigPath(join(FIXTURES_DIR, 'basic'));
    expect(result).toBe(join(FIXTURES_DIR, 'basic/hush.yaml'));
  });

  it('returns null when no config exists', () => {
    const result = findConfigPath(join(FIXTURES_DIR, 'basic/nonexistent'));
    expect(result).toBeNull();
  });
});

describe('loadConfig', () => {
  it('loads config from basic fixture', () => {
    const config = loadConfig(join(FIXTURES_DIR, 'basic'));
    expect(config.sources.shared).toBe('.env');
    expect(config.sources.development).toBe('.env.development');
    expect(config.sources.production).toBe('.env.production');
    expect(config.targets).toHaveLength(1);
    expect(config.targets[0].name).toBe('root');
  });

  it('loads config from monorepo fixture', () => {
    const config = loadConfig(join(FIXTURES_DIR, 'monorepo'));
    expect(config.targets).toHaveLength(3);
    
    const app = config.targets.find(t => t.name === 'app');
    expect(app?.include).toContain('EXPO_PUBLIC_*');
    
    const api = config.targets.find(t => t.name === 'api');
    expect(api?.format).toBe('wrangler');
    expect(api?.exclude).toContain('EXPO_PUBLIC_*');
  });

  it('returns default config when no file exists', () => {
    const config = loadConfig('/nonexistent/path');
    expect(config.sources.shared).toBe('.env');
    expect(config.targets).toHaveLength(1);
    expect(config.targets[0].name).toBe('root');
  });
});

describe('validateConfig', () => {
  it('returns no errors for valid config', () => {
    const config: HushConfig = {
      sources: { shared: '.env', development: '.env.dev', production: '.env.prod' },
      targets: [{ name: 'root', path: '.', format: 'dotenv' }],
    };
    expect(validateConfig(config)).toEqual([]);
  });

  it('returns error for missing target name', () => {
    const config: HushConfig = {
      sources: { shared: '.env', development: '.env.dev', production: '.env.prod' },
      targets: [{ name: '', path: '.', format: 'dotenv' }],
    };
    const errors = validateConfig(config);
    expect(errors.some(e => e.includes('missing required field "name"'))).toBe(true);
  });

  it('returns error for missing target path', () => {
    const config: HushConfig = {
      sources: { shared: '.env', development: '.env.dev', production: '.env.prod' },
      targets: [{ name: 'test', path: '', format: 'dotenv' }],
    };
    const errors = validateConfig(config);
    expect(errors.some(e => e.includes('missing required field "path"'))).toBe(true);
  });

  it('returns error for invalid format', () => {
    const config = {
      sources: { shared: '.env', development: '.env.dev', production: '.env.prod' },
      targets: [{ name: 'test', path: '.', format: 'invalid' as any }],
    };
    const errors = validateConfig(config);
    expect(errors.some(e => e.includes('invalid format'))).toBe(true);
  });
});
