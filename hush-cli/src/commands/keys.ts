import { join } from 'node:path';
import pc from 'picocolors';
import { stringify as yamlStringify } from 'yaml';
import { HushContext } from '../types.js';
import { opAvailable, opGetKey, opStoreKey, opListKeys } from '../lib/onepassword.js';
import { ageAvailable, ageGenerate, agePublicFromPrivate, keyExists, keySave, keyLoad, keysList, keyPath } from '../lib/age.js';

export interface KeysOptions {
  root: string;
  subcommand: string;
  vault?: string;
  force?: boolean;
}

function getProject(ctx: HushContext, root: string): string {
  const config = ctx.config.loadConfig(root);
  if (config.project) return config.project;

  const pkgPath = join(root, 'package.json');
  if (ctx.fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(ctx.fs.readFileSync(pkgPath, 'utf-8') as string);
    if (typeof pkg.repository === 'string') {
      const match = pkg.repository.match(/github\.com[/:]([\w-]+\/[\w-]+)/);
      if (match) return match[1];
    }
    if (pkg.repository?.url) {
      const match = pkg.repository.url.match(/github\.com[/:]([\w-]+\/[\w-]+)/);
      if (match) return match[1];
    }
  }

  ctx.logger.error(pc.red('No project identifier found.'));
  ctx.logger.error(pc.dim('Add "project: my-project" to hush.yaml'));
  ctx.process.exit(1);
}

export async function keysCommand(ctx: HushContext, options: KeysOptions): Promise<void> {
  const { root, subcommand, vault, force } = options;
  
  switch (subcommand) {
    case 'setup': {
      const project = getProject(ctx, root);
      ctx.logger.log(pc.blue(`Setting up keys for ${pc.cyan(project)}...`));
      
      if (keyExists(project)) {
        ctx.logger.log(pc.green('Key already exists locally.'));
        return;
      }
      
      if (opAvailable()) {
        const priv = opGetKey(project, vault);
        if (priv) {
          const pub = agePublicFromPrivate(priv);
          keySave(project, { private: priv, public: pub });
          ctx.logger.log(pc.green('Pulled key from 1Password.'));
          return;
        }
      }

      ctx.logger.log(pc.yellow('No key found. Run "hush keys generate" to create one.'));
      break;
    }
    
    case 'generate': {
      if (!ageAvailable()) {
        ctx.logger.error(pc.red('age not installed. Run: brew install age'));
        ctx.process.exit(1);
      }

      const project = getProject(ctx, root);
      
      if (keyExists(project) && !force) {
        ctx.logger.error(pc.yellow(`Key exists for ${project}. Use --force to overwrite.`));
        ctx.process.exit(1);
      }

      ctx.logger.log(pc.blue(`Generating key for ${pc.cyan(project)}...`));
      const key = ageGenerate();
      keySave(project, key);
      ctx.logger.log(pc.green(`Saved to ${keyPath(project)}`));
      ctx.logger.log(pc.dim(`Public: ${key.public}`));
      
      if (opAvailable()) {
        try {
          opStoreKey(project, key.private, key.public, vault);
          ctx.logger.log(pc.green('Stored in 1Password.'));
        } catch (e) {
          ctx.logger.warn(pc.yellow(`Could not store in 1Password: ${(e as Error).message}`));
        }
      }

      const sopsPath = join(root, '.sops.yaml');
      if (!ctx.fs.existsSync(sopsPath)) {
        ctx.fs.writeFileSync(sopsPath, yamlStringify({ creation_rules: [{ encrypted_regex: '.*', age: key.public }] }));
        ctx.logger.log(pc.green('Created .sops.yaml'));
      } else {
        ctx.logger.log(pc.yellow('.sops.yaml exists. Add this public key:'));
        ctx.logger.log(`  ${key.public}`);
      }
      break;
    }
    
    case 'pull': {
      if (!opAvailable()) {
        ctx.logger.error(pc.red('1Password CLI not available or not signed in.'));
        ctx.process.exit(1);
      }

      const project = getProject(ctx, root);
      const priv = opGetKey(project, vault);

      if (!priv) {
        ctx.logger.error(pc.red(`No key in 1Password for ${project}`));
        ctx.process.exit(1);
      }

      const pub = agePublicFromPrivate(priv);
      keySave(project, { private: priv, public: pub });
      ctx.logger.log(pc.green(`Pulled and saved to ${keyPath(project)}`));
      break;
    }
    
    case 'push': {
      if (!opAvailable()) {
        ctx.logger.error(pc.red('1Password CLI not available or not signed in.'));
        ctx.process.exit(1);
      }

      const project = getProject(ctx, root);
      const key = keyLoad(project);

      if (!key) {
        ctx.logger.error(pc.red(`No local key for ${project}`));
        ctx.process.exit(1);
      }

      opStoreKey(project, key.private, key.public, vault);
      ctx.logger.log(pc.green('Pushed to 1Password.'));
      break;
    }
    
    case 'list': {
      ctx.logger.log(pc.blue('Local keys:'));
      for (const k of keysList()) {
        ctx.logger.log(`  ${pc.cyan(k.project)} ${pc.dim(k.public.slice(0, 20))}...`);
      }

      if (opAvailable()) {
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
