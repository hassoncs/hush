import { existsSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { findConfigPath, loadConfig } from '../config/loader.js';
import { describeFilter } from '../core/filter.js';
import { isAgeKeyConfigured, isSopsInstalled } from '../core/sops.js';
import type { StatusOptions } from '../types.js';
import { FORMAT_OUTPUT_FILES } from '../types.js';

export async function statusCommand(options: StatusOptions): Promise<void> {
  const { root } = options;
  const config = loadConfig(root);
  const configPath = findConfigPath(root);

  console.log(pc.blue('Hush Status\n'));

  console.log(pc.bold('Config:'));
  if (configPath) {
    console.log(pc.green(`  ${configPath.replace(root + '/', '')}`));
  } else {
    console.log(pc.dim('  No hush.yaml found (using defaults)'));
  }

  console.log(pc.bold('\nPrerequisites:'));
  console.log(
    isSopsInstalled()
      ? pc.green('  SOPS installed')
      : pc.red('  SOPS not installed (brew install sops)')
  );
  console.log(
    isAgeKeyConfigured()
      ? pc.green('  age key configured')
      : pc.yellow('  age key not found at ~/.config/sops/age/key.txt')
  );

  console.log(pc.bold('\nSource Files:'));
  const sources = [
    { key: 'shared', path: config.sources.shared },
    { key: 'development', path: config.sources.development },
    { key: 'production', path: config.sources.production },
  ];

  for (const { key, path } of sources) {
    const encryptedPath = join(root, path + '.encrypted');
    const exists = existsSync(encryptedPath);
    const label = `${path}.encrypted`;

    console.log(
      exists
        ? pc.green(`  ${label}`)
        : pc.dim(`  ${label} (not found)`)
    );
  }

  const localPath = join(root, '.env.local');
  console.log(
    existsSync(localPath)
      ? pc.green('  .env.local (overrides)')
      : pc.dim('  .env.local (optional, not found)')
  );

  console.log(pc.bold('\nTargets:'));
  for (const target of config.targets) {
    const filter = describeFilter(target);
    const devOutput = FORMAT_OUTPUT_FILES[target.format].development;
    console.log(
      `  ${pc.cyan(target.name)} ${pc.dim(target.path + '/')} ` +
      `${pc.magenta(target.format)} -> ${devOutput}`
    );
    if (filter !== 'all vars') {
      console.log(pc.dim(`    ${filter}`));
    }
  }

  console.log('');
}
