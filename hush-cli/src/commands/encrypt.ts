 import { join } from 'node:path';
 import pc from 'picocolors';
 import { encrypt as sopsEncrypt, decrypt as sopsDecrypt } from '../core/sops.js';
 import { parseEnvContent } from '../core/parse.js';
 import type { EncryptOptions, HushContext } from '../types.js';

interface EncryptedFile {
  sourcePath: string;
  encryptedPath: string;
  displayPath: string;
  originalKeyCount: number;
}

export async function encryptCommand(ctx: HushContext, options: EncryptOptions): Promise<void> {
  const { root } = options;
  const config = ctx.config.loadConfig(root);

  ctx.logger.log(pc.blue('Encrypting secrets...\n'));

  const sourceFiles = [
    { key: 'shared', path: config.sources.shared },
    { key: 'development', path: config.sources.development },
    { key: 'production', path: config.sources.production },
  ];

  const encryptedFiles: EncryptedFile[] = [];

  for (const { key, path } of sourceFiles) {
    const sourcePath = join(root, path);
    const encryptedPath = sourcePath + '.encrypted';

    if (!ctx.fs.existsSync(sourcePath)) {
      ctx.logger.log(pc.dim(`  ${path} - not found, skipping`));
      continue;
    }

    const sourceContent = ctx.fs.readFileSync(sourcePath, 'utf-8') as string;
    const vars = parseEnvContent(sourceContent);

    sopsEncrypt(sourcePath, encryptedPath);
    ctx.logger.log(pc.green(`  ${path}`) + pc.dim(` -> ${path}.encrypted (${vars.length} vars)`));

    encryptedFiles.push({
      sourcePath,
      encryptedPath,
      displayPath: path,
      originalKeyCount: vars.length,
    });
  }

  if (encryptedFiles.length === 0) {
    ctx.logger.error(pc.red('\nNo source files found to encrypt'));
    ctx.logger.error(pc.dim('Create at least .hush with your secrets'));
    ctx.process.exit(1);
  }

  ctx.logger.log(pc.blue('\nVerifying encryption...'));

  let allVerified = true;
  for (const file of encryptedFiles) {
    try {
      const decrypted = sopsDecrypt(file.encryptedPath);
      const decryptedVars = parseEnvContent(decrypted);

      if (decryptedVars.length === file.originalKeyCount) {
        ctx.logger.log(pc.green(`  ${file.displayPath}.encrypted - verified (${decryptedVars.length} vars)`));
      } else {
        ctx.logger.log(pc.yellow(`  ${file.displayPath}.encrypted - warning: expected ${file.originalKeyCount} vars, got ${decryptedVars.length}`));
        allVerified = false;
      }
    } catch (error) {
      ctx.logger.log(pc.red(`  ${file.displayPath}.encrypted - FAILED to decrypt`));
      ctx.logger.log(pc.dim(`    ${(error as Error).message}`));
      allVerified = false;
    }
  }

  if (!allVerified) {
    ctx.logger.log(pc.yellow('\nEncryption completed but verification failed.'));
    ctx.logger.log(pc.yellow('Plaintext files have NOT been deleted. Please check your setup.'));
    ctx.process.exit(1);
  }

  ctx.logger.log(pc.blue('\nCleaning up plaintext files...'));

  for (const file of encryptedFiles) {
    try {
      ctx.fs.unlinkSync(file.sourcePath);
      ctx.logger.log(pc.green(`  Deleted ${file.displayPath}`));
    } catch (error) {
      ctx.logger.log(pc.yellow(`  Could not delete ${file.displayPath}: ${(error as Error).message}`));
    }
  }

  ctx.logger.log(pc.green(pc.bold(`\n✓ Encrypted ${encryptedFiles.length} file(s) and removed plaintext`)));
  ctx.logger.log(pc.dim('\nNext steps:'));
  ctx.logger.log(pc.dim('  1. Commit the .encrypted files to git'));
  ctx.logger.log(pc.dim('  2. Use "npx hush run -- <command>" to run with secrets'));
  ctx.logger.log(pc.dim('  3. Use "npx hush inspect" to see what variables are set'));
}
