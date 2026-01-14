import { describe, it, expect } from 'vitest';
import { maskValue, maskVars, formatMaskedVar } from '../../src/core/mask.js';

describe('maskValue', () => {
  it('masks empty value as not set', () => {
    expect(maskValue('')).toBe('(not set)');
  });

  it('masks short values entirely', () => {
    expect(maskValue('abc')).toBe('***');
    expect(maskValue('abcd')).toBe('****');
  });

  it('masks medium values showing first char', () => {
    expect(maskValue('abcdefgh')).toBe('a*******');
  });

  it('masks long values showing prefix', () => {
    const result = maskValue('sk_test_1234567890abcdef');
    expect(result.startsWith('sk_t')).toBe(true);
    expect(result).toContain('*');
  });

  it('truncates very long masked values', () => {
    const longValue = 'a'.repeat(100);
    const result = maskValue(longValue);
    expect(result.length).toBeLessThan(30);
    expect(result).toContain('...');
  });
});

describe('maskVars', () => {
  it('masks all variables', () => {
    const vars = [
      { key: 'SHORT', value: 'abc' },
      { key: 'LONG', value: 'sk_test_1234567890' },
      { key: 'EMPTY', value: '' },
    ];
    const result = maskVars(vars);
    
    expect(result).toHaveLength(3);
    expect(result[0].masked).toBe('***');
    expect(result[0].length).toBe(3);
    expect(result[0].isSet).toBe(true);
    
    expect(result[1].masked).toContain('*');
    expect(result[1].isSet).toBe(true);
    
    expect(result[2].masked).toBe('(not set)');
    expect(result[2].isSet).toBe(false);
  });
});

describe('formatMaskedVar', () => {
  it('formats set variable with length', () => {
    const v = { key: 'API_KEY', masked: 'sk_t*****', length: 20, isSet: true };
    const result = formatMaskedVar(v, 10);
    expect(result).toContain('API_KEY');
    expect(result).toContain('sk_t*****');
    expect(result).toContain('20 chars');
  });

  it('formats unset variable', () => {
    const v = { key: 'MISSING', masked: '(not set)', length: 0, isSet: false };
    const result = formatMaskedVar(v, 10);
    expect(result).toContain('MISSING');
    expect(result).toContain('(not set)');
  });
});
