import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { stringify as yamlStringify } from 'yaml';
import { loadConfig } from '../config/loader.js';
import { opAvailable, opGetKey, opStoreKey, opListKeys } from '../lib/onepassword.js';
import { ageAvailable, ageGenerate, agePublicFromPrivate, keyExists, keySave, keyLoad, keysList, keyPath } from '../lib/age.js';

export interface KeysOptions {
  root: string;
  subcommand: string;
  vault?: string;
  force?: boolean;
}

function getProject(root: string): string {
  const config = loadConfig(root);
  if (config.project) return config.project;
  
  const pkgPath = join(root, 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    if (typeof pkg.repository === 'string') {
      const match = pkg.repository.match(/github\.com[/:]([\w-]+\/[\w-]+)/);
      if (match) return match[1];
    }
    if (pkg.repository?.url) {
      const match = pkg.repository.url.match(/github\.com[/:]([\w-]+\/[\w-]+)/);
      if (match) return match[1];
    }
  }
  
  console.error(pc.red('No project identifier found.'));
  console.error(pc.dim('Add "project: my-project" to hush.yaml'));
  process.exit(1);
}

export async function keysCommand(options: KeysOptions): Promise<void> {
  const { root, subcommand, vault, force } = options;
  
  switch (subcommand) {
    case 'setup': {
      const project = getProject(root);
      console.log(pc.blue(`Setting up keys for ${pc.cyan(project)}...`));
      
      if (keyExists(project)) {
        console.log(pc.green('Key already exists locally.'));
        return;
      }
      
      if (opAvailable()) {
        const priv = opGetKey(project, vault);
        if (priv) {
          const pub = agePublicFromPrivate(priv);
          keySave(project, { private: priv, public: pub });
          console.log(pc.green('Pulled key from 1Password.'));
          return;
        }
      }
      
      console.log(pc.yellow('No key found. Run "hush keys generate" to create one.'));
      break;
    }
    
    case 'generate': {
      if (!ageAvailable()) {
        console.error(pc.red('age not installed. Run: brew install age'));
        process.exit(1);
      }
      
      const project = getProject(root);
      
      if (keyExists(project) && !force) {
        console.error(pc.yellow(`Key exists for ${project}. Use --force to overwrite.`));
        process.exit(1);
      }
      
      console.log(pc.blue(`Generating key for ${pc.cyan(project)}...`));
      const key = ageGenerate();
      keySave(project, key);
      console.log(pc.green(`Saved to ${keyPath(project)}`));
      console.log(pc.dim(`Public: ${key.public}`));
      
      if (opAvailable()) {
        try {
          opStoreKey(project, key.private, key.public, vault);
          console.log(pc.green('Stored in 1Password.'));
        } catch (e) {
          console.warn(pc.yellow(`Could not store in 1Password: ${(e as Error).message}`));
        }
      }
      
      const sopsPath = join(root, '.sops.yaml');
      if (!existsSync(sopsPath)) {
        writeFileSync(sopsPath, yamlStringify({ creation_rules: [{ encrypted_regex: '.*', age: key.public }] }));
        console.log(pc.green('Created .sops.yaml'));
      } else {
        console.log(pc.yellow('.sops.yaml exists. Add this public key:'));
        console.log(`  ${key.public}`);
      }
      break;
    }
    
    case 'pull': {
      if (!opAvailable()) {
        console.error(pc.red('1Password CLI not available or not signed in.'));
        process.exit(1);
      }
      
      const project = getProject(root);
      const priv = opGetKey(project, vault);
      
      if (!priv) {
        console.error(pc.red(`No key in 1Password for ${project}`));
        process.exit(1);
      }
      
      const pub = agePublicFromPrivate(priv);
      keySave(project, { private: priv, public: pub });
      console.log(pc.green(`Pulled and saved to ${keyPath(project)}`));
      break;
    }
    
    case 'push': {
      if (!opAvailable()) {
        console.error(pc.red('1Password CLI not available or not signed in.'));
        process.exit(1);
      }
      
      const project = getProject(root);
      const key = keyLoad(project);
      
      if (!key) {
        console.error(pc.red(`No local key for ${project}`));
        process.exit(1);
      }
      
      opStoreKey(project, key.private, key.public, vault);
      console.log(pc.green('Pushed to 1Password.'));
      break;
    }
    
    case 'list': {
      console.log(pc.blue('Local keys:'));
      for (const k of keysList()) {
        console.log(`  ${pc.cyan(k.project)} ${pc.dim(k.public.slice(0, 20))}...`);
      }
      
      if (opAvailable()) {
        console.log(pc.blue('\n1Password keys:'));
        for (const project of opListKeys(vault)) {
          console.log(`  ${pc.cyan(project)}`);
        }
      }
      break;
    }
    
    default:
      console.error(pc.red(`Unknown: hush keys ${subcommand}`));
      console.log(pc.dim('Commands: setup, generate, pull, push, list'));
      process.exit(1);
  }
}
