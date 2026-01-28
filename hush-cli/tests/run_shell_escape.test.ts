import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runCommand } from '../src/commands/run.js';
import type { HushContext } from '../types.js';

describe('runCommand shell escape handling', () => {
  const mockSpawnSync = vi.fn();
  const mockExistsSync = vi.fn();
  const mockLoadConfig = vi.fn();
  const mockFindProjectRoot = vi.fn();
  const mockDecrypt = vi.fn();
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
      error: vi.fn(),
      warn: vi.fn(),
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
      targets: [],
    });

    mockDecrypt.mockReturnValue('RUNPOD_API_KEY=secret123');

    mockExistsSync.mockImplementation((p: string) => {
      if (p.endsWith('.encrypted')) return true;
      return false;
    });
  });

  it('passes arguments correctly when using sh -c with complex command strings', async () => {
    const complexCommand = [
      'sh',
      '-c',
      'curl -X GET https://api.runpod.ai/v2/4ppvv5w150dukt/health -H "accept: application/json" -H "Authorization: Bearer $RUNPOD_API_KEY"'
    ];

    try {
      await runCommand(mockContext, {
        root: '/root',
        env: 'development',
        command: complexCommand,
      });
    } catch (e: any) {
      if (e.message !== 'Process exit: 0') throw e;
    }

    expect(mockSpawnSync).toHaveBeenCalled();
    
    const [cmd, args, options] = mockSpawnSync.mock.calls[0];
    
    expect(cmd).toBe('sh');
    expect(args).toHaveLength(2);
    expect(args[0]).toBe('-c');
    expect(args[1]).toContain('curl -X GET');
    expect(args[1]).toContain('Authorization: Bearer');
    expect(options.shell).toBeUndefined();
  });

  it('handles commands with quotes and special characters', async () => {
    const commandWithQuotes = [
      'sh',
      '-c',
      'echo "Hello World" && echo "Multiple words"'
    ];

    try {
      await runCommand(mockContext, {
        root: '/root',
        env: 'development',
        command: commandWithQuotes,
      });
    } catch (e: any) {
      if (e.message !== 'Process exit: 0') throw e;
    }

    expect(mockSpawnSync).toHaveBeenCalled();
    
    const [cmd, args] = mockSpawnSync.mock.calls[0];
    
    expect(cmd).toBe('sh');
    expect(args[0]).toBe('-c');
    expect(args[1]).toBe('echo "Hello World" && echo "Multiple words"');
  });
});
