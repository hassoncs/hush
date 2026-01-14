import { existsSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { encrypt as sopsEncrypt } from '../core/sops.js';

interface EncryptOptions {
  root: string;
}

/**
 * Encrypt command - encrypt .env to .env.encrypted
 */
export async function encryptCommand(options: EncryptOptions): Promise<void> {
  const { root } = options;

  const inputPath = join(root, '.env');
  const outputPath = join(root, '.env.encrypted');

  // Check input file exists
  if (!existsSync(inputPath)) {
    console.error(pc.red(`Error: ${inputPath} not found`));
    console.error(pc.dim('Create a .env file first, then run encrypt.'));
    process.exit(1);
  }

  console.log(pc.blue('Encrypting secrets...'));
  console.log(pc.dim(`  Input: .env`));
  console.log(pc.dim(`  Output: .env.encrypted`));

  try {
    sopsEncrypt(inputPath, outputPath);
    console.log(pc.green('\nEncryption complete'));
    console.log(pc.dim('  You can now commit .env.encrypted to git.'));
  } catch (error) {
    console.error(pc.red((error as Error).message));
    process.exit(1);
  }
}
