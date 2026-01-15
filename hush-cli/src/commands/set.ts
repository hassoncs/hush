import { existsSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { loadConfig } from '../config/loader.js';
import { setKey } from '../core/sops.js';
import type { SetOptions } from '../types.js';

type FileKey = 'shared' | 'development' | 'production' | 'local';

function promptForValue(key: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error('Interactive input requires a terminal (TTY)'));
      return;
    }

    process.stdout.write(`Enter value for ${pc.cyan(key)}: `);
    
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let value = '';
    
    const onData = (char: string) => {
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004': // Ctrl+D
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(value);
          break;
        case '\u0003': // Ctrl+C
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          reject(new Error('Cancelled'));
          break;
        case '\u007F': // Backspace
        case '\b':
          if (value.length > 0) {
            value = value.slice(0, -1);
            process.stdout.write('\b \b');
          }
          break;
        default:
          value += char;
          process.stdout.write('\u2022'); // Bullet character for hidden input
      }
    };

    stdin.on('data', onData);
  });
}

export async function setCommand(options: SetOptions): Promise<void> {
  const { root, file, key } = options;
  const config = loadConfig(root);

  const fileKey: FileKey = file ?? 'shared';
  const sourcePath = config.sources[fileKey];
  const encryptedPath = join(root, sourcePath + '.encrypted');

  if (!key) {
    console.error(pc.red('Usage: hush set <KEY> [-e environment]'));
    console.error(pc.dim('Example: hush set DATABASE_URL'));
    console.error(pc.dim('         hush set API_KEY -e production'));
    console.error(pc.dim('\nTo edit all secrets in an editor, use: hush edit'));
    process.exit(1);
  }

  if (!existsSync(encryptedPath) && !existsSync(join(root, '.sops.yaml'))) {
    console.error(pc.red('Hush is not initialized in this directory'));
    console.error(pc.dim('Run "hush init" first, then "hush encrypt"'));
    process.exit(1);
  }

  try {
    const value = await promptForValue(key);
    
    if (!value) {
      console.error(pc.yellow('No value entered, aborting'));
      process.exit(1);
    }

    setKey(encryptedPath, key, value);
    
    const envLabel = fileKey === 'shared' ? '' : ` in ${fileKey}`;
    console.log(pc.green(`\n${key} set${envLabel} (${value.length} chars, encrypted)`));
  } catch (error) {
    const err = error as Error;
    if (err.message === 'Cancelled') {
      console.log(pc.yellow('Cancelled'));
      process.exit(1);
    }
    throw err;
  }
}
