import { execSync } from 'node:child_process';
import { platform } from 'node:os';

export const OP_ITEM_PREFIX = 'SOPS Key - hush/';

function showBiometricNotification(reason: string): void {
  const title = 'Hush - 1Password';
  const message = `${reason}\n\n1Password biometric prompt will appear next.`;
  
  try {
    switch (platform()) {
      case 'darwin': {
        const script = `display dialog "${message}" with title "${title}" buttons {"Continue"} default button "Continue" with icon note`;
        execSync(`osascript -e '${script}'`, { stdio: 'pipe' });
        break;
      }
      case 'win32': {
        const psScript = `
          Add-Type -AssemblyName System.Windows.Forms
          [System.Windows.Forms.MessageBox]::Show("${message}", "${title}", "OK", "Information")
        `;
        execSync(`powershell -Command "${psScript}"`, { stdio: 'pipe' });
        break;
      }
      case 'linux': {
        try {
          execSync(`zenity --info --title="${title}" --text="${message}"`, { stdio: 'pipe' });
        } catch {
          execSync(`kdialog --msgbox "${message}" --title "${title}"`, { stdio: 'pipe' });
        }
        break;
      }
    }
  } catch {
    // If GUI fails, fall through silently - better to continue than block
  }
}

function opExec(command: string, reason?: string): string {
  if (reason) {
    showBiometricNotification(reason);
  }
  return execSync(`op signin && ${command}`, {
    encoding: 'utf-8',
    stdio: 'pipe',
    shell: '/bin/bash',
  });
}

export function opInstalled(): boolean {
  try {
    execSync('which op', { encoding: 'utf-8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
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
    const result = opExec(command, `Retrieving encryption key for "${project}" from 1Password.`);
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
    opExec(command, `Backing up encryption key for "${project}" to 1Password.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to store in 1Password';
    throw new Error(message);
  }
}

export function opListKeys(vault?: string): string[] {
  try {
    const vaultArgs = vault ? ['--vault', vault] : [];
    const command = ['op', 'item', 'list', '--categories', 'password', ...vaultArgs, '--format', 'json'].join(' ');
    const result = opExec(command, 'Listing Hush encryption keys stored in 1Password.');
    const items = JSON.parse(result) as { title: string }[];
    return items
      .filter(i => i.title.startsWith(OP_ITEM_PREFIX))
      .map(i => i.title.replace(OP_ITEM_PREFIX, ''));
  } catch {
    return [];
  }
}
