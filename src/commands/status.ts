import { existsSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { discoverPackages } from '../core/discover.js';
import { isSopsInstalled } from '../core/sops.js';

interface StatusOptions {
  root: string;
}

/**
 * Status command - show discovered packages and their styles
 */
export async function statusCommand(options: StatusOptions): Promise<void> {
  const { root } = options;

  console.log(pc.blue('Secrets Status\n'));

  // Check prerequisites
  console.log(pc.bold('Prerequisites:'));

  const sopsInstalled = isSopsInstalled();
  console.log(
    sopsInstalled
      ? pc.green('  SOPS installed')
      : pc.red('  SOPS not installed (brew install sops)')
  );

  const ageKeyPath = join(
    process.env.HOME || '~',
    '.config/sops/age/key.txt'
  );
  const ageKeyExists = existsSync(ageKeyPath);
  console.log(
    ageKeyExists
      ? pc.green('  age key found')
      : pc.yellow('  age key not found at ~/.config/sops/age/key.txt')
  );

  // Check files
  console.log(pc.bold('\nFiles:'));

  const encryptedPath = join(root, '.env.encrypted');
  const encryptedExists = existsSync(encryptedPath);
  console.log(
    encryptedExists
      ? pc.green('  .env.encrypted exists')
      : pc.yellow('  .env.encrypted not found')
  );

  const localPath = join(root, '.env.local');
  const localExists = existsSync(localPath);
  console.log(
    localExists
      ? pc.green('  .env.local exists (local overrides)')
      : pc.dim('  - .env.local not found (optional)')
  );

  const sopsConfigPath = join(root, '.sops.yaml');
  const sopsConfigExists = existsSync(sopsConfigPath);
  console.log(
    sopsConfigExists
      ? pc.green('  .sops.yaml exists')
      : pc.yellow('  .sops.yaml not found (SOPS config)')
  );

  // Discover packages
  console.log(pc.bold('\nDiscovered Packages:'));

  const packages = await discoverPackages(root);

  if (packages.length === 0) {
    console.log(pc.dim('  No packages found'));
  } else {
    for (const pkg of packages) {
      const styleColor = pkg.style === 'wrangler' ? pc.cyan : pc.magenta;
      const output =
        pkg.style === 'wrangler'
          ? '.dev.vars'
          : '.env.development, .env.production';

      console.log(
        `  ${pkg.path || '.'} ` +
          styleColor(`(${pkg.style})`) +
          pc.dim(` -> ${output}`)
      );
    }
  }

  console.log('');
}
