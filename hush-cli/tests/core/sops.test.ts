import { beforeEach, describe, expect, it, vi } from 'vitest';

const execSyncMock = vi.fn();
const spawnSyncMock = vi.fn();
const existsSyncMock = vi.fn();
const writeFileSyncMock = vi.fn();
const unlinkSyncMock = vi.fn();
const keyExistsMock = vi.fn();
const keyPathMock = vi.fn();

vi.mock('node:child_process', () => ({
  execSync: execSyncMock,
  spawnSync: spawnSyncMock,
}));

vi.mock('../../src/lib/fs.js', () => ({
  fs: {
    existsSync: existsSyncMock,
    writeFileSync: writeFileSyncMock,
    unlinkSync: unlinkSyncMock,
  },
}));

vi.mock('../../src/lib/age.js', () => ({
  keyExists: keyExistsMock,
  keyPath: keyPathMock,
}));

describe('sops helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spawnSyncMock.mockReturnValue({ status: 0 });
    keyExistsMock.mockReturnValue(true);
    keyPathMock.mockReturnValue('/keys/hush-global.txt');
    existsSyncMock.mockImplementation((path: string) => {
      return path === '/store/.hush' || path === '/store/.sops.yaml' || path.includes('hush-temp-');
    });
  });

  it('uses the store-specific .sops.yaml when encrypting a file', async () => {
    const { encrypt } = await import('../../src/core/sops.js');

    encrypt('/store/.hush', '/store/.hush.encrypted', {
      root: '/store',
      keyIdentity: 'hush-global',
    });

    expect(execSyncMock).toHaveBeenCalledWith(
      expect.stringContaining('--config "/store/.sops.yaml"'),
      expect.objectContaining({
        env: expect.objectContaining({
          SOPS_AGE_KEY_FILE: '/keys/hush-global.txt',
        }),
      }),
    );
  });

  it('uses the store-specific .sops.yaml when re-encrypting via setKey', async () => {
    const { setKey } = await import('../../src/core/sops.js');

    existsSyncMock.mockImplementation((path: string) => path === '/store/.sops.yaml');

    setKey('/store/.hush.encrypted', 'API_KEY', 'secret-value', {
      root: '/store',
      keyIdentity: 'hush-global',
    });

    expect(execSyncMock).toHaveBeenCalledWith(
      expect.stringContaining('--config "/store/.sops.yaml"'),
      expect.objectContaining({
        env: expect.objectContaining({
          SOPS_AGE_KEY_FILE: '/keys/hush-global.txt',
        }),
      }),
    );
  });
});
