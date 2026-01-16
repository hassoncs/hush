import { execSync, spawnSync } from 'node:child_process';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';

function getAgeKeyFile(): string | undefined {
  if (process.env.SOPS_AGE_KEY_FILE) {
    return process.env.SOPS_AGE_KEY_FILE;
  }

  const defaultPath = join(homedir(), '.config', 'sops', 'age', 'key.txt');
  if (existsSync(defaultPath)) {
    return defaultPath;
  }

  return undefined;
}

function getSopsEnv(): NodeJS.ProcessEnv {
  const ageKeyFile = getAgeKeyFile();
  if (ageKeyFile) {
    return { ...process.env, SOPS_AGE_KEY_FILE: ageKeyFile };
  }
  return process.env;
}

export function isSopsInstalled(): boolean {
  try {
    const result = spawnSync('sops', ['--version'], { 
      stdio: 'ignore',
      shell: true 
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

export function isAgeKeyConfigured(): boolean {
  return getAgeKeyFile() !== undefined;
}

export function decrypt(filePath: string): string {
  if (!existsSync(filePath)) {
    throw new Error(`Encrypted file not found: ${filePath}`);
  }

  if (!isSopsInstalled()) {
    throw new Error('SOPS is not installed. Install with: brew install sops (Mac) or scoop install sops (Windows)');
  }

  try {
    const result = execSync(
      `sops --input-type dotenv --output-type dotenv --decrypt "${filePath}"`,
      {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: getSopsEnv(),
      }
    );
    return result;
  } catch (error) {
    const err = error as { stderr?: string; message?: string };
    if (err.stderr?.includes('No identity matched')) {
      throw new Error(
        'SOPS decryption failed: No matching age key found.\n' +
          'Ensure your age key is at ~/.config/sops/age/key.txt'
      );
    }
    throw new Error(`SOPS decryption failed: ${err.stderr || err.message}`);
  }
}

export function encrypt(inputPath: string, outputPath: string): void {
  if (!existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  if (!isSopsInstalled()) {
    throw new Error('SOPS is not installed. Install with: brew install sops (Mac) or scoop install sops (Windows)');
  }

  try {
    execSync(
      `sops --input-type dotenv --output-type dotenv --encrypt "${inputPath}" > "${outputPath}"`,
      {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: getSopsEnv(),
      }
    );
  } catch (error) {
    const err = error as { stderr?: string; message?: string };
    throw new Error(`SOPS encryption failed: ${err.stderr || err.message}`);
  }
}

export function edit(filePath: string): void {
  if (!existsSync(filePath)) {
    throw new Error(`Encrypted file not found: ${filePath}`);
  }

  if (!isSopsInstalled()) {
    throw new Error('SOPS is not installed. Install with: brew install sops');
  }

  const result = spawnSync(
    'sops',
    ['--input-type', 'dotenv', '--output-type', 'dotenv', filePath],
    {
      stdio: 'inherit',
      env: getSopsEnv(),
      shell: true
    }
  );

  if (result.status !== 0) {
    throw new Error(`SOPS edit failed with exit code ${result.status}`);
  }
}

export function setKey(filePath: string, key: string, value: string): void {
  if (!isSopsInstalled()) {
    throw new Error('SOPS is not installed. Install with: brew install sops');
  }

  let content = '';
  
  if (existsSync(filePath)) {
    content = decrypt(filePath);
  }

  const lines = content.split('\n').filter(line => line.trim() !== '');
  
  let found = false;
  const updatedLines = lines.map(line => {
    const match = line.match(/^([^=]+)=/);
    if (match && match[1] === key) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!found) {
    updatedLines.push(`${key}=${value}`);
  }

  const newContent = updatedLines.join('\n') + '\n';

  const tempFile = join(tmpdir(), `hush-temp-${Date.now()}.env`);
  
  try {
    writeFileSync(tempFile, newContent, 'utf-8');
    
    execSync(
      `sops --input-type dotenv --output-type dotenv --encrypt "${tempFile}" > "${filePath}"`,
      {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: getSopsEnv(),
      }
    );
  } finally {
    if (existsSync(tempFile)) {
      unlinkSync(tempFile);
    }
  }
}
