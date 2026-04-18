import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HushContext, StoreContext } from '../src/types.js';
import { parseArgs } from '../src/cli.js';

const setKeyMock = vi.fn();
const platformMock = vi.fn(() => 'darwin');

vi.mock('../src/core/sops.js', () => ({
  setKey: setKeyMock,
}));

vi.mock('node:os', () => ({
  platform: platformMock,
}));

function createMockStdin(overrides: Partial<NodeJS.ReadStream> = {}): NodeJS.ReadStream {
  return {
    isTTY: true,
    setEncoding: vi.fn(),
    on: vi.fn(),
    resume: vi.fn(),
    pause: vi.fn(),
    setRawMode: vi.fn(),
    removeListener: vi.fn(),
    ...overrides,
  } as unknown as NodeJS.ReadStream;
}

function createStore(mode: 'project' | 'global' = 'project'): StoreContext {
  return {
    mode,
    root: mode === 'global' ? '/Users/test/.hush' : '/root',
    configPath: mode === 'global' ? '/Users/test/.hush/hush.yaml' : '/root/hush.yaml',
    keyIdentity: mode === 'global' ? 'hush-global' : 'test/repo',
    displayLabel: mode === 'global' ? '~/.hush' : '/root',
  };
}

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
        stdin: createMockStdin(),
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
        encrypt: vi.fn(),
        edit: vi.fn(),
        isSopsInstalled: vi.fn().mockReturnValue(true),
      },
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    platformMock.mockReturnValue('darwin');
    mockProcessExit.mockImplementation((code: number) => {
      throw new Error(`Process exit: ${code}`);
    });
  });

  it('errors when no key is provided', async () => {
    const ctx = createMockContext();
    const { setCommand } = await import('../src/commands/set.js');

    try {
      await setCommand(ctx, {
        store: createStore(),
        key: undefined,
      });
      expect.fail('Should have exited');
    } catch (e: any) {
      expect(e.message).toBe('Process exit: 1');
    }

    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Usage: hush set'));
  });

  it('prefers GUI prompt over piped stdin when --gui is set', async () => {
    const ctx = createMockContext();
    const execSync = vi.fn().mockReturnValue('gui-secret\n');

    ctx.exec.execSync = execSync;
    ctx.process.stdin = createMockStdin({
      isTTY: false,
    });

    const { setCommand } = await import('../src/commands/set.js');

    await setCommand(ctx, {
      store: createStore(),
      key: 'API_KEY',
      gui: true,
    });

    expect(execSync).toHaveBeenCalledOnce();
    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('text returned of (display dialog'),
      expect.objectContaining({
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    );
    expect(execSync).toHaveBeenCalledWith(expect.stringContaining('with hidden answer'), expect.anything());
    expect(setKeyMock).toHaveBeenCalledWith('/root/.hush.encrypted', 'API_KEY', 'gui-secret', {
      root: '/root',
      keyIdentity: 'test/repo',
    });
  });

  it('uses the inline value even when --gui is requested', async () => {
    const ctx = createMockContext();
    const execSync = vi.fn();

    ctx.exec.execSync = execSync;

    const { setCommand } = await import('../src/commands/set.js');

    await setCommand(ctx, {
      store: createStore(),
      key: 'API_KEY',
      value: 'inline-secret',
      gui: true,
    });

    expect(execSync).not.toHaveBeenCalled();
    expect(setKeyMock).toHaveBeenCalledWith('/root/.hush.encrypted', 'API_KEY', 'inline-secret', {
      root: '/root',
      keyIdentity: 'test/repo',
    });
  });

  it('surfaces macOS dialog launch failures instead of treating them as empty input', async () => {
    const ctx = createMockContext();
    const error = Object.assign(new Error('execution error'), {
      stderr: 'not authorized to send Apple events to System Events',
    });

    ctx.exec.execSync = vi.fn().mockImplementation(() => {
      throw error;
    });

    const { setCommand } = await import('../src/commands/set.js');

    await expect(
      setCommand(ctx, {
        store: createStore(),
        key: 'API_KEY',
        gui: true,
      })
    ).rejects.toThrow('macOS dialog failed: not authorized to send Apple events to System Events');

    expect(mockConsoleError).not.toHaveBeenCalledWith(expect.stringContaining('No value entered, aborting'));
  });

  it('treats dialog cancellation as cancellation instead of a generic GUI failure', async () => {
    const ctx = createMockContext();
    const error = Object.assign(new Error('execution error'), {
      stderr: 'User canceled.',
    });

    ctx.exec.execSync = vi.fn().mockImplementation(() => {
      throw error;
    });

    const { setCommand } = await import('../src/commands/set.js');

    try {
      await setCommand(ctx, {
        store: createStore(),
        key: 'API_KEY',
        gui: true,
      });
      expect.fail('Should have exited');
    } catch (e: any) {
      expect(e.message).toBe('Process exit: 1');
    }

    expect(ctx.logger.log).toHaveBeenCalledWith(expect.stringContaining('Cancelled'));
  });

  it('bootstraps the global store from the hush-global key before setting a secret', async () => {
    const ctx = createMockContext();
    const { setCommand } = await import('../src/commands/set.js');

    const existingPaths = new Set<string>(['/keys/hush-global.txt']);
    const existsSync = vi.fn((path: string) => existingPaths.has(path));

    ctx.fs.existsSync = existsSync;
    ctx.fs.mkdirSync = vi.fn((path: string) => {
      existingPaths.add(path);
      return path;
    });
    ctx.fs.writeFileSync = vi.fn((path: string) => {
      existingPaths.add(path);
    });
    ctx.age.keyLoad = vi.fn().mockReturnValue({
      private: 'AGE-SECRET-KEY-EXAMPLE',
      public: 'age1globalpublickey',
    });

    await setCommand(ctx, {
      store: createStore('global'),
      key: 'OPENAI_API_KEY',
      value: 'secret-value',
    });

    expect(ctx.fs.mkdirSync).toHaveBeenCalledWith('/Users/test/.hush', { recursive: true });
    expect(ctx.fs.writeFileSync).toHaveBeenCalledWith(
      '/Users/test/.hush/hush.yaml',
      expect.stringContaining('sources:'),
      'utf-8',
    );
    expect(ctx.fs.writeFileSync).toHaveBeenCalledWith(
      '/Users/test/.hush/.sops.yaml',
      expect.stringContaining('age1globalpublickey'),
      'utf-8',
    );
    expect(setKeyMock).toHaveBeenCalledWith('/Users/test/.hush/.hush.encrypted', 'OPENAI_API_KEY', 'secret-value', {
      root: '/Users/test/.hush',
      keyIdentity: 'hush-global',
    });
  });
});

describe('CLI argument parsing for set command', () => {
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

  it('parses hush set --global KEY correctly', () => {
    const result = parseArgs(['set', '--global', 'MY_KEY']);

    expect(result.command).toBe('set');
    expect(result.key).toBe('MY_KEY');
    expect(result.global).toBe(true);
  });

  it('parses hush set KEY VALUE --global correctly', () => {
    const result = parseArgs(['set', 'MY_KEY', 'my-value', '--global']);

    expect(result.command).toBe('set');
    expect(result.key).toBe('MY_KEY');
    expect(result.value).toBe('my-value');
    expect(result.global).toBe(true);
  });

  it('parses hush set KEY VALUE --local correctly', () => {
    const result = parseArgs(['set', 'MY_KEY', 'my-value', '--local']);

    expect(result.command).toBe('set');
    expect(result.key).toBe('MY_KEY');
    expect(result.value).toBe('my-value');
    expect(result.local).toBe(true);
  });

  it('parses hush set KEY VALUE --gui correctly', () => {
    const result = parseArgs(['set', 'MY_KEY', 'my-value', '--gui']);

    expect(result.command).toBe('set');
    expect(result.key).toBe('MY_KEY');
    expect(result.value).toBe('my-value');
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
