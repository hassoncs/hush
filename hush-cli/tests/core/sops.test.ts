import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { decrypt, decryptYaml, encrypt, encryptYamlContent, setKey, withPrivatePlaintextTempFile } from '../../src/core/sops.js';
import { ensureTestSopsConfig, ensureTestSopsEnv } from '../helpers/sops-test.js';

describe('sops helpers', () => {
  let storeDir: string;

  beforeEach(() => {
    storeDir = mkdtempSync(join(tmpdir(), 'hush-sops-test-'));
    ensureTestSopsEnv();
    ensureTestSopsConfig(storeDir);
  });

  afterEach(() => {
    rmSync(storeDir, { recursive: true, force: true });
  });

  it('encrypts and decrypts dotenv content with the repo-local .sops.yaml', () => {
    const inputPath = join(storeDir, '.hush');
    const outputPath = join(storeDir, '.hush.encrypted');

    writeFileSync(inputPath, 'API_KEY=value\n', 'utf-8');

    encrypt(inputPath, outputPath, {
      root: storeDir,
      keyIdentity: 'hush-global',
    });

    expect(readFileSync(outputPath, 'utf-8')).toContain('sops_version=');
    expect(decrypt(outputPath, { root: storeDir, keyIdentity: 'hush-global' })).toContain('API_KEY=value');
  });

  it('re-encrypts updates through setKey', () => {
    const encryptedPath = join(storeDir, '.hush.encrypted');

    writeFileSync(join(storeDir, '.plain.env'), 'EXISTING=1\n', 'utf-8');
    encrypt(join(storeDir, '.plain.env'), encryptedPath, {
      root: storeDir,
      keyIdentity: 'hush-global',
    });

    setKey(encryptedPath, 'API_KEY', 'secret-value', {
      root: storeDir,
      keyIdentity: 'hush-global',
    });

    const decrypted = decrypt(encryptedPath, { root: storeDir, keyIdentity: 'hush-global' });
    expect(decrypted).toContain('EXISTING=1');
    expect(decrypted).toContain('API_KEY=secret-value');
  });

  it('encrypts and decrypts yaml authority documents', () => {
    const manifestPath = join(storeDir, '.hush', 'manifest.encrypted');
    mkdirSync(dirname(manifestPath), { recursive: true });

    encryptYamlContent('version: 3\nidentities:\n  dev:\n    roles: [owner]\n', manifestPath, {
      root: storeDir,
      keyIdentity: 'hush-global',
    });

    expect(readFileSync(manifestPath, 'utf-8')).toContain('sops:');
    expect(decryptYaml(manifestPath, { root: storeDir, keyIdentity: 'hush-global' })).toContain('version: 3');
  });

  it('stages plaintext in a private temp dir with restrictive permissions and cleanup', () => {
    let observedTempFile = '';

    withPrivatePlaintextTempFile('yaml', 'version: 3\n', (tempFile) => {
      observedTempFile = tempFile;
      const fileMode = statSync(tempFile).mode & 0o777;
      const dirMode = statSync(dirname(tempFile)).mode & 0o777;

      expect(fileMode).toBe(0o600);
      expect(dirMode).toBe(0o700);
    });

    expect(observedTempFile).toContain(`${tmpdir()}/hush-sops-`);
    expect(existsSync(observedTempFile)).toBe(false);
    expect(existsSync(dirname(observedTempFile))).toBe(false);
  });

  it('uses the private temp staging helper for setKey updates', () => {
    const encryptedPath = join(storeDir, '.hush.encrypted');

    writeFileSync(join(storeDir, '.plain.env'), 'EXISTING=1\n', 'utf-8');
    encrypt(join(storeDir, '.plain.env'), encryptedPath, {
      root: storeDir,
      keyIdentity: 'hush-global',
    });

    setKey(encryptedPath, 'API_KEY', 'secret-value', {
      root: storeDir,
      keyIdentity: 'hush-global',
    });

    const decrypted = decrypt(encryptedPath, { root: storeDir, keyIdentity: 'hush-global' });
    expect(decrypted).toContain('EXISTING=1');
    expect(decrypted).toContain('API_KEY=secret-value');
  });
});
