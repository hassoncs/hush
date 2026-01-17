import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runCommand } from '../src/commands/run.js';
import * as childProcess from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as configLoader from '../src/config/loader.js';
import * as sops from '../src/core/sops.js';

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}));
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));
vi.mock('../src/config/loader.js');
vi.mock('../src/core/sops.js');

describe('runCommand', () => {
  const mockSpawnSync = vi.fn();
  const mockExistsSync = vi.fn();
  const mockLoadConfig = vi.fn();
  const mockDecrypt = vi.fn();
  const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  const mockProcessExit = vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`Process exit: ${code}`);
  });

  beforeEach(() => {
    vi.resetAllMocks();
    
    vi.mocked(childProcess.spawnSync).mockImplementation(mockSpawnSync as any);
    vi.mocked(fs.existsSync).mockImplementation(mockExistsSync);
    vi.mocked(configLoader.loadConfig).mockImplementation(mockLoadConfig);
    vi.mocked(sops.decrypt).mockImplementation(mockDecrypt);

    mockSpawnSync.mockReturnValue({ status: 0 });

    mockExistsSync.mockReturnValue(true);

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
      if (p.endsWith('.dev.vars')) return false;
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
      if (p.endsWith('.dev.vars')) return true;
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
