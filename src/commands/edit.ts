import { existsSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { edit as sopsEdit } from '../core/sops.js';

interface EditOptions {
  root: string;
}

/**
 * Edit command - open .env.encrypted in editor via SOPS
 */
export async function editCommand(options: EditOptions): Promise<void> {
  const { root } = options;

  const encryptedPath = join(root, '.env.encrypted');

  // Check encrypted file exists
  if (!existsSync(encryptedPath)) {
    console.error(pc.red(`Error: ${encryptedPath} not found`));
    console.error(
      pc.dim('Create it with: pnpm secrets encrypt (after creating .env)')
    );
    process.exit(1);
  }

  console.log(pc.blue('Opening encrypted file in editor...'));
  console.log(pc.dim('  (Changes will be encrypted on save)'));

  try {
    sopsEdit(encryptedPath);
    console.log(pc.green('\nEdit complete'));
    console.log(pc.dim('  Run "pnpm secrets decrypt" to update local env files.'));
  } catch (error) {
    console.error(pc.red((error as Error).message));
    process.exit(1);
  }
}
