import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';
import * as nodeFs from 'node:fs';
import { bootstrapCommand } from '../src/commands/bootstrap.js';
import { configCommand } from '../src/commands/config.js';
import { initCommand } from '../src/commands/init.js';
import { parseArgs } from '../src/cli.js';
import { getActiveIdentity, loadV3Repository } from '../src/index.js';
import { decrypt, decryptYaml, encrypt, encryptYaml, encryptYamlContent, isSopsInstalled } from '../src/core/sops.js';
import type { HushContext, LegacyHushConfig, StoreContext } from '../src/types.js';
import { TEST_AGE_PRIVATE_KEY, TEST_AGE_PUBLIC_KEY, ensureTestSopsEnv } from './helpers/sops-test.js';

const TEST_DIR = join('/tmp', 'hush-test-bootstrap-config');

interface TestHarness {
  ctx: HushContext;
  store: StoreContext;
  logger: {
    log: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
  };
  age: {
    keySave: ReturnType<typeof vi.fn>;
  };
}

function createStore(root: string): StoreContext {
  const stateRoot = join(root, '.machine-state');
  const projectStateRoot = join(stateRoot, 'projects', 'hassoncs-hush-test');

  return {
    mode: 'project',
    root,
    configPath: null,
    keyIdentity: 'hassoncs/hush',
    displayLabel: root,
    projectSlug: 'hassoncs-hush-test',
    stateRoot,
    projectStateRoot,
    activeIdentityPath: join(projectStateRoot, 'active-identity.json'),
    auditLogPath: join(projectStateRoot, 'audit.jsonl'),
  };
}

function createContext(root: string): TestHarness {
  const logger = {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  };

  const age = {
    keySave: vi.fn(),
  };

  ensureTestSopsEnv();

const defaultConfig: LegacyHushConfig = {
    sources: {
      shared: '.hush',
      development: '.hush.development',
      production: '.hush.production',
      local: '.hush.local',
    },
    targets: [{ name: 'root', path: '.', format: 'dotenv' }],
  };

  const ctx: HushContext = {
    fs: {
      existsSync: nodeFs.existsSync,
      readFileSync: nodeFs.readFileSync,
      writeFileSync: nodeFs.writeFileSync,
      mkdirSync: nodeFs.mkdirSync,
      readdirSync: nodeFs.readdirSync as HushContext['fs']['readdirSync'],
      unlinkSync: nodeFs.unlinkSync,
      rmSync: nodeFs.rmSync,
      statSync: nodeFs.statSync,
      renameSync: nodeFs.renameSync,
    },
    path: {
      join,
    },
    exec: {
      spawnSync: vi.fn(() => ({ status: 0, stdout: '', stderr: '' })),
      execSync: vi.fn(() => ''),
    },
    logger,
    process: {
      cwd: () => root,
      exit: (code: number) => {
        throw new Error(`Process exit: ${code}`);
      },
      env: {},
      stdin: process.stdin,
      stdout: process.stdout,
      on: vi.fn(),
      removeListener: vi.fn(),
    },
    config: {
      loadConfig: vi.fn(() => defaultConfig),
      findProjectRoot: vi.fn(() => null),
    },
    age: {
      ageAvailable: vi.fn(() => true),
      ageGenerate: vi.fn(() => ({ private: TEST_AGE_PRIVATE_KEY, public: TEST_AGE_PUBLIC_KEY })),
      keyExists: vi.fn(() => false),
      keySave: age.keySave,
      keyPath: vi.fn(() => '/Users/test/.config/sops/age/keys/hassoncs-hush.txt'),
      keyLoad: vi.fn(() => null),
      agePublicFromPrivate: vi.fn(() => TEST_AGE_PUBLIC_KEY),
    },
    onepassword: {
      opInstalled: vi.fn(() => false),
      opAvailable: vi.fn(() => false),
      opGetKey: vi.fn(() => null),
      opStoreKey: vi.fn(),
    },
    sops: {
      decrypt: vi.fn((filePath: string, options?: { root?: string; keyIdentity?: string }) => decrypt(filePath, options)),
      decryptYaml: vi.fn((filePath: string, options?: { root?: string; keyIdentity?: string }) => decryptYaml(filePath, options)),
      encrypt: vi.fn((inputPath: string, outputPath: string, options?: { root?: string; keyIdentity?: string }) => encrypt(inputPath, outputPath, options)),
      encryptYaml: vi.fn((inputPath: string, outputPath: string, options?: { root?: string; keyIdentity?: string }) => encryptYaml(inputPath, outputPath, options)),
      encryptYamlContent: vi.fn((content: string, outputPath: string, options?: { root?: string; keyIdentity?: string }) => encryptYamlContent(content, outputPath, options)),
      edit: vi.fn(),
      isSopsInstalled: vi.fn(() => isSopsInstalled()),
    },
  };

  return {
    ctx,
    store: createStore(root),
    logger,
    age,
  };
}

describe('bootstrap/config/init task 6', () => {
  beforeEach(() => {
    nodeFs.rmSync(TEST_DIR, { recursive: true, force: true });
    nodeFs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    nodeFs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('bootstraps a v3 repository layout and active identity state', async () => {
    const projectRoot = join(TEST_DIR, 'bootstrap-project');
    nodeFs.mkdirSync(projectRoot, { recursive: true });
    nodeFs.writeFileSync(
      join(projectRoot, 'package.json'),
      JSON.stringify({ repository: 'https://github.com/hassoncs/hush' }),
      'utf-8',
    );

    const { ctx, store } = createContext(projectRoot);

    await bootstrapCommand(ctx, { store });

    expect(nodeFs.existsSync(join(projectRoot, '.hush/manifest.encrypted'))).toBe(true);
    expect(nodeFs.existsSync(join(projectRoot, '.hush/files/env/project/shared.encrypted'))).toBe(true);
    expect(nodeFs.existsSync(join(projectRoot, '.sops.yaml'))).toBe(true);
    expect(nodeFs.existsSync(store.activeIdentityPath ?? '')).toBe(true);

    const repository = loadV3Repository(projectRoot, { keyIdentity: store.keyIdentity });
    expect(Object.keys(repository.manifest.identities)).toEqual(['owner-local', 'member-local', 'ci']);
    expect(repository.manifest.bundles?.project?.files?.[0]?.path).toBe('env/project/shared');
    expect(Object.keys(repository.manifest.targets ?? {})).toEqual(['runtime', 'example']);
    expect(getActiveIdentity(ctx, store)).toBe('owner-local');

    const sopsConfig = nodeFs.readFileSync(join(projectRoot, '.sops.yaml'), 'utf-8');
    expect(sopsConfig).toContain(TEST_AGE_PUBLIC_KEY);
  });

  it('updates config state and file readers through the new config command', async () => {
    const projectRoot = join(TEST_DIR, 'config-project');
    nodeFs.mkdirSync(projectRoot, { recursive: true });
    nodeFs.writeFileSync(
      join(projectRoot, 'package.json'),
      JSON.stringify({ repository: 'https://github.com/hassoncs/hush' }),
      'utf-8',
    );

    const { ctx, store, logger } = createContext(projectRoot);
    await bootstrapCommand(ctx, { store });
    logger.log.mockClear();

    await configCommand(ctx, { store, subcommand: 'show', args: ['identities'] });
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('owner-local:'));

    await configCommand(ctx, { store, subcommand: 'active-identity', args: ['member-local'] });
    expect(getActiveIdentity(ctx, store)).toBe('member-local');

    await configCommand(ctx, { store, subcommand: 'active-identity', args: ['owner-local'] });

    await configCommand(ctx, {
      store,
      subcommand: 'readers',
      args: ['env/project/shared'],
      roles: 'owner,ci',
      identities: 'member-local',
    });

    const repository = loadV3Repository(projectRoot, { keyIdentity: store.keyIdentity });
    expect(repository.filesByPath['env/project/shared']?.readers).toEqual({
      roles: ['owner', 'ci'],
      identities: ['member-local'],
    });
  }, 15000);

  it('denies config readers updates when the active identity is not an owner', async () => {
    const projectRoot = join(TEST_DIR, 'config-readers-owner-gate-project');
    nodeFs.mkdirSync(projectRoot, { recursive: true });
    nodeFs.writeFileSync(
      join(projectRoot, 'package.json'),
      JSON.stringify({ repository: 'https://github.com/hassoncs/hush' }),
      'utf-8',
    );

    const { ctx, store } = createContext(projectRoot);
    await bootstrapCommand(ctx, { store });
    await configCommand(ctx, { store, subcommand: 'active-identity', args: ['member-local'] });

    await expect(configCommand(ctx, {
      store,
      subcommand: 'readers',
      args: ['env/project/shared'],
      roles: 'owner,ci',
    })).rejects.toThrow(/must have the owner role/i);

    const repository = loadV3Repository(projectRoot, { keyIdentity: store.keyIdentity });
    expect(repository.filesByPath['env/project/shared']?.readers).toEqual({
      roles: ['owner', 'member', 'ci'],
      identities: [],
    });
  });

  it('config show files only exposes readable repository file metadata for the active identity', async () => {
    const projectRoot = join(TEST_DIR, 'config-show-gating-project');
    nodeFs.mkdirSync(projectRoot, { recursive: true });
    nodeFs.writeFileSync(
      join(projectRoot, 'package.json'),
      JSON.stringify({ repository: 'https://github.com/hassoncs/hush' }),
      'utf-8',
    );

    const { ctx, store, logger } = createContext(projectRoot);
    await bootstrapCommand(ctx, { store });

    await configCommand(ctx, {
      store,
      subcommand: 'readers',
      args: ['env/project/shared'],
      roles: 'owner',
      identities: 'owner-local',
    });

    logger.log.mockClear();
    await configCommand(ctx, { store, subcommand: 'active-identity', args: ['member-local'] });
    logger.log.mockClear();

    await configCommand(ctx, { store, subcommand: 'show', args: ['files'] });

    const output = logger.log.mock.calls.map(([message]) => String(message)).join('\n');
    expect(output).toBe('[]');
  });

  it('parses config subcommands and reader flags through cli argument parsing', () => {
    const parsed = parseArgs([
      'config',
      'readers',
      'env/project/shared',
      '--roles',
      'owner,ci',
      '--identities',
      'member-local',
    ]);

    expect(parsed.command).toBe('config');
    expect(parsed.subcommand).toBe('readers');
    expect(parsed.positionalArgs).toEqual(['env/project/shared']);
    expect(parsed.roles).toBe('owner,ci');
    expect(parsed.identities).toBe('member-local');
  });

  it('keeps init as a thin deprecated alias to bootstrap', async () => {
    const projectRoot = join(TEST_DIR, 'init-project');
    nodeFs.mkdirSync(projectRoot, { recursive: true });
    nodeFs.writeFileSync(
      join(projectRoot, 'package.json'),
      JSON.stringify({ repository: 'https://github.com/hassoncs/hush' }),
      'utf-8',
    );

    const { ctx, store, logger } = createContext(projectRoot);

    await initCommand(ctx, { store });

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('deprecated'));
    expect(nodeFs.existsSync(join(projectRoot, '.hush/manifest.encrypted'))).toBe(true);
    expect(getActiveIdentity(ctx, store)).toBe('owner-local');
  });
});
