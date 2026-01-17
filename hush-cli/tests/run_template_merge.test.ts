import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import type { SpawnSyncReturns } from 'node:child_process';
import path from 'node:path';

const mockSpawnSync = vi.fn();
const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockLoadConfig = vi.fn();
const mockFindProjectRoot = vi.fn();
const mockDecrypt = vi.fn();

vi.mock('node:child_process', () => ({
  spawnSync: mockSpawnSync,
}));

vi.mock('node:fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
}));

vi.mock('../src/config/loader.js', () => ({
  loadConfig: mockLoadConfig,
  findConfigPath: vi.fn(),
  findProjectRoot: mockFindProjectRoot,
}));

vi.mock('../src/core/sops.js', () => ({
  decrypt: mockDecrypt,
  encrypt: vi.fn(),
}));

describe('Issue 1 Reproduction: Templates vs Target Filters', () => {
  let runCommand: typeof import('../src/commands/run.js').runCommand;

  const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const mockProcessExit = vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`Process exit: ${code}`);
  });
  
  // Mock current working directory
  const mockCwd = vi.spyOn(process, 'cwd');

  beforeEach(async () => {
    vi.clearAllMocks();
    
    const mod = await import('../src/commands/run.js');
    runCommand = mod.runCommand;
    
    mockSpawnSync.mockReturnValue({ status: 0 } as SpawnSyncReturns<Buffer>);
    
    // Setup filesystem mocks
    mockExistsSync.mockImplementation((p: string) => {
      // Root secrets exist
      if (p.endsWith('.encrypted')) return true;
      // Subdirectory template exists
      if (p.endsWith('/app/.env')) return true;
      return false;
    });

    mockReadFileSync.mockImplementation((p: string) => {
      if (p.endsWith('/app/.env')) {
        return 'EXPO_PUBLIC_SUPABASE_URL=${SUPABASE_URL}';
      }
      return '';
    });
    
    // Setup config mocks
    mockFindProjectRoot.mockReturnValue({
      configPath: '/root/hush.yaml',
      projectRoot: '/root',
    });

    mockLoadConfig.mockReturnValue({
      sources: {
        shared: '.env',
        development: '.env.development',
        production: '.env.production',
        local: '.env.local'
      },
      targets: [
        { 
          name: 'app', 
          path: './app', 
          format: 'dotenv',
          include: ['EXPO_PUBLIC_*']
        }
      ]
    });

    // Mock decrypted secrets
    mockDecrypt.mockReturnValue(
      'EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=sk.xxx\n' +
      'SUPABASE_URL=https://xxx.supabase.co'
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('should merge template expansions AND target filtered variables', async () => {
    // Simulate running from the 'app' subdirectory
    mockCwd.mockReturnValue('/root/app');

    try {
      await runCommand({
        root: '/root/app', // Simulate running from subdirectory
        env: 'development',
        command: ['printenv'],
      });
    } catch (e) {
      if (e.message !== 'Process exit: 0') throw e;
    }

    const calls = mockSpawnSync.mock.calls;
    const env = calls[0][2].env;

    // 1. Template expansion should be present
    expect(env).toHaveProperty('EXPO_PUBLIC_SUPABASE_URL', 'https://xxx.supabase.co');

    // 2. Target filter match should be present (This is what currently fails)
    expect(env).toHaveProperty('EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN', 'sk.xxx');

    // 3. Excluded var should NOT be present
    expect(env).not.toHaveProperty('SUPABASE_URL');
  });
});
