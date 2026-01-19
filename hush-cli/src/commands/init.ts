import pc from 'picocolors';
import { stringify as stringifyYaml } from 'yaml';
import type { HushConfig, HushContext, InitOptions, Target } from '../types.js';
import { DEFAULT_SOURCES } from '../types.js';

function getProjectFromPackageJson(ctx: HushContext, root: string): string | null {
  const pkgPath = ctx.path.join(root, 'package.json');
  if (!ctx.fs.existsSync(pkgPath)) return null;

  try {
    const pkg = JSON.parse(ctx.fs.readFileSync(pkgPath, 'utf-8') as string);
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

async function tryExistingLocalKey(ctx: HushContext, project: string): Promise<KeySetupResult | null> {
  if (!ctx.age.keyExists(project)) return null;

  const existing = await ctx.age.keyLoad(project);
  if (!existing) return null;

  ctx.logger.log(pc.green(`Using existing key for ${pc.cyan(project)}`));
  return { publicKey: existing.public, source: 'existing' };
}

async function tryPullFrom1Password(ctx: HushContext, project: string): Promise<KeySetupResult | null> {
  if (!ctx.onepassword.opAvailable()) return null;

  ctx.logger.log(pc.dim('Checking 1Password for existing key...'));
  const priv = ctx.onepassword.opGetKey(project);
  if (!priv) return null;

  const pub = ctx.age.agePublicFromPrivate(priv);
  ctx.age.keySave(project, { private: priv, public: pub });
  ctx.logger.log(pc.green(`Pulled key from 1Password for ${pc.cyan(project)}`));
  return { publicKey: pub, source: '1password' };
}

function generateAndBackupKey(ctx: HushContext, project: string): KeySetupResult | null {
  if (!ctx.age.ageAvailable()) {
    ctx.logger.log(pc.yellow('age not installed. Run: brew install age'));
    return null;
  }

  ctx.logger.log(pc.blue(`Generating new key for ${pc.cyan(project)}...`));
  const key = ctx.age.ageGenerate();
  ctx.age.keySave(project, key);
  ctx.logger.log(pc.green(`Saved to ${ctx.age.keyPath(project)}`));
  ctx.logger.log(pc.dim(`Public: ${key.public}`));

  if (ctx.onepassword.opAvailable()) {
    try {
      ctx.onepassword.opStoreKey(project, key.private, key.public);
      ctx.logger.log(pc.green('Backed up to 1Password.'));
    } catch (e) {
      ctx.logger.warn(pc.yellow(`Could not backup to 1Password: ${(e as Error).message}`));
    }
  }

  return { publicKey: key.public, source: 'generated' };
}

async function setupKey(ctx: HushContext, root: string, project: string | null): Promise<KeySetupResult | null> {
  if (!project) {
    ctx.logger.log(pc.yellow('No project identifier found. Skipping key setup.'));
    ctx.logger.log(pc.dim('Add "project: my-org/my-repo" to hush.yaml or set repository in package.json'));
    return null;
  }

  return (
    (await tryExistingLocalKey(ctx, project)) ||
    (await tryPullFrom1Password(ctx, project)) ||
    generateAndBackupKey(ctx, project)
  );
}

function createSopsConfig(ctx: HushContext, root: string, publicKey: string): void {
  const sopsPath = ctx.path.join(root, '.sops.yaml');
  if (ctx.fs.existsSync(sopsPath)) {
    ctx.logger.log(pc.yellow('.sops.yaml already exists. Add this public key if needed:'));
    ctx.logger.log(`  ${publicKey}`);
    return;
  }

  const sopsConfig = stringifyYaml({
    creation_rules: [{ encrypted_regex: '.*', age: publicKey }]
  });
  ctx.fs.writeFileSync(sopsPath, sopsConfig, 'utf-8');
  ctx.logger.log(pc.green('Created .sops.yaml'));
}

function detectTargets(ctx: HushContext, root: string): Target[] {
  const targets: Target[] = [{ name: 'root', path: '.', format: 'dotenv' }];

  const entries = ctx.fs.readdirSync(root, { withFileTypes: true }) as { name: string; isDirectory(): boolean }[];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

    const dirPath = ctx.path.join(root, entry.name);
    const packageJsonPath = ctx.path.join(dirPath, 'package.json');
    const wranglerPath = ctx.path.join(dirPath, 'wrangler.toml');

    if (!ctx.fs.existsSync(packageJsonPath)) continue;

    if (ctx.fs.existsSync(wranglerPath)) {
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

function findExistingPlaintextEnvFiles(ctx: HushContext, root: string): string[] {
  const patterns = ['.env', '.env.development', '.env.production', '.env.local', '.env.staging', '.env.test', '.dev.vars'];
  const found: string[] = [];

  for (const pattern of patterns) {
    const filePath = ctx.path.join(root, pattern);
    if (ctx.fs.existsSync(filePath)) {
      found.push(pattern);
    }
  }

  return found;
}

function findExistingEncryptedFiles(ctx: HushContext, root: string): string[] {
  const patterns = ['.env.encrypted', '.env.development.encrypted', '.env.production.encrypted', '.env.local.encrypted'];
  const found: string[] = [];

  for (const pattern of patterns) {
    const filePath = ctx.path.join(root, pattern);
    if (ctx.fs.existsSync(filePath)) {
      found.push(pattern);
    }
  }

  return found;
}

export async function initCommand(ctx: HushContext, options: InitOptions): Promise<void> {
  const { root } = options;

  const existingConfig = ctx.config.findProjectRoot(root);
  if (existingConfig) {
    ctx.logger.error(pc.red(`Config already exists: ${existingConfig.configPath}`));
    ctx.process.exit(1);
  }

  ctx.logger.log(pc.blue('Initializing hush...\n'));

  const existingEncryptedFiles = findExistingEncryptedFiles(ctx, root);
  if (existingEncryptedFiles.length > 0) {
    ctx.logger.log(pc.bgYellow(pc.black(' V4 ENCRYPTED FILES DETECTED ')));
    ctx.logger.log(pc.yellow('\nFound existing v4 encrypted files:'));
    for (const file of existingEncryptedFiles) {
      ctx.logger.log(pc.yellow(`  ${file}`));
    }
    ctx.logger.log(pc.dim('\nRun "npx hush migrate" to convert to v5 format (.hush.encrypted).\n'));
  }

  const existingEnvFiles = findExistingPlaintextEnvFiles(ctx, root);
  if (existingEnvFiles.length > 0) {
    ctx.logger.log(pc.bgYellow(pc.black(' PLAINTEXT .ENV FILES DETECTED ')));
    ctx.logger.log(pc.yellow('\nFound existing .env files:'));
    for (const file of existingEnvFiles) {
      ctx.logger.log(pc.yellow(`  ${file}`));
    }
    ctx.logger.log(pc.dim('\nRename these to .hush files, then run "npx hush encrypt".\n'));
    ctx.logger.log(pc.dim('Example: mv .env .hush && mv .env.development .hush.development\n'));
  }

  const project = getProjectFromPackageJson(ctx, root);

  if (!project) {
    ctx.logger.log(pc.yellow('No project identifier found in package.json.'));
    ctx.logger.log(pc.dim('Tip: Add "project: my-org/my-repo" to hush.yaml after creation for key management.\n'));
  }

  const keyResult = await setupKey(ctx, root, project);

  if (keyResult) {
    createSopsConfig(ctx, root, keyResult.publicKey);
  }

  const targets = detectTargets(ctx, root);

  const config: HushConfig = {
    version: 2,
    sources: DEFAULT_SOURCES,
    targets,
    ...(project && { project }),
  };

  const yaml = stringifyYaml(config, { indent: 2 });
  const schemaComment = '# yaml-language-server: $schema=https://unpkg.com/@chriscode/hush/schema.json\n';
  const configPath = ctx.path.join(root, 'hush.yaml');

  ctx.fs.writeFileSync(configPath, schemaComment + yaml, 'utf-8');

  ctx.logger.log(pc.green(`\nCreated ${configPath}`));
  ctx.logger.log(pc.dim('\nDetected targets:'));

  for (const target of targets) {
    ctx.logger.log(`  ${pc.cyan(target.name)} ${pc.dim(target.path)} ${pc.magenta(target.format)}`);
  }

  ctx.logger.log(pc.bold('\nNext steps:'));

  if (existingEncryptedFiles.length > 0) {
    ctx.logger.log(pc.green('  1. npx hush migrate') + pc.dim('      # Convert v4 .env.encrypted to v5 .hush.encrypted'));
    ctx.logger.log(pc.dim('  2. npx hush inspect') + pc.dim('       # Verify your secrets'));
    ctx.logger.log(pc.dim('  3. npx hush run -- <cmd>') + pc.dim('  # Run with secrets in memory'));
  } else if (existingEnvFiles.length > 0) {
    ctx.logger.log(pc.green('  1. Rename .env files to .hush') + pc.dim(' # mv .env .hush'));
    ctx.logger.log(pc.dim('  2. npx hush encrypt') + pc.dim('      # Encrypt .hush files'));
    ctx.logger.log(pc.dim('  3. npx hush run -- <cmd>') + pc.dim('  # Run with secrets in memory'));
  } else {
    ctx.logger.log(pc.dim('  1. npx hush set <KEY>') + pc.dim('     # Add secrets interactively'));
    ctx.logger.log(pc.dim('  2. npx hush run -- <cmd>') + pc.dim('  # Run with secrets in memory'));
  }

  ctx.logger.log(pc.dim('\nGit setup:'));
  ctx.logger.log(pc.dim('  git add hush.yaml .sops.yaml'));
  ctx.logger.log(pc.dim('  git commit -m "chore: add Hush secrets management"'));
}
