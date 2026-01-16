import { existsSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { loadConfig } from '../config/loader.js';
import { edit as sopsEdit } from '../core/sops.js';
import type { EditOptions } from '../types.js';

type FileKey = 'shared' | 'development' | 'production' | 'local';

export async function editCommand(options: EditOptions): Promise<void> {
  const { root, file } = options;
  const config = loadConfig(root);

  const fileKey: FileKey = file ?? 'shared';
  const sourcePath = config.sources[fileKey];
  const encryptedPath = join(root, sourcePath + '.encrypted');

  if (!existsSync(encryptedPath)) {
    console.error(pc.red(`Encrypted file not found: ${sourcePath}.encrypted`));
    console.error(pc.dim('Run "hush encrypt" first to create encrypted files'));
    process.exit(1);
  }

  console.log(pc.blue(`Editing ${sourcePath}.encrypted...`));
  console.log(pc.dim('Changes will be encrypted on save'));

  sopsEdit(encryptedPath);

  console.log(pc.green('\nEdit complete'));
  console.log(pc.dim('Run "hush run -- <command>" to use updated secrets'));
}
