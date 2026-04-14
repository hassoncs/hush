import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runCommand } from '../src/commands/run.js';
import type { HushContext, StoreContext } from '../src/types.js';

function createStore(): StoreContext {
  return {
    mode: 'project',
    root: '/root',
    configPath: '/root/hush.yaml',
    keyIdentity: 'test/repo',
    displayLabel: '/root',
  };
}

describe('Issue 1 Reproduction: Templates vs Target Filters', () => {
  const mockSpawnSync = vi.fn();
  const mockExistsSync = vi.fn();
  const mockReadFileSync = vi.fn();
  const mockLoadConfig = vi.fn();
  const mockFindProjectRoot = vi.fn();
  const mockDecrypt = vi.fn();
  const mockConsoleWarn = vi.fn();
  const mockProcessExit = vi.fn();

  const mockContext: HushContext = {
    fs: {
      existsSync: mockExistsSync,
      readFileSync: mockReadFileSync,
      writeFileSync: vi.fn(),
      mkdirSync: vi.fn(),
      readdirSync: vi.fn().mockReturnValue([]),
      unlinkSync: vi.fn(),
      statSync: vi.fn().mockReturnValue({ isDirectory: () => false, mtime: new Date() }),
    } as any,
    exec: {
      spawnSync: mockSpawnSync,
      execSync: vi.fn(),
    },
    path: {
      join: (...parts: string[]) => parts.join('/'),
    },
    logger: {
      log: vi.fn(),
      error: vi.fn(),
      warn: mockConsoleWarn,
      info: vi.fn(),
    },
    process: {
      cwd: () => '/root/app', // Simulate running from subdirectory
      exit: mockProcessExit as any,
      env: {},
      stdin: {} as any,
      stdout: { write: vi.fn() } as any,
    },
    config: {
      loadConfig: mockLoadConfig,
      findProjectRoot: mockFindProjectRoot,
    },
    age: {
      ageAvailable: vi.fn(),
      ageGenerate: vi.fn(),
      keyExists: vi.fn(),
      keySave: vi.fn(),
      keyPath: vi.fn(),
      keyLoad: vi.fn(),
      agePublicFromPrivate: vi.fn(),
    },
    onepassword: {
      opInstalled: vi.fn(),
      opAvailable: vi.fn(),
      opGetKey: vi.fn(),
      opStoreKey: vi.fn(),
    },
    sops: {
      decrypt: mockDecrypt,
      encrypt: vi.fn(),
      edit: vi.fn(),
      isSopsInstalled: vi.fn().mockReturnValue(true),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSpawnSync.mockReturnValue({ status: 0 });
    mockProcessExit.mockImplementation((code: number) => {
      throw new Error(`Process exit: ${code}`);
    });

    mockLoadConfig.mockReturnValue({
      sources: {
        shared: '.hush',
        development: '.hush.development',
        production: '.hush.production',
        local: '.hush.local',
      },
      targets: [
        { 
          name: 'app', 
          path: './app', 
          format: 'dotenv',
          include: ['EXPO_PUBLIC_*']
        }
      ],
    });

    mockDecrypt.mockReturnValue(
      'EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=sk.xxx\n' +
      'SUPABASE_URL=https://xxx.supabase.co'
    );

    mockExistsSync.mockImplementation((p: string) => {
      if (p.endsWith('.encrypted')) return true;
      if (p.endsWith('/app/.hush')) return true;
      return false;
    });

    mockReadFileSync.mockImplementation((p: string) => {
      if (p.endsWith('/app/.hush')) {
        return 'EXPO_PUBLIC_SUPABASE_URL=${SUPABASE_URL}';
      }
      return '';
    });
  });

  it('should merge template expansions AND target filtered variables', async () => {
    try {
      await runCommand(mockContext, {
        store: createStore(),
        cwd: '/root/app', 
        env: 'development',
        command: ['printenv'],
      });
    } catch (e: any) {
      if (e.message !== 'Process exit: 0') throw e;
    }

    const calls = mockSpawnSync.mock.calls;
    const env = calls[0][2].env;

    // 1. Template expansion should be present
    expect(env).toHaveProperty('EXPO_PUBLIC_SUPABASE_URL', 'https://xxx.supabase.co');

    // 2. Target filter match should be present
    expect(env).toHaveProperty('EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN', 'sk.xxx');

    // 3. Excluded var should NOT be present
    expect(env).not.toHaveProperty('SUPABASE_URL');
  });
});
