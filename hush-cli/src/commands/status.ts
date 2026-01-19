import { join } from 'node:path';
import pc from 'picocolors';
import { describeFilter } from '../core/filter.js';
import type { HushContext, StatusOptions } from '../types.js';
import { FORMAT_OUTPUT_FILES } from '../types.js';

function findRootPlaintextEnvFiles(ctx: HushContext, root: string): string[] {
  const results: string[] = [];
  // Only warn about .env files (legacy/output), not .hush files (Hush's source files)
  const plaintextPatterns = ['.env', '.env.development', '.env.production', '.env.local', '.env.staging', '.env.test', '.dev.vars'];

  for (const pattern of plaintextPatterns) {
    const filePath = join(root, pattern);
    if (ctx.fs.existsSync(filePath)) {
      results.push(pattern);
    }
  }

  return results;
}

function getProjectFromConfig(ctx: HushContext, root: string): string | null {
  const config = ctx.config.loadConfig(root);
  if (config.project) return config.project;

  const pkgPath = join(root, 'package.json');
  if (ctx.fs.existsSync(pkgPath)) {
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
  }
  return null;
}

export async function statusCommand(ctx: HushContext, options: StatusOptions): Promise<void> {
  const { root } = options;
  const config = ctx.config.loadConfig(root);
  const projectRootResult = ctx.config.findProjectRoot(root);
  const configPath = projectRootResult ? projectRootResult.configPath : null;

  ctx.logger.log(pc.blue('Hush Status\n'));

  const plaintextFiles = findRootPlaintextEnvFiles(ctx, root);
  
  if (plaintextFiles.length > 0) {
    ctx.logger.log(pc.bgRed(pc.white(pc.bold(' SECURITY WARNING '))));
    ctx.logger.log(pc.red(pc.bold('\nUnencrypted .env files detected at project root!\n')));
    for (const file of plaintextFiles) {
      ctx.logger.log(pc.red(`  ${file}`));
    }
    ctx.logger.log('');
    ctx.logger.log(pc.yellow('These files may expose secrets to AI assistants and version control.'));
    ctx.logger.log(pc.bold('\nTo fix:'));
    ctx.logger.log(pc.dim('  1. Run: npx hush migrate (if upgrading from v4)'));
    ctx.logger.log(pc.dim('  2. Delete or gitignore these .env files'));
    ctx.logger.log(pc.dim('  3. Add to .gitignore: .env, .env.*, .dev.vars\n'));
  }

  ctx.logger.log(pc.bold('Config:'));
  if (configPath) {
    ctx.logger.log(pc.green(`  ${configPath.replace(root + '/', '')}`));
  } else {
    ctx.logger.log(pc.dim('  No hush.yaml found (using defaults)'));
  }

  const project = getProjectFromConfig(ctx, root);
  if (configPath) {
    if (project) {
      ctx.logger.log(pc.green(`  Project: ${project}`));
    } else {
      ctx.logger.log(pc.yellow('  Project: not set'));
      ctx.logger.log(pc.dim('    Add "project: my-org/my-repo" to hush.yaml for key management'));
    }
  }

  ctx.logger.log(pc.bold('\nPrerequisites:'));
  ctx.logger.log(
    ctx.sops.isSopsInstalled()
      ? pc.green('  SOPS installed')
      : pc.red('  SOPS not installed (brew install sops)')
  );
  ctx.logger.log(
    ctx.age.ageAvailable()
      ? pc.green('  age key configured')
      : pc.yellow('  age key not found at ~/.config/sops/age/key.txt')
  );

  if (project) {
    const hasLocalKey = ctx.age.keyExists(project);

    ctx.logger.log(pc.bold('\nKey Status:'));
    ctx.logger.log(
      hasLocalKey
        ? pc.green(`  Local key: ~/.config/sops/age/keys/${project.replace(/\//g, '-')}.txt`)
        : pc.yellow('  Local key: not found')
    );

    if (ctx.onepassword.opAvailable()) {
      ctx.logger.log(pc.dim('  1Password CLI: installed'));
      ctx.logger.log(pc.dim('    Run "npx hush keys list" to check backup status'));
    } else {
      ctx.logger.log(pc.dim('  1Password CLI: not installed'));
    }

    if (!hasLocalKey) {
      ctx.logger.log(pc.bold('\n  To set up keys:'));
      ctx.logger.log(pc.dim('    npx hush keys setup   # Pull from 1Password or generate'));
    }
  }

  ctx.logger.log(pc.bold('\nSource Files:'));
  const sources = [
    { key: 'shared', path: config.sources.shared },
    { key: 'development', path: config.sources.development },
    { key: 'production', path: config.sources.production },
  ];

  for (const { key, path } of sources) {
    const encryptedPath = join(root, path + '.encrypted');
    const exists = ctx.fs.existsSync(encryptedPath);
    const label = `${path}.encrypted`;

    ctx.logger.log(
      exists
        ? pc.green(`  ${label}`)
        : pc.dim(`  ${label} (not found)`)
    );
  }

  const localEncryptedPath = join(root, config.sources.local + '.encrypted');
  ctx.logger.log(
    ctx.fs.existsSync(localEncryptedPath)
      ? pc.green(`  ${config.sources.local}.encrypted (overrides)`)
      : pc.dim(`  ${config.sources.local}.encrypted (optional, not found)`)
  );

  ctx.logger.log(pc.bold('\nTargets:'));
  for (const target of config.targets) {
    const filter = describeFilter(target);
    const devOutput = FORMAT_OUTPUT_FILES[target.format].development;
    ctx.logger.log(
      `  ${pc.cyan(target.name)} ${pc.dim(target.path + '/')} ` +
      `${pc.magenta(target.format)} -> ${devOutput}`
    );
    if (filter !== 'all vars') {
      ctx.logger.log(pc.dim(`    ${filter}`));
    }
  }

  ctx.logger.log('');
}
