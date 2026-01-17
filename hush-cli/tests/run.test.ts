import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import type { SpawnSyncReturns } from 'node:child_process';

const mockSpawnSync = vi.fn();
const mockExistsSync = vi.fn();
const mockLoadConfig = vi.fn();
const mockFindProjectRoot = vi.fn();
const mockDecrypt = vi.fn();

vi.mock('node:child_process', () => ({
  spawnSync: mockSpawnSync,
}));

vi.mock('node:fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: vi.fn(),
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

describe('runCommand', () => {
  let runCommand: typeof import('../src/commands/run.js').runCommand;

  const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  const mockProcessExit = vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`Process exit: ${code}`);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    
    const mod = await import('../src/commands/run.js');
    runCommand = mod.runCommand;
    
    mockSpawnSync.mockReturnValue({ status: 0 } as SpawnSyncReturns<Buffer>);
    mockExistsSync.mockImplementation((p: string) => {
      if (p.endsWith('.encrypted')) return true;
      if (p.endsWith('.dev.vars')) return false;
      if (p.endsWith('.env') || p.endsWith('.env.development') || 
          p.endsWith('.env.production') || p.endsWith('.env.local')) {
        return false;
      }
      return true;
    });
    
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
        { name: 'app', path: './app', format: 'dotenv' },
        { name: 'api', path: './api', format: 'wrangler' }
      ]
    });

    mockDecrypt.mockReturnValue('FOO=bar\nBAZ=qux');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('runs command with injected environment variables', async () => {
    try {
      await runCommand({
        root: '/root',
        env: 'development',
        command: ['echo', 'hello'],
      });
    } catch (e) {
      if (e.message !== 'Process exit: 0') throw e;
    }

    expect(mockSpawnSync).toHaveBeenCalledWith(
      'echo',
      ['hello'],
      expect.objectContaining({
        env: expect.objectContaining({
          FOO: 'bar',
          BAZ: 'qux',
        }),
      })
    );
  });

  it('injects CLOUDFLARE_INCLUDE_PROCESS_ENV for wrangler target', async () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p.endsWith('.encrypted')) return true;
      if (p.endsWith('.dev.vars')) return false;
      if (p.endsWith('.env') || p.endsWith('.env.development') || 
          p.endsWith('.env.production') || p.endsWith('.env.local')) {
        return false;
      }
      return true;
    });

    try {
      await runCommand({
        root: '/root',
        env: 'development',
        target: 'api',
        command: ['wrangler', 'dev'],
      });
    } catch (e) {
      if (e.message !== 'Process exit: 0') throw e;
    }

    expect(mockSpawnSync).toHaveBeenCalledWith(
      'wrangler',
      ['dev'],
      expect.objectContaining({
        env: expect.objectContaining({
          CLOUDFLARE_INCLUDE_PROCESS_ENV: 'true',
          FOO: 'bar',
        }),
      })
    );

    expect(mockConsoleWarn).not.toHaveBeenCalled();
  });

  it('warns if .dev.vars exists for wrangler target', async () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p.endsWith('.encrypted')) return true;
      if (p.endsWith('.dev.vars')) return true;
      if (p.endsWith('.env') || p.endsWith('.env.development') || 
          p.endsWith('.env.production') || p.endsWith('.env.local')) {
        return false;
      }
      return true;
    });

    try {
      await runCommand({
        root: '/root',
        env: 'development',
        target: 'api',
        command: ['wrangler', 'dev'],
      });
    } catch (e) {
      if (e.message !== 'Process exit: 0') throw e;
    }

    expect(mockSpawnSync).toHaveBeenCalledWith(
      'wrangler',
      ['dev'],
      expect.objectContaining({
        env: expect.objectContaining({
          CLOUDFLARE_INCLUDE_PROCESS_ENV: 'true',
        }),
      })
    );

    expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining('Wrangler Conflict Detected'));
    expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining('Found .dev.vars'));
  });

  it('does not inject CLOUDFLARE_INCLUDE_PROCESS_ENV for non-wrangler target', async () => {
    try {
      await runCommand({
        root: '/root',
        env: 'development',
        target: 'app',
        command: ['npm', 'start'],
      });
    } catch (e) {
      if (e.message !== 'Process exit: 0') throw e;
    }

    expect(mockSpawnSync).toHaveBeenCalledWith(
      'npm',
      ['start'],
      expect.objectContaining({
        env: expect.not.objectContaining({
          CLOUDFLARE_INCLUDE_PROCESS_ENV: 'true',
        }),
      })
    );
  });
});
