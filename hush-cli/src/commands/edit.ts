 import { join } from 'node:path';
 import pc from 'picocolors';
 import { edit as sopsEdit } from '../core/sops.js';
 import type { EditOptions, HushContext } from '../types.js';

type FileKey = 'shared' | 'development' | 'production' | 'local';

export async function editCommand(ctx: HushContext, options: EditOptions): Promise<void> {
  const { root, file } = options;
  const config = ctx.config.loadConfig(root);

  const fileKey: FileKey = file ?? 'shared';
  const sourcePath = config.sources[fileKey];
  const encryptedPath = join(root, sourcePath + '.encrypted');

  if (!ctx.fs.existsSync(encryptedPath)) {
    ctx.logger.error(pc.red(`Encrypted file not found: ${sourcePath}.encrypted`));
    ctx.logger.error(pc.dim('Run "hush encrypt" first to create encrypted files'));
    ctx.process.exit(1);
  }

  ctx.logger.log(pc.blue(`Editing ${sourcePath}.encrypted...`));
  ctx.logger.log(pc.dim('Changes will be encrypted on save'));

  sopsEdit(encryptedPath);

  ctx.logger.log(pc.green('\nEdit complete'));
  ctx.logger.log(pc.dim('Run "hush run -- <command>" to use updated secrets'));
}
