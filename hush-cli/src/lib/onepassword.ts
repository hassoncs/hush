import { execSync } from 'node:child_process';

export const OP_ITEM_PREFIX = 'SOPS Key - hush/';

/**
 * 1Password CLI sessions don't persist across subprocesses, so we run
 * `op signin` before every command to trigger biometric auth.
 */
function opExec(command: string): string {
  return execSync(`op signin && ${command}`, {
    encoding: 'utf-8',
    stdio: 'pipe',
    shell: '/bin/bash',
  });
}

export function opAvailable(): boolean {
  try {
    opExec('op whoami');
    return true;
  } catch {
    return false;
  }
}

export function opGetKey(project: string, vault?: string): string | null {
  try {
    const vaultArgs = vault ? ['--vault', vault] : [];
    const command = ['op', 'item', 'get', `${OP_ITEM_PREFIX}${project}`, ...vaultArgs, '--fields', 'password', '--reveal'].join(' ');
    const result = opExec(command);
    return result.trim() || null;
  } catch {
    return null;
  }
}

export function opStoreKey(project: string, privateKey: string, publicKey: string, vault?: string): void {
  const vaultArgs = vault ? ['--vault', vault] : [];
  const command = [
    'op', 'item', 'create',
    '--category', 'password',
    '--title', `"${OP_ITEM_PREFIX}${project}"`,
    ...vaultArgs,
    `"password=${privateKey}"`,
    `"public_key[text]=${publicKey}"`,
  ].join(' ');
  
  try {
    opExec(command);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to store in 1Password';
    throw new Error(message);
  }
}

export function opListKeys(vault?: string): string[] {
  try {
    const vaultArgs = vault ? ['--vault', vault] : [];
    const command = ['op', 'item', 'list', '--categories', 'password', ...vaultArgs, '--format', 'json'].join(' ');
    const result = opExec(command);
    const items = JSON.parse(result) as { title: string }[];
    return items
      .filter(i => i.title.startsWith(OP_ITEM_PREFIX))
      .map(i => i.title.replace(OP_ITEM_PREFIX, ''));
  } catch {
    return [];
  }
}
