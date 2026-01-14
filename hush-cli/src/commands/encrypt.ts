import { existsSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { loadConfig } from '../config/loader.js';
import { encrypt as sopsEncrypt } from '../core/sops.js';
import type { EncryptOptions } from '../types.js';

export async function encryptCommand(options: EncryptOptions): Promise<void> {
  const { root } = options;
  const config = loadConfig(root);

  console.log(pc.blue('Encrypting secrets...'));

  const sourceFiles = [
    { key: 'shared', path: config.sources.shared },
    { key: 'development', path: config.sources.development },
    { key: 'production', path: config.sources.production },
  ];

  let encryptedCount = 0;

  for (const { key, path } of sourceFiles) {
    const sourcePath = join(root, path);
    const encryptedPath = sourcePath + '.encrypted';

    if (!existsSync(sourcePath)) {
      console.log(pc.dim(`  ${path} - not found, skipping`));
      continue;
    }

    sopsEncrypt(sourcePath, encryptedPath);
    encryptedCount++;
    console.log(pc.green(`  ${path}`) + pc.dim(` -> ${path}.encrypted`));
  }

  if (encryptedCount === 0) {
    console.error(pc.red('\nNo source files found to encrypt'));
    console.error(pc.dim('Create at least .env with your secrets'));
    process.exit(1);
  }

  console.log(pc.green(`\nEncrypted ${encryptedCount} file(s)`));
  console.log(pc.dim('You can now commit the .encrypted files to git'));
}
