import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dirname, join } from 'node:path';
import * as nodeFs from 'node:fs';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

vi.mock('node:readline', () => ({
  createInterface: vi.fn(() => ({
    question: (_prompt: string, callback: (answer: string) => void) => callback('yes'),
    close: vi.fn(),
  })),
}));

import { check, checkCommand } from '../src/commands/check.js';
import { decryptCommand } from '../src/commands/decrypt.js';
import { editCommand } from '../src/commands/edit.js';
import { hasCommand } from '../src/commands/has.js';
import { listCommand } from '../src/commands/list.js';
import { pushCommand } from '../src/commands/push.js';
import { runCommand } from '../src/commands/run.js';
import { setCommand } from '../src/commands/set.js';
import {
  createProjectSlug,
  createFileDocument,
  createFileIndexEntry,
  createManifestDocument,
  loadV3Repository,
  setActiveIdentity,
} from '../src/index.js';
import { decrypt, decryptYaml, encrypt, encryptYaml, encryptYamlContent, isSopsInstalled } from '../src/core/sops.js';
import type { HushContext, HushManifestDocument, LegacyHushConfig, StoreContext } from '../src/types.js';
import { getMachineLocalOverridePath } from '../src/commands/v3-command-helpers.js';
import { ensureTestSopsEnv, readDecryptedYamlFile, writeEncryptedYamlFile } from './helpers/sops-test.js';

const TEST_DIR = join('/tmp', 'hush-test-runtime-v3');

function stripAnsi(value: string): string {
  return value.replace(new RegExp(String.raw`\u001B\[[0-9;]*m`, 'g'), '');
}

function normalizeYaml(content: string): string {
  const lines = content.replace(/\r\n/g, '\n').split('\n');

  while (lines[0] !== undefined && lines[0].trim() === '') {
    lines.shift();
  }

  while (lines.at(-1) !== undefined && lines.at(-1)?.trim() === '') {
    lines.pop();
  }

  const indent = lines
    .filter((line) => line.trim().length > 0)
    .reduce<number>((smallest, line) => {
      const match = line.match(/^\s*/);
      return Math.min(smallest, match?.[0].length ?? 0);
    }, Number.POSITIVE_INFINITY);

  return lines.map((line) => line.slice(Number.isFinite(indent) ? indent : 0)).join('\n');
}

function createStore(root: string): StoreContext {
  const projectSlug = createProjectSlug(root);
  const stateRoot = join(TEST_DIR, '.machine-state');
  const projectStateRoot = join(stateRoot, 'projects', projectSlug);

  return {
    mode: 'project',
    root,
    configPath: null,
    keyIdentity: root,
    displayLabel: root,
    projectSlug,
    stateRoot,
    projectStateRoot,
    activeIdentityPath: join(projectStateRoot, 'active-identity.json'),
    auditLogPath: join(projectStateRoot, 'audit.jsonl'),
  };
}

function createContext(root: string) {
  ensureTestSopsEnv();

  const logger = {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  };

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
      env: { EDITOR: 'true' },
      stdin: {
        isTTY: true,
        setEncoding: vi.fn(),
        on: vi.fn(),
        resume: vi.fn(),
        pause: vi.fn(),
        setRawMode: vi.fn(),
        removeListener: vi.fn(),
      } as unknown as NodeJS.ReadStream,
      stdout: { write: vi.fn() } as any,
      on: vi.fn(),
      removeListener: vi.fn(),
    },
    config: {
      loadConfig: vi.fn(() => defaultConfig),
      findProjectRoot: vi.fn(() => null),
    },
    age: {
      ageAvailable: vi.fn(() => true),
      ageGenerate: vi.fn(() => ({ private: 'private', public: 'public' })),
      keyExists: vi.fn(() => false),
      keySave: vi.fn(),
      keyPath: vi.fn(() => ''),
      keyLoad: vi.fn(() => null),
      agePublicFromPrivate: vi.fn(() => 'public'),
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

  return { ctx, logger, store: createStore(root) };
}

function writeRepo(root: string, manifest: string, files: Record<string, string>) {
  nodeFs.mkdirSync(join(root, '.hush', 'files'), { recursive: true });

  const parsedFiles = Object.values(files).map((content) => createFileDocument(parseYaml(normalizeYaml(content))));
  const manifestDocument = createManifestDocument({
    ...(parseYaml(normalizeYaml(manifest)) as Record<string, unknown>),
    fileIndex: Object.fromEntries(parsedFiles.map((file) => [file.path, createFileIndexEntry(file)])),
  } as HushManifestDocument);
  writeEncryptedYamlFile(root, join(root, '.hush', 'manifest.encrypted'), stringifyYaml(manifestDocument, { indent: 2 }));

  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = join(root, '.hush', 'files', `${relativePath}.encrypted`);
    writeEncryptedYamlFile(root, filePath, normalizeYaml(content));
  }

  return loadV3Repository(root, { keyIdentity: root });
}

function setIdentity(ctx: HushContext, store: StoreContext, repository: ReturnType<typeof loadV3Repository>, identity: string): void {
  setActiveIdentity(ctx, {
    store,
    identity,
    identities: repository.manifest.identities,
    command: { name: 'config', args: ['active-identity', identity] },
  });
}

function getLogOutput(logger: { log: ReturnType<typeof vi.fn> }): string {
  return stripAnsi(logger.log.mock.calls.map(([message]) => String(message)).join('\n'));
}

describe('task 8 v3 runtime and mutating commands', () => {
  beforeEach(() => {
    nodeFs.rmSync(TEST_DIR, { recursive: true, force: true });
    nodeFs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    nodeFs.rmSync(TEST_DIR, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('run materializes a v3 target and injects env vars into the child process', async () => {
    const root = join(TEST_DIR, 'run-project');
    const repository = writeRepo(
      root,
      `
      version: 3
      identities:
        developer-local:
          roles: [owner]
      bundles:
        app:
          files:
            - path: env/app/shared
      targets:
        app-dev:
          bundle: app
          format: dotenv
      `,
      {
        'env/app/shared': `
          path: env/app/shared
          readers:
            roles: [owner]
            identities: [developer-local]
          sensitive: false
          entries:
            env/apps/api/env/API_URL:
              value: https://example.com
              sensitive: false
        `,
      },
    );
    const { ctx, store } = createContext(root);
    ctx.process.env.API_URL = 'https://ambient.example.com';
    setIdentity(ctx, store, repository, 'developer-local');

    await expect(runCommand(ctx, {
      store,
      cwd: root,
      env: 'development',
      command: ['echo', 'ok'],
    })).rejects.toThrow('Process exit: 0');

    expect(ctx.exec.spawnSync).toHaveBeenCalledWith(
      'echo',
      ['ok'],
      expect.objectContaining({
        cwd: root,
        env: expect.objectContaining({
          API_URL: 'https://example.com',
        }),
      }),
    );
  });

  it('run denies unreadable files before decrypting malformed file docs', async () => {
    const root = join(TEST_DIR, 'run-acl-before-decrypt');
    nodeFs.mkdirSync(join(root, '.hush', 'files', 'env', 'app'), { recursive: true });
    writeEncryptedYamlFile(
      root,
      join(root, '.hush', 'manifest.encrypted'),
      stringifyYaml(createManifestDocument({
        version: 3,
        identities: {
          'owner-local': { roles: ['owner'] },
          'member-local': { roles: ['member'] },
        },
        fileIndex: {
          'env/app/shared': {
            path: 'env/app/shared',
            readers: { roles: ['owner', 'member'], identities: [] },
            sensitive: false,
            logicalPaths: ['env/apps/api/env/PUBLIC_URL'],
          },
          'env/app/secrets': {
            path: 'env/app/secrets',
            readers: { roles: ['owner'], identities: [] },
            sensitive: true,
            logicalPaths: ['env/apps/api/env/API_KEY'],
          },
        },
        bundles: {
          app: {
            files: [{ path: 'env/app/shared' }, { path: 'env/app/secrets' }],
          },
        },
        targets: {
          runtime: {
            bundle: 'app',
            format: 'dotenv',
          },
        },
      } as HushManifestDocument), { indent: 2 }),
    );
    writeEncryptedYamlFile(
      root,
      join(root, '.hush', 'files', 'env', 'app', 'shared.encrypted'),
      normalizeYaml(`
        path: env/app/shared
        readers:
          roles: [owner, member]
          identities: []
        sensitive: false
        entries:
          env/apps/api/env/PUBLIC_URL:
            value: https://example.com
            sensitive: false
      `),
    );
    writeEncryptedYamlFile(
      root,
      join(root, '.hush', 'files', 'env', 'app', 'secrets.encrypted'),
      normalizeYaml(`
        path: env/app/not-secrets
        readers:
          roles: [owner]
          identities: []
        sensitive: true
        entries:
          env/apps/api/env/API_KEY:
            value: secret
            sensitive: true
      `),
    );
    const repository = loadV3Repository(root, { keyIdentity: root });
    const { ctx, store, logger } = createContext(root);
    setIdentity(ctx, store, repository, 'member-local');

    await expect(runCommand(ctx, {
      store,
      cwd: root,
      env: 'development',
      command: ['echo', 'ok'],
    })).rejects.toThrow('Process exit: 1');

    expect(ctx.exec.spawnSync).not.toHaveBeenCalled();
    expect(stripAnsi(logger.error.mock.calls.map(([message]) => String(message)).join('\n'))).toMatch(/requires unreadable file/);
    expect(stripAnsi(logger.error.mock.calls.map(([message]) => String(message)).join('\n'))).not.toMatch(/Invalid v3 file document/);
  }, 15000);

  it('set writes v3 file docs and machine-local override docs instead of legacy sources', async () => {
    const root = join(TEST_DIR, 'set-project');
    const repository = writeRepo(
      root,
      `
      version: 3
      identities:
        owner-local:
          roles: [owner]
      bundles:
        project:
          files:
            - path: env/project/shared
      targets:
        runtime:
          bundle: project
          format: dotenv
      `,
      {
        'env/project/shared': `
          path: env/project/shared
          readers:
            roles: [owner]
            identities: [owner-local]
          sensitive: true
          entries: {}
        `,
      },
    );
    const { ctx, store } = createContext(root);
    setIdentity(ctx, store, repository, 'owner-local');

    await setCommand(ctx, {
      store,
      file: 'shared',
      key: 'DATABASE_URL',
      value: 'postgres://db',
    });

    await setCommand(ctx, {
      store,
      file: 'local',
      key: 'DEBUG',
      value: 'true',
    });

    const reloaded = loadV3Repository(root, { keyIdentity: root });
    expect(reloaded.loadFile('env/project/shared').entries['env/project/shared/DATABASE_URL']).toMatchObject({
      value: 'postgres://db',
      sensitive: true,
    });

    const localOverridePath = getMachineLocalOverridePath(store);
    const localOverride = readDecryptedYamlFile(root, localOverridePath);
    expect(localOverride).toContain('path: env/project/local');
    expect(localOverride).toContain('env/project/local/DEBUG');
  }, 15000);

  it('edit opens the v3 yaml document directly and keeps it valid', async () => {
    const root = join(TEST_DIR, 'edit-project');
    const repository = writeRepo(
      root,
      `
      version: 3
      identities:
        owner-local:
          roles: [owner]
      bundles:
        project:
          files:
            - path: env/project/shared
      targets:
        runtime:
          bundle: project
          format: dotenv
      `,
      {
        'env/project/shared': `
          path: env/project/shared
          readers:
            roles: [owner]
            identities: [owner-local]
          sensitive: true
          entries:
            env/project/shared/API_KEY:
              value: secret
              sensitive: true
        `,
      },
    );
    const { ctx, store } = createContext(root);
    setIdentity(ctx, store, repository, 'owner-local');

    let stagedPath = '';
    const execSyncMock = ctx.exec.execSync as ReturnType<typeof vi.fn>;
    execSyncMock.mockImplementation((command: string) => {
      const match = command.match(/"([^"]+\.yaml)"$/);
      expect(match?.[1]).toBeTruthy();
      stagedPath = match![1]!;

      const stagedStat = nodeFs.statSync(stagedPath);
      const stagedDirStat = nodeFs.statSync(dirname(stagedPath));
      expect(stagedStat.mode & 0o777).toBe(0o600);
      expect(stagedDirStat.mode & 0o777).toBe(0o700);

      return '';
    });

    await editCommand(ctx, { store, file: 'shared' });

    expect(ctx.exec.execSync).toHaveBeenCalledWith(
      expect.stringContaining('.yaml'),
      expect.objectContaining({ stdio: 'inherit', shell: '/bin/bash' }),
    );
    expect(nodeFs.existsSync(stagedPath)).toBe(false);
  });

  it('has and list resolve values from the v3 runtime target view', async () => {
    const root = join(TEST_DIR, 'query-project');
    const repository = writeRepo(
      root,
      `
      version: 3
      identities:
        developer-local:
          roles: [owner]
      bundles:
        app:
          files:
            - path: env/app/shared
      targets:
        app-dev:
          bundle: app
          format: dotenv
      `,
      {
        'env/app/shared': `
          path: env/app/shared
          readers:
            roles: [owner]
            identities: [developer-local]
          sensitive: false
          entries:
            env/apps/web/env/NEXT_PUBLIC_API_URL:
              value: https://example.com
              sensitive: false
        `,
      },
    );
    const { ctx, logger, store } = createContext(root);
    setIdentity(ctx, store, repository, 'developer-local');

    await expect(hasCommand(ctx, { store, env: 'development', key: 'NEXT_PUBLIC_API_URL', quiet: false })).rejects.toThrow('Process exit: 0');
    await listCommand(ctx, { store, env: 'development' });

    const output = getLogOutput(logger);
    expect(output).toContain('NEXT_PUBLIC_API_URL is set');
    expect(output).toContain('Variables for target app-dev');
    expect(output).toContain('NEXT_PUBLIC_API_URL=https://example.com');
  });

  it('check validates the v3 repository and flags leftover legacy/plaintext artifacts', async () => {
    const root = join(TEST_DIR, 'check-project');
    writeRepo(
      root,
      `
      version: 3
      identities:
        owner-local:
          roles: [owner]
      bundles:
        project:
          files:
            - path: env/project/shared
      targets:
        runtime:
          bundle: project
          format: dotenv
      `,
      {
        'env/project/shared': `
          path: env/project/shared
          readers:
            roles: [owner]
            identities: [owner-local]
          sensitive: true
          entries: {}
        `,
      },
    );
    nodeFs.writeFileSync(join(root, 'hush.yaml'), 'version: 2\n', 'utf-8');
    nodeFs.writeFileSync(join(root, '.env'), 'SECRET=value\n', 'utf-8');

    const { ctx, logger, store } = createContext(root);
    const result = await check(ctx, {
      store,
      warn: false,
      json: false,
      quiet: false,
      onlyChanged: false,
      requireSource: false,
      allowPlaintext: false,
    });

    expect(result.status).toBe('plaintext');
    expect(result.plaintextFiles?.map((entry) => entry.file)).toEqual(['.env', 'hush.yaml']);

    await expect(checkCommand(ctx, {
      store,
      warn: false,
      json: false,
      quiet: false,
      onlyChanged: false,
      requireSource: false,
      allowPlaintext: false,
    })).rejects.toThrow('Process exit: 4');

    expect(getLogOutput(logger)).toContain('LEFTOVER PLAINTEXT OR LEGACY ARTIFACTS DETECTED');
  });

  it('push uses v3 wrangler targets through the shared materializer', async () => {
    const root = join(TEST_DIR, 'push-project');
    const repository = writeRepo(
      root,
      `
      version: 3
      identities:
        ci:
          roles: [ci]
      bundles:
        api:
          files:
            - path: env/app/shared
      targets:
        api-workers:
          bundle: api
          format: wrangler
      `,
      {
        'env/app/shared': `
          path: env/app/shared
          readers:
            roles: [ci]
            identities: [ci]
          sensitive: true
          entries:
            env/apps/api/env/API_TOKEN:
              value: secret-token
              sensitive: true
        `,
      },
    );
    const { ctx, logger, store } = createContext(root);
    setIdentity(ctx, store, repository, 'ci');

    await pushCommand(ctx, {
      store,
      dryRun: true,
      verbose: true,
      target: 'api-workers',
    });

    expect(ctx.exec.execSync).not.toHaveBeenCalled();
    expect(getLogOutput(logger)).toContain('Would push api-workers');
    expect(getLogOutput(logger)).toContain('API_TOKEN');
  }, 15000);

  it('decrypt --force writes persisted artifacts under the guarded output root', async () => {
    const root = join(TEST_DIR, 'decrypt-project');
    const repository = writeRepo(
      root,
      `
      version: 3
      identities:
        owner-local:
          roles: [owner]
      bundles:
        project:
          files:
            - path: env/project/shared
      targets:
        runtime:
          bundle: project
          format: dotenv
      `,
      {
        'env/project/shared': `
          path: env/project/shared
          readers:
            roles: [owner]
            identities: [owner-local]
          sensitive: true
          entries:
            env/project/shared/API_KEY:
              value: test-secret
              sensitive: true
        `,
      },
    );
    const { ctx, store } = createContext(root);
    setIdentity(ctx, store, repository, 'owner-local');

    await decryptCommand(ctx, {
      store,
      env: 'development',
      force: true,
    });

    const persistedTarget = join(root, '.hush-materialized', 'targets', 'runtime.env');
    expect(nodeFs.existsSync(persistedTarget)).toBe(true);
    expect(nodeFs.readFileSync(persistedTarget, 'utf-8')).toContain('API_KEY=test-secret');
  });
});
