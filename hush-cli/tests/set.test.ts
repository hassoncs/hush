import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HushContext } from '../src/types.js';

describe('set command argument parsing', () => {
  const mockConsoleError = vi.fn();
  const mockProcessExit = vi.fn();

  const createMockContext = (): HushContext => {
    return {
      fs: {
        existsSync: vi.fn().mockReturnValue(true),
        readFileSync: vi.fn().mockReturnValue(''),
        writeFileSync: vi.fn(),
        mkdirSync: vi.fn(),
        readdirSync: vi.fn().mockReturnValue([]),
        unlinkSync: vi.fn(),
        statSync: vi.fn().mockReturnValue({ isDirectory: () => false, mtime: new Date() }),
        renameSync: vi.fn(),
      },
      path: {
        join: (...parts: string[]) => parts.join('/'),
      },
      exec: {
        spawnSync: vi.fn(),
        execSync: vi.fn(),
      },
      logger: {
        log: vi.fn(),
        error: mockConsoleError,
        warn: vi.fn(),
        info: vi.fn(),
      },
      process: {
        cwd: () => '/root',
        exit: mockProcessExit as any,
        env: {},
        stdin: { isTTY: true } as any,
        stdout: { write: vi.fn() } as any,
      },
      config: {
        loadConfig: vi.fn().mockReturnValue({
          sources: {
            shared: '.hush',
            development: '.hush.development',
            production: '.hush.production',
            local: '.hush.local',
          },
          targets: [{ name: 'root', path: '.', format: 'dotenv' }],
        }),
        findProjectRoot: vi.fn().mockReturnValue({
          configPath: '/root/hush.yaml',
          projectRoot: '/root',
        }),
      },
      age: {
        ageAvailable: vi.fn().mockReturnValue(true),
        ageGenerate: vi.fn(),
        keyExists: vi.fn().mockReturnValue(true),
        keySave: vi.fn(),
        keyPath: vi.fn().mockReturnValue('/keys/test.txt'),
        keyLoad: vi.fn(),
        agePublicFromPrivate: vi.fn(),
      },
      onepassword: {
        opInstalled: vi.fn().mockReturnValue(false),
        opAvailable: vi.fn().mockReturnValue(false),
        opGetKey: vi.fn(),
        opStoreKey: vi.fn(),
      },
      sops: {
        decrypt: vi.fn(),
        isSopsInstalled: vi.fn().mockReturnValue(true),
      },
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockProcessExit.mockImplementation((code: number) => {
      throw new Error(`Process exit: ${code}`);
    });
  });

  it('errors when no key is provided', async () => {
    const ctx = createMockContext();
    const { setCommand } = await import('../src/commands/set.js');

    try {
      await setCommand(ctx, {
        root: '/root',
        key: undefined,
      });
      expect.fail('Should have exited');
    } catch (e: any) {
      expect(e.message).toBe('Process exit: 1');
    }

    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Usage: hush set'));
  });
});

describe('CLI argument parsing for set command', () => {
  const parseArgs = createParseArgs();

  it('parses hush set KEY VALUE correctly', () => {
    const result = parseArgs(['set', 'MY_KEY', 'my-value']);
    
    expect(result.command).toBe('set');
    expect(result.key).toBe('MY_KEY');
    expect(result.value).toBe('my-value');
  });

  it('parses hush set KEY (no value) for prompting', () => {
    const result = parseArgs(['set', 'MY_KEY']);
    
    expect(result.command).toBe('set');
    expect(result.key).toBe('MY_KEY');
    expect(result.value).toBeUndefined();
  });

  it('parses hush set KEY VALUE -e production correctly', () => {
    const result = parseArgs(['set', 'MY_KEY', 'my-value', '-e', 'production']);
    
    expect(result.command).toBe('set');
    expect(result.key).toBe('MY_KEY');
    expect(result.value).toBe('my-value');
    expect(result.env).toBe('production');
    expect(result.envExplicit).toBe(true);
  });

  it('parses hush set KEY --local correctly', () => {
    const result = parseArgs(['set', 'MY_KEY', '--local']);
    
    expect(result.command).toBe('set');
    expect(result.key).toBe('MY_KEY');
    expect(result.local).toBe(true);
  });

  it('parses hush set KEY --gui correctly', () => {
    const result = parseArgs(['set', 'MY_KEY', '--gui']);
    
    expect(result.command).toBe('set');
    expect(result.key).toBe('MY_KEY');
    expect(result.gui).toBe(true);
  });

  it('parses value with spaces', () => {
    const result = parseArgs(['set', 'MY_KEY', 'value with spaces']);
    
    expect(result.command).toBe('set');
    expect(result.key).toBe('MY_KEY');
    expect(result.value).toBe('value with spaces');
  });

  it('does not swap key and value (regression test)', () => {
    const result = parseArgs(['set', 'DATABASE_URL', 'postgres://localhost/db']);
    
    expect(result.key).toBe('DATABASE_URL');
    expect(result.value).toBe('postgres://localhost/db');
  });
});

function createParseArgs(): (args: string[]) => any {
  return (args: string[]) => {
    let command = '';
    let env: 'development' | 'production' = 'development';
    let envExplicit = false;
    let root = process.cwd();
    let local = false;
    let gui = false;
    let key: string | undefined;
    let value: string | undefined;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '-e' || arg === '--env') {
        const nextArg = args[++i];
        if (nextArg === 'development' || nextArg === 'dev') env = 'development';
        else if (nextArg === 'production' || nextArg === 'prod') env = 'production';
        envExplicit = true;
        continue;
      }

      if (arg === '-r' || arg === '--root') {
        root = args[++i];
        continue;
      }

      if (arg === '--local') {
        local = true;
        continue;
      }

      if (arg === '--gui') {
        gui = true;
        continue;
      }

      if (!command && !arg.startsWith('-')) {
        command = arg;
        continue;
      }

      if (command === 'set' && !arg.startsWith('-')) {
        if (!key) {
          key = arg;
        } else if (!value) {
          value = arg;
        }
        continue;
      }
    }

    return { command, env, envExplicit, root, local, gui, key, value };
  };
}
