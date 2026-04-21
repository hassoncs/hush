import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HushContext, HushV3Repository, StoreContext } from '../src/types.js';

const mocks = vi.hoisted(() => ({
  withMaterializedTarget: vi.fn(),
  requireV3Repository: vi.fn(),
}));

vi.mock('../src/index.js', () => ({
  withMaterializedTarget: mocks.withMaterializedTarget,
}));

vi.mock('../src/commands/v3-command-helpers.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/commands/v3-command-helpers.js')>();
  return {
    ...actual,
    requireV3Repository: mocks.requireV3Repository,
  };
});

import { pushCommand } from '../src/commands/push.js';

function createStore(): StoreContext {
  return {
    mode: 'project',
    root: '/repo',
    configPath: null,
    keyIdentity: 'hush-global',
    displayLabel: '/repo',
  };
}

function createContext(): HushContext {
  return {
    fs: {
      existsSync: vi.fn(() => true),
      readFileSync: vi.fn(),
      writeFileSync: vi.fn(),
      mkdirSync: vi.fn(),
      readdirSync: vi.fn(() => []),
      unlinkSync: vi.fn(),
      rmSync: vi.fn(),
      statSync: vi.fn(),
      renameSync: vi.fn(),
    },
    path: {
      join: (...parts: string[]) => parts.join('/'),
    },
    exec: {
      spawnSync: vi.fn(() => ({ status: 0, stdout: '', stderr: '' })),
      execSync: vi.fn(() => ''),
    },
    logger: {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    },
    process: {
      cwd: () => '/repo',
      exit: ((code: number) => { throw new Error(`Process exit: ${code}`); }) as never,
      env: {},
      stdin: process.stdin,
      stdout: process.stdout,
      on: vi.fn(),
      removeListener: vi.fn(),
    },
    config: {
      loadConfig: vi.fn(),
      findProjectRoot: vi.fn(),
    },
    age: {
      ageAvailable: vi.fn(() => true),
      ageGenerate: vi.fn(),
      keyExists: vi.fn(() => true),
      keySave: vi.fn(),
      keyPath: vi.fn(() => '/tmp/key.txt'),
      keyLoad: vi.fn(),
      agePublicFromPrivate: vi.fn(),
    },
    onepassword: {
      opInstalled: vi.fn(() => false),
      opAvailable: vi.fn(() => false),
      opGetKey: vi.fn(() => null),
      opStoreKey: vi.fn(),
    },
    sops: {
      decrypt: vi.fn(),
      decryptYaml: vi.fn(),
      encrypt: vi.fn(),
      encryptYaml: vi.fn(),
      encryptYamlContent: vi.fn(),
      edit: vi.fn(),
      isSopsInstalled: vi.fn(() => true),
    },
  };
}

describe('pushCommand', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('pushes worker secrets through wrangler args and stdin without shelling values', async () => {
    const ctx = createContext();
    const repository = {
      manifest: {
        targets: {
          worker: {
            format: 'wrangler',
            mode: 'runtime',
          },
        },
        metadata: {
          legacyMigration: {
            targets: [
              { name: 'worker', path: './apps/worker', push_to: { type: 'cloudflare-workers' } },
            ],
          },
        },
      },
    } as unknown as HushV3Repository;

    mocks.requireV3Repository.mockReturnValue(repository);
    mocks.withMaterializedTarget.mockImplementation((_ctx, _options, handler) => handler({
      env: {
        'BAD; touch /tmp/pwned': '$(whoami)\nsecret-value',
      },
    }));

    await pushCommand(ctx, {
      store: createStore(),
      dryRun: false,
      verbose: false,
    });

    expect(ctx.exec.execSync).not.toHaveBeenCalled();
    expect(ctx.exec.spawnSync).toHaveBeenCalledWith(
      'wrangler',
      ['secret', 'put', 'BAD; touch /tmp/pwned'],
      expect.objectContaining({
        cwd: '/repo/apps/worker',
        input: '$(whoami)\nsecret-value',
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }),
    );
  });

  it('uses the pages secret command for migrated cloudflare pages targets', async () => {
    const ctx = createContext();
    const repository = {
      manifest: {
        targets: {
          pages: {
            format: 'wrangler',
            mode: 'runtime',
          },
        },
        metadata: {
          legacyMigration: {
            targets: [
              { name: 'pages', path: './apps/pages', push_to: { type: 'cloudflare-pages', project: 'docs' } },
            ],
          },
        },
      },
    } as unknown as HushV3Repository;

    mocks.requireV3Repository.mockReturnValue(repository);
    mocks.withMaterializedTarget.mockImplementation((_ctx, _options, handler) => handler({
      env: {
        API_KEY: 'secret-value',
      },
    }));

    await pushCommand(ctx, {
      store: createStore(),
      dryRun: false,
      verbose: false,
    });

    expect(ctx.exec.spawnSync).toHaveBeenCalledWith(
      'wrangler',
      ['pages', 'secret', 'put', 'API_KEY', '--project-name', 'docs'],
      expect.objectContaining({
        cwd: '/repo/apps/pages',
        input: 'secret-value',
      }),
    );
  });
});
