import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runCommand } from '../src/commands/run.js';
import type { HushContext, RunOptions } from '../src/types.js';

describe('runCommand', () => {
  const mockSpawnSync = vi.fn();
  const mockExistsSync = vi.fn();
  const mockLoadConfig = vi.fn();
  const mockFindProjectRoot = vi.fn();
  const mockDecrypt = vi.fn();
  const mockConsoleWarn = vi.fn();
  const mockConsoleError = vi.fn();
  const mockProcessExit = vi.fn();

  const mockContext: HushContext = {
    fs: {
      existsSync: mockExistsSync,
      readFileSync: vi.fn().mockReturnValue(''),
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
    logger: {
      log: vi.fn(),
      error: mockConsoleError,
      warn: mockConsoleWarn,
      info: vi.fn(),
    },
    process: {
      cwd: () => '/root',
      exit: mockProcessExit as any,
      env: {},
    },
    config: {
      loadConfig: mockLoadConfig,
      findProjectRoot: mockFindProjectRoot,
    },
    sops: {
      decrypt: mockDecrypt,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSpawnSync.mockReturnValue({ status: 0 });
    mockProcessExit.mockImplementation((code: number) => {
      throw new Error(`Process exit: ${code}`);
    });

    mockFindProjectRoot.mockReturnValue({
      configPath: '/root/hush.yaml',
      projectRoot: '/root',
    });

    mockLoadConfig.mockReturnValue({
      sources: {
        shared: '.hush',
        development: '.hush.development',
        production: '.hush.production',
        local: '.hush.local',
      },
      targets: [
        { name: 'app', path: './app', format: 'dotenv' },
        { name: 'api', path: './api', format: 'wrangler' },
      ],
    });

    mockDecrypt.mockReturnValue('FOO=bar\nBAZ=qux');

    mockExistsSync.mockImplementation((p: string) => {
      if (p.endsWith('.encrypted')) return true;
      if (p.endsWith('.dev.vars')) return false;
      // Default to false for plaintext files to avoid template loading unless test sets otherwise
      return false;
    });
  });

  it('runs command with injected environment variables', async () => {
    try {
      await runCommand(mockContext, {
        root: '/root',
        env: 'development',
        command: ['echo', 'hello'],
      });
    } catch (e: any) {
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
    try {
      await runCommand(mockContext, {
        root: '/root',
        env: 'development',
        target: 'api',
        command: ['wrangler', 'dev'],
      });
    } catch (e: any) {
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
      return false;
    });

    try {
      await runCommand(mockContext, {
        root: '/root',
        env: 'development',
        target: 'api',
        command: ['wrangler', 'dev'],
      });
    } catch (e: any) {
      if (e.message !== 'Process exit: 0') throw e;
    }

    expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining('Wrangler Conflict Detected'));
    expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining('Found .dev.vars'));
  });

  it('does not inject CLOUDFLARE_INCLUDE_PROCESS_ENV for non-wrangler target', async () => {
    try {
      await runCommand(mockContext, {
        root: '/root',
        env: 'development',
        target: 'app',
        command: ['npm', 'start'],
      });
    } catch (e: any) {
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
