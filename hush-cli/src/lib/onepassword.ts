import { execSync, spawnSync } from 'node:child_process';

export const OP_ITEM_PREFIX = 'SOPS Key - ';

export function opAvailable(): boolean {
  try {
    execSync('op whoami', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function opGetKey(project: string, vault?: string): string | null {
  try {
    const vaultArgs = vault ? ['--vault', vault] : [];
    const result = execSync(
      ['op', 'item', 'get', `${OP_ITEM_PREFIX}${project}`, ...vaultArgs, '--fields', 'password', '--reveal'].join(' '),
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    return result.trim() || null;
  } catch {
    return null;
  }
}

export function opStoreKey(project: string, privateKey: string, publicKey: string, vault?: string): void {
  const args = [
    'item', 'create',
    '--category', 'password',
    '--title', `${OP_ITEM_PREFIX}${project}`,
    ...(vault ? ['--vault', vault] : []),
    `password=${privateKey}`,
    `public_key[text]=${publicKey}`,
  ];
  
  const result = spawnSync('op', args, { stdio: 'pipe', encoding: 'utf-8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || 'Failed to store in 1Password');
  }
}

export function opListKeys(vault?: string): string[] {
  try {
    const vaultArgs = vault ? ['--vault', vault] : [];
    const result = execSync(
      ['op', 'item', 'list', '--categories', 'password', ...vaultArgs, '--format', 'json'].join(' '),
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    const items = JSON.parse(result) as { title: string }[];
    return items
      .filter(i => i.title.startsWith(OP_ITEM_PREFIX))
      .map(i => i.title.replace(OP_ITEM_PREFIX, ''));
  } catch {
    return [];
  }
}
