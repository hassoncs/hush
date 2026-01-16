import { existsSync, unlinkSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { loadConfig } from '../config/loader.js';
import { encrypt as sopsEncrypt, decrypt as sopsDecrypt } from '../core/sops.js';
import { parseEnvContent } from '../core/parse.js';
import type { EncryptOptions } from '../types.js';

interface EncryptedFile {
  sourcePath: string;
  encryptedPath: string;
  displayPath: string;
  originalKeyCount: number;
}

export async function encryptCommand(options: EncryptOptions): Promise<void> {
  const { root } = options;
  const config = loadConfig(root);

  console.log(pc.blue('Encrypting secrets...\n'));

  const sourceFiles = [
    { key: 'shared', path: config.sources.shared },
    { key: 'development', path: config.sources.development },
    { key: 'production', path: config.sources.production },
  ];

  const encryptedFiles: EncryptedFile[] = [];

  for (const { key, path } of sourceFiles) {
    const sourcePath = join(root, path);
    const encryptedPath = sourcePath + '.encrypted';

    if (!existsSync(sourcePath)) {
      console.log(pc.dim(`  ${path} - not found, skipping`));
      continue;
    }

    const sourceContent = readFileSync(sourcePath, 'utf-8');
    const vars = parseEnvContent(sourceContent);

    sopsEncrypt(sourcePath, encryptedPath);
    console.log(pc.green(`  ${path}`) + pc.dim(` -> ${path}.encrypted (${vars.length} vars)`));

    encryptedFiles.push({
      sourcePath,
      encryptedPath,
      displayPath: path,
      originalKeyCount: vars.length,
    });
  }

  if (encryptedFiles.length === 0) {
    console.error(pc.red('\nNo source files found to encrypt'));
    console.error(pc.dim('Create at least .env with your secrets'));
    process.exit(1);
  }

  console.log(pc.blue('\nVerifying encryption...'));

  let allVerified = true;
  for (const file of encryptedFiles) {
    try {
      const decrypted = sopsDecrypt(file.encryptedPath);
      const decryptedVars = parseEnvContent(decrypted);

      if (decryptedVars.length === file.originalKeyCount) {
        console.log(pc.green(`  ${file.displayPath}.encrypted - verified (${decryptedVars.length} vars)`));
      } else {
        console.log(pc.yellow(`  ${file.displayPath}.encrypted - warning: expected ${file.originalKeyCount} vars, got ${decryptedVars.length}`));
        allVerified = false;
      }
    } catch (error) {
      console.log(pc.red(`  ${file.displayPath}.encrypted - FAILED to decrypt`));
      console.log(pc.dim(`    ${(error as Error).message}`));
      allVerified = false;
    }
  }

  if (!allVerified) {
    console.log(pc.yellow('\nEncryption completed but verification failed.'));
    console.log(pc.yellow('Plaintext files have NOT been deleted. Please check your setup.'));
    process.exit(1);
  }

  console.log(pc.blue('\nCleaning up plaintext files...'));

  for (const file of encryptedFiles) {
    try {
      unlinkSync(file.sourcePath);
      console.log(pc.green(`  Deleted ${file.displayPath}`));
    } catch (error) {
      console.log(pc.yellow(`  Could not delete ${file.displayPath}: ${(error as Error).message}`));
    }
  }

  console.log(pc.green(pc.bold(`\n✓ Encrypted ${encryptedFiles.length} file(s) and removed plaintext`)));
  console.log(pc.dim('\nNext steps:'));
  console.log(pc.dim('  1. Commit the .encrypted files to git'));
  console.log(pc.dim('  2. Use "npx hush run -- <command>" to run with secrets'));
  console.log(pc.dim('  3. Use "npx hush inspect" to see what variables are set'));
}
