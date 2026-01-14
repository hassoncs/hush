import { execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Get the SOPS age key file path
 * Checks SOPS_AGE_KEY_FILE env var, then falls back to default location
 */
function getAgeKeyFile(): string | undefined {
  if (process.env.SOPS_AGE_KEY_FILE) {
    return process.env.SOPS_AGE_KEY_FILE;
  }

  const defaultPath = join(process.env.HOME || '~', '.config/sops/age/key.txt');
  if (existsSync(defaultPath)) {
    return defaultPath;
  }

  return undefined;
}

/**
 * Get environment variables for SOPS commands
 */
function getSopsEnv(): NodeJS.ProcessEnv {
  const ageKeyFile = getAgeKeyFile();
  if (ageKeyFile) {
    return { ...process.env, SOPS_AGE_KEY_FILE: ageKeyFile };
  }
  return process.env;
}

/**
 * Check if SOPS is installed
 */
export function isSopsInstalled(): boolean {
  try {
    execSync('which sops', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Decrypt a SOPS-encrypted file and return the content
 */
export function decrypt(filePath: string): string {
  if (!existsSync(filePath)) {
    throw new Error(`Encrypted file not found: ${filePath}`);
  }

  if (!isSopsInstalled()) {
    throw new Error('SOPS is not installed. Install with: brew install sops');
  }

  try {
    // Use --input-type dotenv to handle .env format files
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
          'Ensure your age key is at ~/.config/sops/age/key.txt\n' +
          'Or set SOPS_AGE_KEY_FILE environment variable.'
      );
    }
    throw new Error(`SOPS decryption failed: ${err.stderr || err.message}`);
  }
}

/**
 * Encrypt content to a SOPS-encrypted file
 */
export function encrypt(inputPath: string, outputPath: string): void {
  if (!existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  if (!isSopsInstalled()) {
    throw new Error('SOPS is not installed. Install with: brew install sops');
  }

  try {
    // Use --input-type dotenv to handle .env format files
    execSync(
      `sops --input-type dotenv --output-type dotenv --encrypt "${inputPath}" > "${outputPath}"`,
      {
        encoding: 'utf-8',
        shell: '/bin/bash',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: getSopsEnv(),
      }
    );
  } catch (error) {
    const err = error as { stderr?: string; message?: string };
    throw new Error(`SOPS encryption failed: ${err.stderr || err.message}`);
  }
}

/**
 * Open encrypted file in editor (SOPS inline edit)
 */
export function edit(filePath: string): void {
  if (!existsSync(filePath)) {
    throw new Error(`Encrypted file not found: ${filePath}`);
  }

  if (!isSopsInstalled()) {
    throw new Error('SOPS is not installed. Install with: brew install sops');
  }

  // Use spawnSync with inherit to allow interactive editing
  // Specify input/output type for dotenv format
  const result = spawnSync(
    'sops',
    ['--input-type', 'dotenv', '--output-type', 'dotenv', filePath],
    {
      stdio: 'inherit',
      env: getSopsEnv(),
    }
  );

  if (result.status !== 0) {
    throw new Error(`SOPS edit failed with exit code ${result.status}`);
  }
}
