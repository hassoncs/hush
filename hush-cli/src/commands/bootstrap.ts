import { basename, dirname } from 'node:path';
import pc from 'picocolors';
import { stringify as stringifyYaml } from 'yaml';
import type { BootstrapOptions, HushContext, HushV3Repository } from '../types.js';
import {
  V3_SCHEMA_VERSION,
  createFileDocument,
  createManifestDocument,
  getActiveIdentity,
  getV3EncryptedFilePath,
  getV3ManifestPath,
  loadV3Repository,
  setActiveIdentity,
} from '../index.js';
import { getProjectIdentifier } from '../project.js';
import { GLOBAL_STORE_KEY_IDENTITY } from '../store.js';

interface KeySetupResult {
  publicKey: string;
  source: 'existing' | '1password' | 'generated';
}

const DEFAULT_SHARED_FILE_PATH = 'env/project/shared';
const DEFAULT_ACTIVE_IDENTITY = 'owner-local';

function tryExistingLocalKey(ctx: HushContext, project: string): KeySetupResult | null {
  if (!ctx.age.keyExists(project)) {
    return null;
  }

  const existing = ctx.age.keyLoad(project);
  if (!existing) {
    return null;
  }

  ctx.logger.log(pc.green(`Using existing key for ${pc.cyan(project)}`));
  return { publicKey: existing.public, source: 'existing' };
}

async function tryPullFrom1Password(ctx: HushContext, project: string): Promise<KeySetupResult | null> {
  if (!ctx.onepassword.opAvailable()) {
    return null;
  }

  ctx.logger.log(pc.dim('Checking 1Password for existing key...'));
  const privateKey = ctx.onepassword.opGetKey(project);
  if (!privateKey) {
    return null;
  }

  const publicKey = ctx.age.agePublicFromPrivate(privateKey);
  ctx.age.keySave(project, { private: privateKey, public: publicKey });
  ctx.logger.log(pc.green(`Pulled key from 1Password for ${pc.cyan(project)}`));
  return { publicKey, source: '1password' };
}

function generateAndBackupKey(ctx: HushContext, project: string): KeySetupResult {
  if (!ctx.age.ageAvailable()) {
    throw new Error('age is not installed. Install it before bootstrapping a v3 repository.');
  }

  ctx.logger.log(pc.blue(`Generating new key for ${pc.cyan(project)}...`));
  const key = ctx.age.ageGenerate();
  ctx.age.keySave(project, key);
  ctx.logger.log(pc.green(`Saved to ${ctx.age.keyPath(project)}`));

  if (ctx.onepassword.opAvailable()) {
    try {
      ctx.onepassword.opStoreKey(project, key.private, key.public);
      ctx.logger.log(pc.green('Backed up to 1Password.'));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ctx.logger.warn(pc.yellow(`Could not back up to 1Password: ${message}`));
    }
  }

  return { publicKey: key.public, source: 'generated' };
}

function resolveBootstrapProjectIdentity(root: string, keyIdentity: string | undefined, mode: 'project' | 'global'): string {
  if (mode === 'global') {
    return GLOBAL_STORE_KEY_IDENTITY;
  }

  if (keyIdentity) {
    return keyIdentity;
  }

  const detectedProject = getProjectIdentifier(root);
  if (detectedProject) {
    return detectedProject;
  }

  return `local/${basename(root) || 'hush-project'}`;
}

async function setupKey(ctx: HushContext, project: string): Promise<KeySetupResult> {
  return (
    tryExistingLocalKey(ctx, project)
    ?? (await tryPullFrom1Password(ctx, project))
    ?? generateAndBackupKey(ctx, project)
  );
}

function createSopsConfig(ctx: HushContext, root: string, publicKey: string): void {
  const sopsPath = ctx.path.join(root, '.sops.yaml');
  if (ctx.fs.existsSync(sopsPath)) {
    ctx.logger.log(pc.dim('Keeping existing .sops.yaml'));
    return;
  }

  const sopsConfig = stringifyYaml({
    creation_rules: [{ encrypted_regex: '.*', age: publicKey }],
  });

  ctx.fs.writeFileSync(sopsPath, sopsConfig, 'utf-8');
  ctx.logger.log(pc.green('Created .sops.yaml'));
}

function writeYamlDocument(ctx: HushContext, root: string, keyIdentity: string, filePath: string, document: unknown): void {
  ctx.fs.mkdirSync(dirname(filePath), { recursive: true });
  ctx.sops.encryptYamlContent(stringifyYaml(document, { indent: 2 }), filePath, {
    root,
    keyIdentity,
  });
}

function ensureManifestShell(ctx: HushContext, root: string, projectIdentity: string): void {
  const manifestPath = getV3ManifestPath(root);
  if (ctx.fs.existsSync(manifestPath)) {
    return;
  }

  const manifest = createManifestDocument({
    version: V3_SCHEMA_VERSION,
    identities: {
      'owner-local': {
        roles: ['owner'],
        description: 'Default owner identity for local operators',
      },
      'member-local': {
        roles: ['member'],
        description: 'Default member identity for local operators',
      },
      ci: {
        roles: ['ci'],
        description: 'Default automation identity',
      },
    },
    fileIndex: {
      [DEFAULT_SHARED_FILE_PATH]: {
        path: DEFAULT_SHARED_FILE_PATH,
        readers: {
          roles: ['owner', 'member', 'ci'],
          identities: [],
        },
        sensitive: true,
        logicalPaths: [],
      },
    },
    bundles: {
      project: {
        files: [{ path: DEFAULT_SHARED_FILE_PATH }],
      },
    },
    targets: {
      runtime: {
        bundle: 'project',
        format: 'dotenv',
        mode: 'process',
      },
      example: {
        bundle: 'project',
        format: 'dotenv',
        mode: 'example',
      },
    },
    metadata: {
      project: projectIdentity,
    },
  });

  writeYamlDocument(ctx, root, projectIdentity, manifestPath, manifest);
  ctx.logger.log(pc.green('Created .hush/manifest.encrypted'));
}

function ensureSharedFileShell(ctx: HushContext, root: string, projectIdentity: string): void {
  const sharedFilePath = getV3EncryptedFilePath(root, DEFAULT_SHARED_FILE_PATH);
  if (ctx.fs.existsSync(sharedFilePath)) {
    return;
  }

  const sharedFile = createFileDocument({
    path: DEFAULT_SHARED_FILE_PATH,
    readers: {
      roles: ['owner', 'member', 'ci'],
      identities: [],
    },
    sensitive: true,
    entries: {},
  });

  writeYamlDocument(ctx, root, projectIdentity, sharedFilePath, sharedFile);
  ctx.logger.log(pc.green('Created .hush/files/env/project/shared.encrypted'));
}

function ensureActiveIdentity(ctx: HushContext, repository: HushV3Repository, options: BootstrapOptions): string {
  const currentIdentity = getActiveIdentity(ctx, options.store);

  if (currentIdentity && repository.manifest.identities[currentIdentity]) {
    return currentIdentity;
  }

  const nextIdentity = repository.manifest.identities[DEFAULT_ACTIVE_IDENTITY]
    ? DEFAULT_ACTIVE_IDENTITY
    : Object.keys(repository.manifest.identities)[0];

  if (!nextIdentity) {
    throw new Error('Bootstrapped repository is missing declared identities.');
  }

  setActiveIdentity(ctx, {
    store: options.store,
    identity: nextIdentity,
    identities: repository.manifest.identities,
    command: { name: 'bootstrap', args: [] },
  });

  return nextIdentity;
}

export async function bootstrapCommand(ctx: HushContext, options: BootstrapOptions): Promise<void> {
  const root = options.store.root;

  if (!ctx.fs.existsSync(root)) {
    ctx.fs.mkdirSync(root, { recursive: true });
  }

  ctx.logger.log(pc.blue('Bootstrapping Hush v3...\n'));

  const projectIdentity = resolveBootstrapProjectIdentity(root, options.store.keyIdentity, options.store.mode);
  const keyResult = await setupKey(ctx, projectIdentity);

  createSopsConfig(ctx, root, keyResult.publicKey);
  ensureManifestShell(ctx, root, projectIdentity);
  ensureSharedFileShell(ctx, root, projectIdentity);

  const repository = loadV3Repository(root, { keyIdentity: projectIdentity });
  const activeIdentity = ensureActiveIdentity(ctx, repository, options);

  ctx.logger.log(pc.bold('\nBootstrap summary:'));
  ctx.logger.log(pc.dim(`  Key identity: ${projectIdentity}`));
  ctx.logger.log(pc.dim(`  Key source: ${keyResult.source}`));
  ctx.logger.log(pc.dim(`  Active identity: ${activeIdentity}`));
  ctx.logger.log(pc.dim(`  Bundle shells: ${Object.keys(repository.manifest.bundles ?? {}).join(', ') || '(none)'}`));
  ctx.logger.log(pc.dim(`  Target shells: ${Object.keys(repository.manifest.targets ?? {}).join(', ') || '(none)'}`));

  ctx.logger.log(pc.bold('\nNext steps:'));
  ctx.logger.log(pc.dim('  1. hush config show')); 
  ctx.logger.log(pc.dim('  2. hush config active-identity member-local')); 
  ctx.logger.log(pc.dim('  3. hush config readers env/project/shared --roles owner,member,ci')); 
}
