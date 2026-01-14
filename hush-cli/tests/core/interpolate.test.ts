import { describe, it, expect } from 'vitest';
import {
  interpolateValue,
  interpolateVars,
  hasUnresolvedVars,
  getUnresolvedVars,
} from '../../src/core/interpolate.js';

describe('interpolateValue', () => {
  it('replaces ${VAR} with context value', () => {
    const result = interpolateValue('Hello ${NAME}!', { NAME: 'World' });
    expect(result).toBe('Hello World!');
  });

  it('replaces multiple variables', () => {
    const result = interpolateValue('${PROTO}://${HOST}:${PORT}', {
      PROTO: 'https',
      HOST: 'example.com',
      PORT: '443',
    });
    expect(result).toBe('https://example.com:443');
  });

  it('leaves unresolved variables unchanged', () => {
    const result = interpolateValue('${FOO} and ${BAR}', { FOO: 'foo' });
    expect(result).toBe('foo and ${BAR}');
  });

  it('returns original value if no variables', () => {
    const result = interpolateValue('no variables', {});
    expect(result).toBe('no variables');
  });
});

describe('interpolateVars', () => {
  it('interpolates simple references', () => {
    const vars = [
      { key: 'BASE_URL', value: 'http://localhost' },
      { key: 'API_URL', value: '${BASE_URL}/api' },
    ];
    const result = interpolateVars(vars);
    expect(result).toContainEqual({ key: 'API_URL', value: 'http://localhost/api' });
  });

  it('handles chain interpolation', () => {
    const vars = [
      { key: 'HOST', value: 'localhost' },
      { key: 'PORT', value: '3000' },
      { key: 'BASE', value: 'http://${HOST}:${PORT}' },
      { key: 'API', value: '${BASE}/api' },
    ];
    const result = interpolateVars(vars);
    expect(result).toContainEqual({ key: 'API', value: 'http://localhost:3000/api' });
  });

  it('preserves order of keys', () => {
    const vars = [
      { key: 'A', value: '1' },
      { key: 'B', value: '2' },
      { key: 'C', value: '3' },
    ];
    const result = interpolateVars(vars);
    const keys = result.map(v => v.key);
    expect(keys).toContain('A');
    expect(keys).toContain('B');
    expect(keys).toContain('C');
  });

  it('handles circular references gracefully', () => {
    const vars = [
      { key: 'A', value: '${B}' },
      { key: 'B', value: '${A}' },
    ];
    const result = interpolateVars(vars);
    expect(result.find(v => v.key === 'A')?.value).toContain('${');
    expect(result.find(v => v.key === 'B')?.value).toContain('${');
  });
});

describe('hasUnresolvedVars', () => {
  it('returns true for values with ${...} pattern', () => {
    expect(hasUnresolvedVars('${FOO}')).toBe(true);
    expect(hasUnresolvedVars('prefix ${BAR} suffix')).toBe(true);
  });

  it('returns false for values without ${...} pattern', () => {
    expect(hasUnresolvedVars('plain value')).toBe(false);
    expect(hasUnresolvedVars('$FOO')).toBe(false);
    expect(hasUnresolvedVars('')).toBe(false);
  });
});

describe('getUnresolvedVars', () => {
  it('returns keys with unresolved references', () => {
    const vars = [
      { key: 'RESOLVED', value: 'plain' },
      { key: 'UNRESOLVED', value: '${MISSING}' },
      { key: 'ALSO_GOOD', value: 'test' },
    ];
    const result = getUnresolvedVars(vars);
    expect(result).toEqual(['UNRESOLVED']);
  });

  it('returns empty array when all resolved', () => {
    const vars = [
      { key: 'A', value: 'a' },
      { key: 'B', value: 'b' },
    ];
    const result = getUnresolvedVars(vars);
    expect(result).toEqual([]);
  });
});
