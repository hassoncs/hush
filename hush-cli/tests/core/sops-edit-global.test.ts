import { beforeEach, describe, expect, it, vi } from 'vitest';

const spawnSyncMock = vi.fn();
const existsSyncMock = vi.fn();
const keyExistsMock = vi.fn();
const keyPathMock = vi.fn();

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
  spawnSync: spawnSyncMock,
}));

vi.mock('../../src/lib/fs.js', () => ({
  fs: {
    existsSync: existsSyncMock,
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  },
}));

vi.mock('../../src/lib/age.js', () => ({
  keyExists: keyExistsMock,
  keyPath: keyPathMock,
}));

describe('sops edit global config binding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spawnSyncMock.mockReturnValue({ status: 0 });
    keyExistsMock.mockReturnValue(true);
    keyPathMock.mockReturnValue('/keys/hush-global.txt');
    existsSyncMock.mockImplementation((path: string) => path === '/store/.hush.encrypted' || path === '/store/.sops.yaml');
  });

  it('passes the store-specific .sops.yaml when opening sops edit', async () => {
    const { edit } = await import('../../src/core/sops.js');

    edit('/store/.hush.encrypted', {
      root: '/store',
      keyIdentity: 'hush-global',
    });

    expect(spawnSyncMock).toHaveBeenCalledWith(
      'sops',
      ['--config', '/store/.sops.yaml', '--input-type', 'dotenv', '--output-type', 'dotenv', '/store/.hush.encrypted'],
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
