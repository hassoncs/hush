import { join } from 'node:path';
import pc from 'picocolors';
import { stringify as yamlStringify } from 'yaml';
import { HushContext, StoreContext } from '../types.js';
import { opListKeys } from '../lib/onepassword.js';
import { keysList } from '../lib/age.js';
import { getProjectIdentifier } from '../project.js';
import { GLOBAL_STORE_KEY_IDENTITY } from '../store.js';
import { ensureGlobalStoreBootstrap } from '../global-store.js';

export interface KeysOptions {
  store: StoreContext;
  subcommand: string;
  vault?: string;
  force?: boolean;
}

function getProject(ctx: HushContext, store: StoreContext): string {
  if (store.mode === 'global') {
    return GLOBAL_STORE_KEY_IDENTITY;
  }

  const discovered = ctx.config.findProjectRoot(store.root);
  if (discovered?.repositoryKind === 'legacy-v2') {
    const config = ctx.config.loadConfig(discovered.projectRoot);
    if (config.project) {
      return config.project;
    }
  }

  const project = getProjectIdentifier(store.root);
  if (project) {
    return project;
  }

  ctx.logger.error(pc.red('No project identifier found.'));
  ctx.logger.error(pc.dim('Add "project: my-project" to hush.yaml or a GitHub repository field to package.json'));
  ctx.process.exit(1);
}

export async function keysCommand(ctx: HushContext, options: KeysOptions): Promise<void> {
  const { store, subcommand, vault, force } = options;
  const root = store.root;
  
  switch (subcommand) {
    case 'setup': {
      const project = getProject(ctx, store);
      ctx.logger.log(pc.blue(`Setting up keys for ${pc.cyan(project)}...`));
      
      if (ctx.age.keyExists(project)) {
        ctx.logger.log(pc.green('Key already exists locally.'));
        return;
      }
      
      if (ctx.onepassword.opAvailable()) {
        const priv = ctx.onepassword.opGetKey(project);
        if (priv) {
          const pub = ctx.age.agePublicFromPrivate(priv);
          ctx.age.keySave(project, { private: priv, public: pub });
          ctx.logger.log(pc.green('Pulled key from 1Password.'));
          return;
        }
      }

      ctx.logger.log(pc.yellow('No key found. Run "hush keys generate" to create one.'));
      break;
    }
    
    case 'generate': {
      if (!ctx.age.ageAvailable()) {
        ctx.logger.error(pc.red('age not installed. Run: brew install age'));
        ctx.process.exit(1);
      }

      const project = getProject(ctx, store);
      
      if (ctx.age.keyExists(project) && !force) {
        ctx.logger.error(pc.yellow(`Key exists for ${project}. Use --force to overwrite.`));
        ctx.process.exit(1);
      }

      ctx.logger.log(pc.blue(`Generating key for ${pc.cyan(project)}...`));
      const key = ctx.age.ageGenerate();
      ctx.age.keySave(project, key);
      ctx.logger.log(pc.green(`Saved to ${ctx.age.keyPath(project)}`));
      ctx.logger.log(pc.dim(`Public: ${key.public}`));

      if (store.mode === 'global') {
        ensureGlobalStoreBootstrap(ctx, store, key.public);
        ctx.logger.log(pc.green('Bootstrapped ~/.hush'));
      }
      
      if (ctx.onepassword.opAvailable()) {
        try {
          ctx.onepassword.opStoreKey(project, key.private, key.public);
          ctx.logger.log(pc.green('Stored in 1Password.'));
        } catch (e) {
          ctx.logger.warn(pc.yellow(`Could not store in 1Password: ${(e as Error).message}`));
        }
      }

      if (store.mode === 'global') {
        break;
      }

      const sopsPath = join(root, '.sops.yaml');
      if (!ctx.fs.existsSync(sopsPath)) {
        if (!ctx.fs.existsSync(root)) {
          ctx.fs.mkdirSync(root, { recursive: true });
        }
        ctx.fs.writeFileSync(sopsPath, yamlStringify({ creation_rules: [{ encrypted_regex: '.*', age: key.public }] }));
        ctx.logger.log(pc.green('Created .sops.yaml'));
      } else {
        ctx.logger.log(pc.yellow('.sops.yaml exists. Add this public key:'));
        ctx.logger.log(`  ${key.public}`);
      }
      break;
    }
    
    case 'pull': {
      if (!ctx.onepassword.opAvailable()) {
        ctx.logger.error(pc.red('1Password CLI not available or not signed in.'));
        ctx.process.exit(1);
      }

      const project = getProject(ctx, store);
      const priv = ctx.onepassword.opGetKey(project);

      if (!priv) {
        ctx.logger.error(pc.red(`No key in 1Password for ${project}`));
        ctx.process.exit(1);
      }

      const pub = ctx.age.agePublicFromPrivate(priv);
      ctx.age.keySave(project, { private: priv, public: pub });
      ctx.logger.log(pc.green(`Pulled and saved to ${ctx.age.keyPath(project)}`));
      break;
    }
    
    case 'push': {
      if (!ctx.onepassword.opAvailable()) {
        ctx.logger.error(pc.red('1Password CLI not available or not signed in.'));
        ctx.process.exit(1);
      }

      const project = getProject(ctx, store);
      const key = ctx.age.keyLoad(project);

      if (!key) {
        ctx.logger.error(pc.red(`No local key for ${project}`));
        ctx.process.exit(1);
      }

      ctx.onepassword.opStoreKey(project, key.private, key.public);
      ctx.logger.log(pc.green('Pushed to 1Password.'));
      break;
    }
    
    case 'list': {
      ctx.logger.log(pc.blue('Local keys:'));
      for (const k of keysList()) {
        ctx.logger.log(`  ${pc.cyan(k.project)} ${pc.dim(k.public.slice(0, 20))}...`);
      }

      if (ctx.onepassword.opAvailable()) {
        ctx.logger.log(pc.blue('\n1Password keys:'));
        for (const project of opListKeys(vault)) {
          ctx.logger.log(`  ${pc.cyan(project)}`);
        }
      }
      break;
    }

    default:
      ctx.logger.error(pc.red(`Unknown: hush keys ${subcommand}`));
      ctx.logger.log(pc.dim('Commands: setup, generate, pull, push, list'));
      ctx.process.exit(1);
  }
}
