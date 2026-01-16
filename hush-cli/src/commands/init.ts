import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { stringify as stringifyYaml } from 'yaml';
import { findConfigPath } from '../config/loader.js';
import { ageAvailable, ageGenerate, keyExists, keySave, keyPath } from '../lib/age.js';
import { opAvailable, opGetKey, opStoreKey } from '../lib/onepassword.js';
import type { HushConfig, InitOptions, Target } from '../types.js';
import { DEFAULT_SOURCES } from '../types.js';

function getProjectFromPackageJson(root: string): string | null {
  const pkgPath = join(root, 'package.json');
  if (!existsSync(pkgPath)) return null;
  
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    if (typeof pkg.repository === 'string') {
      const match = pkg.repository.match(/github\.com[/:]([\w-]+\/[\w-]+)/);
      if (match) return match[1];
    }
    if (pkg.repository?.url) {
      const match = pkg.repository.url.match(/github\.com[/:]([\w-]+\/[\w-]+)/);
      if (match) return match[1];
    }
  } catch {
    return null;
  }
  return null;
}

interface KeySetupResult {
  publicKey: string;
  source: 'existing' | '1password' | 'generated';
}

async function tryExistingLocalKey(project: string): Promise<KeySetupResult | null> {
  if (!keyExists(project)) return null;
  
  const existing = await import('../lib/age.js').then(m => m.keyLoad(project));
  if (!existing) return null;
  
  console.log(pc.green(`Using existing key for ${pc.cyan(project)}`));
  return { publicKey: existing.public, source: 'existing' };
}

async function tryPullFrom1Password(project: string): Promise<KeySetupResult | null> {
  if (!opAvailable()) return null;
  
  console.log(pc.dim('Checking 1Password for existing key...'));
  const priv = opGetKey(project);
  if (!priv) return null;
  
  const { agePublicFromPrivate } = await import('../lib/age.js');
  const pub = agePublicFromPrivate(priv);
  keySave(project, { private: priv, public: pub });
  console.log(pc.green(`Pulled key from 1Password for ${pc.cyan(project)}`));
  return { publicKey: pub, source: '1password' };
}

function generateAndBackupKey(project: string): KeySetupResult | null {
  if (!ageAvailable()) {
    console.log(pc.yellow('age not installed. Run: brew install age'));
    return null;
  }

  console.log(pc.blue(`Generating new key for ${pc.cyan(project)}...`));
  const key = ageGenerate();
  keySave(project, key);
  console.log(pc.green(`Saved to ${keyPath(project)}`));
  console.log(pc.dim(`Public: ${key.public}`));

  if (opAvailable()) {
    try {
      opStoreKey(project, key.private, key.public);
      console.log(pc.green('Backed up to 1Password.'));
    } catch (e) {
      console.warn(pc.yellow(`Could not backup to 1Password: ${(e as Error).message}`));
    }
  }

  return { publicKey: key.public, source: 'generated' };
}

async function setupKey(root: string, project: string | null): Promise<KeySetupResult | null> {
  if (!project) {
    console.log(pc.yellow('No project identifier found. Skipping key setup.'));
    console.log(pc.dim('Add "project: my-project" to hush.yaml or set repository in package.json'));
    return null;
  }

  return (
    (await tryExistingLocalKey(project)) ||
    (await tryPullFrom1Password(project)) ||
    generateAndBackupKey(project)
  );
}

function createSopsConfig(root: string, publicKey: string): void {
  const sopsPath = join(root, '.sops.yaml');
  if (existsSync(sopsPath)) {
    console.log(pc.yellow('.sops.yaml already exists. Add this public key if needed:'));
    console.log(`  ${publicKey}`);
    return;
  }

  const sopsConfig = stringifyYaml({
    creation_rules: [{ encrypted_regex: '.*', age: publicKey }]
  });
  writeFileSync(sopsPath, sopsConfig, 'utf-8');
  console.log(pc.green('Created .sops.yaml'));
}

function detectTargets(root: string): Target[] {
  const targets: Target[] = [{ name: 'root', path: '.', format: 'dotenv' }];

  const entries = readdirSync(root, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

    const dirPath = join(root, entry.name);
    const packageJsonPath = join(dirPath, 'package.json');
    const wranglerPath = join(dirPath, 'wrangler.toml');

    if (!existsSync(packageJsonPath)) continue;

    if (existsSync(wranglerPath)) {
      targets.push({
        name: entry.name,
        path: `./${entry.name}`,
        format: 'wrangler',
        exclude: ['EXPO_PUBLIC_*', 'NEXT_PUBLIC_*', 'VITE_*'],
      });
    } else {
      targets.push({
        name: entry.name,
        path: `./${entry.name}`,
        format: 'dotenv',
      });
    }
  }

  return targets;
}

function findExistingPlaintextEnvFiles(root: string): string[] {
  const patterns = ['.env', '.env.development', '.env.production', '.env.local', '.env.staging', '.env.test', '.dev.vars'];
  const found: string[] = [];
  
  for (const pattern of patterns) {
    const filePath = join(root, pattern);
    if (existsSync(filePath)) {
      found.push(pattern);
    }
  }
  
  return found;
}

export async function initCommand(options: InitOptions): Promise<void> {
  const { root } = options;

  const existingConfig = findConfigPath(root);
  if (existingConfig) {
    console.error(pc.red(`Config already exists: ${existingConfig}`));
    process.exit(1);
  }

  console.log(pc.blue('Initializing hush...\n'));

  const existingEnvFiles = findExistingPlaintextEnvFiles(root);
  if (existingEnvFiles.length > 0) {
    console.log(pc.bgYellow(pc.black(' EXISTING SECRETS DETECTED ')));
    console.log(pc.yellow('\nFound existing .env files:'));
    for (const file of existingEnvFiles) {
      console.log(pc.yellow(`  ${file}`));
    }
    console.log(pc.dim('\nThese will be encrypted after setup. Run "npx hush encrypt" when ready.\n'));
  }

  const project = getProjectFromPackageJson(root);
  
  if (!project) {
    console.log(pc.yellow('No project identifier found in package.json.'));
    console.log(pc.dim('Tip: Add "project: my-org/my-repo" to hush.yaml after creation for key management.\n'));
  }

  const keyResult = await setupKey(root, project);

  if (keyResult) {
    createSopsConfig(root, keyResult.publicKey);
  }

  const targets = detectTargets(root);

  const config: HushConfig = {
    version: 2,
    sources: DEFAULT_SOURCES,
    targets,
    ...(project && { project }),
  };

  const yaml = stringifyYaml(config, { indent: 2 });
  const schemaComment = '# yaml-language-server: $schema=https://unpkg.com/@chriscode/hush/schema.json\n';
  const configPath = join(root, 'hush.yaml');

  writeFileSync(configPath, schemaComment + yaml, 'utf-8');

  console.log(pc.green(`\nCreated ${configPath}`));
  console.log(pc.dim('\nDetected targets:'));

  for (const target of targets) {
    console.log(`  ${pc.cyan(target.name)} ${pc.dim(target.path)} ${pc.magenta(target.format)}`);
  }

  console.log(pc.bold('\nNext steps:'));
  
  if (existingEnvFiles.length > 0) {
    console.log(pc.green('  1. npx hush encrypt') + pc.dim('     # Encrypt existing .env files (deletes plaintext)'));
    console.log(pc.dim('  2. npx hush inspect') + pc.dim('      # Verify your secrets'));
    console.log(pc.dim('  3. npx hush run -- <cmd>') + pc.dim(' # Run with secrets in memory'));
  } else {
    console.log(pc.dim('  1. npx hush set <KEY>') + pc.dim('    # Add secrets interactively'));
    console.log(pc.dim('  2. npx hush run -- <cmd>') + pc.dim(' # Run with secrets in memory'));
  }

  console.log(pc.dim('\nGit setup:'));
  console.log(pc.dim('  git add hush.yaml .sops.yaml'));
  console.log(pc.dim('  git commit -m "chore: add Hush secrets management"'));
}
