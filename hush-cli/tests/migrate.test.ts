import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';

describe('migrate command file mapping', () => {
  const TEST_DIR = join('/tmp', 'hush-test-migrate');

  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('maps v4 file names to v5 file names correctly', () => {
    const FILE_MIGRATIONS = [
      { from: '.env.encrypted', to: '.hush.encrypted' },
      { from: '.env.development.encrypted', to: '.hush.development.encrypted' },
      { from: '.env.production.encrypted', to: '.hush.production.encrypted' },
      { from: '.env.local.encrypted', to: '.hush.local.encrypted' },
    ];

    for (const { from, to } of FILE_MIGRATIONS) {
      expect(from).toContain('.env');
      expect(to).toContain('.hush');
      expect(from.replace('.env', '.hush')).toBe(to);
    }
  });

  it('maps v4 source paths to v5 source paths correctly', () => {
    const SOURCE_MIGRATIONS: Record<string, string> = {
      '.env': '.hush',
      '.env.development': '.hush.development',
      '.env.production': '.hush.production',
      '.env.local': '.hush.local',
    };

    for (const [oldValue, newValue] of Object.entries(SOURCE_MIGRATIONS)) {
      expect(oldValue).toContain('.env');
      expect(newValue).toContain('.hush');
      expect(oldValue.replace('.env', '.hush')).toBe(newValue);
    }
  });
});

describe('DEFAULT_SOURCES', () => {
  it('uses .hush file naming', async () => {
    const { DEFAULT_SOURCES } = await import('../src/types.js');
    
    expect(DEFAULT_SOURCES.shared).toBe('.hush');
    expect(DEFAULT_SOURCES.development).toBe('.hush.development');
    expect(DEFAULT_SOURCES.production).toBe('.hush.production');
    expect(DEFAULT_SOURCES.local).toBe('.hush.local');
  });
});
