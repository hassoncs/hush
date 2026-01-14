import type { EnvVar } from '../types.js';

export interface MaskedVar {
  key: string;
  masked: string;
  length: number;
  isSet: boolean;
}

export function maskValue(value: string): string {
  if (!value) return '(not set)';
  
  const len = value.length;
  
  if (len <= 4) {
    return '*'.repeat(len);
  }
  
  if (len <= 8) {
    return value[0] + '*'.repeat(len - 1);
  }
  
  const visibleChars = Math.min(4, Math.floor(len * 0.2));
  const prefix = value.slice(0, visibleChars);
  const maskedLen = len - visibleChars;
  
  return prefix + '*'.repeat(Math.min(maskedLen, 20)) + (maskedLen > 20 ? '...' : '');
}

export function maskVars(vars: EnvVar[]): MaskedVar[] {
  return vars.map(({ key, value }) => ({
    key,
    masked: maskValue(value),
    length: value.length,
    isSet: value.length > 0,
  }));
}

export function formatMaskedVar(v: MaskedVar, maxKeyLen: number): string {
  const paddedKey = v.key.padEnd(maxKeyLen);
  if (!v.isSet) {
    return `${paddedKey} = (not set)`;
  }
  return `${paddedKey} = ${v.masked} (${v.length} chars)`;
}
