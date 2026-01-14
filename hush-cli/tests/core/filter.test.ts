import { describe, it, expect } from 'vitest';
import { filterVarsForTarget, describeFilter } from '../../src/core/filter.js';
import type { Target, EnvVar } from '../../src/types.js';

describe('filterVarsForTarget', () => {
  const allVars: EnvVar[] = [
    { key: 'DATABASE_URL', value: 'postgres://...' },
    { key: 'STRIPE_SECRET', value: 'sk_...' },
    { key: 'EXPO_PUBLIC_API_URL', value: 'http://...' },
    { key: 'EXPO_PUBLIC_APP_NAME', value: 'MyApp' },
    { key: 'NEXT_PUBLIC_SITE_URL', value: 'http://...' },
    { key: 'VITE_APP_TITLE', value: 'ViteApp' },
  ];

  it('returns all vars when no include/exclude', () => {
    const target: Target = { name: 'root', path: '.', format: 'dotenv' };
    const result = filterVarsForTarget(allVars, target);
    expect(result).toHaveLength(6);
  });

  it('filters by include patterns', () => {
    const target: Target = {
      name: 'app',
      path: './app',
      format: 'dotenv',
      include: ['EXPO_PUBLIC_*'],
    };
    const result = filterVarsForTarget(allVars, target);
    expect(result).toHaveLength(2);
    expect(result.every(v => v.key.startsWith('EXPO_PUBLIC_'))).toBe(true);
  });

  it('filters by multiple include patterns', () => {
    const target: Target = {
      name: 'app',
      path: './app',
      format: 'dotenv',
      include: ['EXPO_PUBLIC_*', 'NEXT_PUBLIC_*', 'VITE_*'],
    };
    const result = filterVarsForTarget(allVars, target);
    expect(result).toHaveLength(4);
  });

  it('filters by exclude patterns', () => {
    const target: Target = {
      name: 'api',
      path: './api',
      format: 'wrangler',
      exclude: ['EXPO_PUBLIC_*', 'NEXT_PUBLIC_*', 'VITE_*'],
    };
    const result = filterVarsForTarget(allVars, target);
    expect(result).toHaveLength(2);
    expect(result.map(v => v.key)).toEqual(['DATABASE_URL', 'STRIPE_SECRET']);
  });

  it('applies both include and exclude', () => {
    const target: Target = {
      name: 'test',
      path: '.',
      format: 'dotenv',
      include: ['EXPO_PUBLIC_*', 'DATABASE_*'],
      exclude: ['*_URL'],
    };
    const result = filterVarsForTarget(allVars, target);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('EXPO_PUBLIC_APP_NAME');
  });

  it('returns empty array when no matches', () => {
    const target: Target = {
      name: 'none',
      path: '.',
      format: 'dotenv',
      include: ['NONEXISTENT_*'],
    };
    const result = filterVarsForTarget(allVars, target);
    expect(result).toHaveLength(0);
  });
});

describe('describeFilter', () => {
  it('returns "all vars" for no filters', () => {
    const target: Target = { name: 'root', path: '.', format: 'dotenv' };
    expect(describeFilter(target)).toBe('all vars');
  });

  it('describes include patterns', () => {
    const target: Target = {
      name: 'app',
      path: '.',
      format: 'dotenv',
      include: ['EXPO_PUBLIC_*', 'NEXT_PUBLIC_*'],
    };
    expect(describeFilter(target)).toBe('include: EXPO_PUBLIC_*, NEXT_PUBLIC_*');
  });

  it('describes exclude patterns', () => {
    const target: Target = {
      name: 'api',
      path: '.',
      format: 'wrangler',
      exclude: ['EXPO_PUBLIC_*'],
    };
    expect(describeFilter(target)).toBe('exclude: EXPO_PUBLIC_*');
  });

  it('describes both include and exclude', () => {
    const target: Target = {
      name: 'test',
      path: '.',
      format: 'dotenv',
      include: ['FOO_*'],
      exclude: ['FOO_BAR'],
    };
    expect(describeFilter(target)).toBe('include: FOO_*; exclude: FOO_BAR');
  });
});
