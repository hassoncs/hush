import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const execSyncMock = vi.fn();
const spawnSyncMock = vi.fn();
const keyExistsMock = vi.fn();
const keyPathMock = vi.fn();

vi.mock('node:child_process', () => ({
  execSync: execSyncMock,
  spawnSync: spawnSyncMock,
}));

vi.mock('../../src/lib/age.js', () => ({
  keyExists: keyExistsMock,
  keyPath: keyPathMock,
}));

describe('sops helpers', () => {
  let storeDir: string;

  async function loadSopsModule() {
    return import(`../../src/core/sops.js?test=${Date.now()}-${Math.random()}`);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    execSyncMock.mockReturnValue('EXISTING=1\n');
    spawnSyncMock.mockReturnValue({ status: 0 });
    keyExistsMock.mockReturnValue(true);
    keyPathMock.mockReturnValue('/keys/hush-global.txt');
    storeDir = mkdtempSync(join(tmpdir(), 'hush-sops-test-'));
    writeFileSync(join(storeDir, '.sops.yaml'), 'creation_rules:\n  - path_regex: ".*"\n', 'utf-8');
  });

  afterEach(() => {
    rmSync(storeDir, { recursive: true, force: true });
  });

  it('uses the store-specific .sops.yaml when encrypting a file', async () => {
    const { encrypt } = await loadSopsModule();
    const inputPath = join(storeDir, '.hush');
    const outputPath = join(storeDir, '.hush.encrypted');

    writeFileSync(inputPath, 'API_KEY=value\n', 'utf-8');

    encrypt(inputPath, outputPath, {
      root: storeDir,
      keyIdentity: 'hush-global',
    });

    expect(
      execSyncMock.mock.calls.some(
        ([command, options]) =>
          typeof command === 'string' &&
          command.includes(`--config "${join(storeDir, '.sops.yaml')}"`) &&
          options?.env?.SOPS_AGE_KEY_FILE === '/keys/hush-global.txt'
      )
    ).toBe(true);
  });

  it('uses the store-specific .sops.yaml when re-encrypting via setKey', async () => {
    const { setKey } = await loadSopsModule();
    const encryptedPath = join(storeDir, '.hush.encrypted');

    writeFileSync(encryptedPath, 'encrypted', 'utf-8');

    setKey(encryptedPath, 'API_KEY', 'secret-value', {
      root: storeDir,
      keyIdentity: 'hush-global',
    });

    expect(
      execSyncMock.mock.calls.some(
        ([command, options]) =>
          typeof command === 'string' &&
          command.includes(`--config "${join(storeDir, '.sops.yaml')}"`) &&
          options?.env?.SOPS_AGE_KEY_FILE === '/keys/hush-global.txt'
      )
    ).toBe(true);
  });

  it('uses the store-specific .sops.yaml when opening sops edit', async () => {
    const { edit } = await loadSopsModule();
    const encryptedPath = join(storeDir, '.hush.encrypted');

    writeFileSync(encryptedPath, 'encrypted', 'utf-8');

    edit(encryptedPath, {
      root: storeDir,
      keyIdentity: 'hush-global',
    });

    expect(spawnSyncMock).toHaveBeenCalledWith(
      'sops',
      ['--config', join(storeDir, '.sops.yaml'), '--input-type', 'dotenv', '--output-type', 'dotenv', encryptedPath],
      expect.objectContaining({
        env: expect.objectContaining({
          SOPS_AGE_KEY_FILE: '/keys/hush-global.txt',
        }),
        shell: true,
        stdio: 'inherit',
      }),
    );
  });
});
