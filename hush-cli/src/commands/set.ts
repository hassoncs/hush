import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { platform } from 'node:os';
import pc from 'picocolors';
import { loadConfig } from '../config/loader.js';
import { setKey } from '../core/sops.js';
import type { SetOptions } from '../types.js';

type FileKey = 'shared' | 'development' | 'production' | 'local';

function promptViaMacOSDialog(key: string): string | null {
  try {
    const script = `display dialog "Enter value for ${key}:" default answer "" with hidden answer with title "Hush - Set Secret"`;
    const result = execSync(`osascript -e '${script}' -e 'text returned of result'`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim();
  } catch {
    return null;
  }
}

function promptViaWindowsDialog(key: string): string | null {
  try {
    const psScript = `
      Add-Type -AssemblyName System.Windows.Forms
      Add-Type -AssemblyName System.Drawing
      
      $form = New-Object System.Windows.Forms.Form
      $form.Text = 'Hush - Set Secret'
      $form.Size = New-Object System.Drawing.Size(300,150)
      $form.StartPosition = 'CenterScreen'
      
      $label = New-Object System.Windows.Forms.Label
      $label.Location = New-Object System.Drawing.Point(10,20)
      $label.Size = New-Object System.Drawing.Size(280,20)
      $label.Text = 'Enter value for ${key}:'
      $form.Controls.Add($label)
      
      $textBox = New-Object System.Windows.Forms.TextBox
      $textBox.Location = New-Object System.Drawing.Point(10,50)
      $textBox.Size = New-Object System.Drawing.Size(260,20)
      $textBox.PasswordChar = '*'
      $form.Controls.Add($textBox)
      
      $okButton = New-Object System.Windows.Forms.Button
      $okButton.Location = New-Object System.Drawing.Point(10,80)
      $okButton.Size = New-Object System.Drawing.Size(75,23)
      $okButton.Text = 'OK'
      $okButton.DialogResult = [System.Windows.Forms.DialogResult]::OK
      $form.AcceptButton = $okButton
      $form.Controls.Add($okButton)
      
      $form.TopMost = $true
      
      $result = $form.ShowDialog()
      
      if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
        Write-Output $textBox.Text
      } else {
        exit 1
      }
    `;
    
    const encodedCommand = Buffer.from(psScript, 'utf16le').toString('base64');
    const result = execSync(`powershell -EncodedCommand "${encodedCommand}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim();
  } catch {
    return null;
  }
}

function promptViaLinuxDialog(key: string): string | null {
  try {
    const result = execSync(`zenity --password --title="Hush - Set Secret" --text="Enter value for ${key}:"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim();
  } catch {
    try {
      const result = execSync(`kdialog --password "Enter value for ${key}:" --title "Hush - Set Secret"`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return result.trim();
    } catch {
      return null;
    }
  }
}

function promptViaTTY(key: string): Promise<string> {
  return new Promise((resolve, reject) => {
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
        case '\u0004':
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(value);
          break;
        case '\u0003':
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          reject(new Error('Cancelled'));
          break;
        case '\u007F':
        case '\b':
          if (value.length > 0) {
            value = value.slice(0, -1);
            process.stdout.write('\b \b');
          }
          break;
        default:
          value += char;
          process.stdout.write('\u2022');
      }
    };

    stdin.on('data', onData);
  });
}

async function promptForValue(key: string, forceGui: boolean): Promise<string> {
  if (process.stdin.isTTY && !forceGui) {
    return promptViaTTY(key);
  }
  
  console.log(pc.dim('Opening dialog for secret input...'));
  
  let value: string | null = null;
  
  switch (platform()) {
    case 'darwin':
      value = promptViaMacOSDialog(key);
      break;
    case 'win32':
      value = promptViaWindowsDialog(key);
      break;
    case 'linux':
      value = promptViaLinuxDialog(key);
      break;
  }
  
  if (value !== null) {
    return value;
  }
  
  if (platform() === 'linux') {
    throw new Error('GUI prompt failed. Please install "zenity" or "kdialog".');
  }
  
  throw new Error('Dialog cancelled or failed. Interactive input requires a terminal (TTY) or a supported GUI environment.');
}

export async function setCommand(options: SetOptions): Promise<void> {
  const { root, file, key, gui } = options;
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
    const value = await promptForValue(key, gui ?? false);
    
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
