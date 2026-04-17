import { stringify as yamlStringify } from 'yaml';
import type { HushConfig, HushContext, StoreContext, Target } from './types.js';
import { DEFAULT_SOURCES } from './types.js';

const GLOBAL_STORE_TARGETS: Target[] = [{ name: 'root', path: '.', format: 'dotenv' }];

function buildGlobalConfig(): string {
  const config: HushConfig = {
    version: 2,
    sources: DEFAULT_SOURCES,
    targets: GLOBAL_STORE_TARGETS,
  };

  return '# yaml-language-server: $schema=https://unpkg.com/@chriscode/hush/schema.json\n' + yamlStringify(config, { indent: 2 });
}

function buildSopsConfig(publicKey: string): string {
  return yamlStringify({
    creation_rules: [{ encrypted_regex: '.*', age: publicKey }],
  });
}

export function ensureGlobalStoreBootstrap(
  ctx: HushContext,
  store: StoreContext,
  publicKey?: string,
): { hasKey: boolean } {
  if (store.mode !== 'global') {
    return { hasKey: false };
  }

  if (!ctx.fs.existsSync(store.root)) {
    ctx.fs.mkdirSync(store.root, { recursive: true });
  }

  const configPath = ctx.path.join(store.root, 'hush.yaml');
  if (!ctx.fs.existsSync(configPath)) {
    ctx.fs.writeFileSync(configPath, buildGlobalConfig(), 'utf-8');
  }

  const key = publicKey
    ? { public: publicKey }
    : store.keyIdentity
      ? ctx.age.keyLoad(store.keyIdentity)
      : null;

  if (key) {
    const sopsPath = ctx.path.join(store.root, '.sops.yaml');
    if (!ctx.fs.existsSync(sopsPath)) {
      ctx.fs.writeFileSync(sopsPath, buildSopsConfig(key.public), 'utf-8');
    }
  }

  return { hasKey: key !== null };
}
