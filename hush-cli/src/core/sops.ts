import { execSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { fs } from '../lib/fs.js';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { keyExists, keyPath } from '../lib/age.js';
import { findProjectRoot } from '../config/loader.js';
import { getProjectIdentifier } from '../project.js';

interface SopsOptions {
  root?: string;
  keyIdentity?: string;
}

type SopsFileFormat = 'dotenv' | 'yaml';

function getSopsConfigFile(options?: SopsOptions): string | undefined {
  if (!options?.root) {
    return undefined;
  }

  const configPath = join(options.root, '.sops.yaml');
  return fs.existsSync(configPath) ? configPath : undefined;
}

function getAgeKeyFile(options?: SopsOptions): string | undefined {
  if (process.env.SOPS_AGE_KEY_FILE) {
    return process.env.SOPS_AGE_KEY_FILE;
  }

  const keyIdentity = options?.keyIdentity;
  if (keyIdentity && keyExists(keyIdentity)) {
    return keyPath(keyIdentity);
  }

  const projectRoot = options?.root ?? findProjectRoot(process.cwd())?.projectRoot;
  if (projectRoot) {
    const project = keyIdentity ?? getProjectIdentifier(projectRoot);
    if (project && keyExists(project)) {
      return keyPath(project);
    }
  }

  const defaultPath = join(homedir(), '.config', 'sops', 'age', 'key.txt');
  if (fs.existsSync(defaultPath)) {
    return defaultPath;
  }

  return undefined;
}

function getSopsEnv(options?: SopsOptions): NodeJS.ProcessEnv {
  const ageKeyFile = getAgeKeyFile(options);
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

function decryptWithFormat(filePath: string, format: SopsFileFormat, options?: SopsOptions): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Encrypted file not found: ${filePath}`);
  }

  if (!isSopsInstalled()) {
    throw new Error('SOPS is not installed. Install with: brew install sops (Mac) or scoop install sops (Windows)');
  }

  try {
    const result = execSync(
      `sops --input-type ${format} --output-type ${format} --decrypt "${filePath}"`,
      {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: getSopsEnv(options),
      }
    );
    return result;
  } catch (error) {
    const err = error as { stderr?: string; message?: string };
    if (err.stderr?.includes('No identity matched')) {
      const projectRoot = options?.root ?? findProjectRoot(process.cwd())?.projectRoot;
      const project = options?.keyIdentity ?? (projectRoot ? getProjectIdentifier(projectRoot) : undefined);
      const keyLocation = project
        ? `~/.config/sops/age/keys/${project.replace(/\//g, '-')}.txt`
        : '~/.config/sops/age/key.txt';
      throw new Error(
        'SOPS decryption failed: No matching age key found.\n' +
          `Ensure your age key is at ${keyLocation}`
      );
    }
    throw new Error(`SOPS decryption failed: ${err.stderr || err.message}`);
  }
}

export function decrypt(filePath: string, options?: SopsOptions): string {
  return decryptWithFormat(filePath, 'dotenv', options);
}

export function decryptYaml(filePath: string, options?: SopsOptions): string {
  return decryptWithFormat(filePath, 'yaml', options);
}

function encryptWithFormat(inputPath: string, outputPath: string, format: SopsFileFormat, options?: SopsOptions): void {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  if (!isSopsInstalled()) {
    throw new Error('SOPS is not installed. Install with: brew install sops (Mac) or scoop install sops (Windows)');
  }

  try {
    const configPath = getSopsConfigFile(options);
    const configFlag = configPath ? ` --config "${configPath}"` : '';
    execSync(
      `sops --input-type ${format} --output-type ${format} --encrypt${configFlag} "${inputPath}" > "${outputPath}"`,
      {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: getSopsEnv(options),
      }
    );
  } catch (error) {
    const err = error as { stderr?: string; message?: string };
    throw new Error(`SOPS encryption failed: ${err.stderr || err.message}`);
  }
}

export function encrypt(inputPath: string, outputPath: string, options?: SopsOptions): void {
  encryptWithFormat(inputPath, outputPath, 'dotenv', options);
}

export function encryptYaml(inputPath: string, outputPath: string, options?: SopsOptions): void {
  encryptWithFormat(inputPath, outputPath, 'yaml', options);
}

export function withPrivatePlaintextTempFile<T>(format: SopsFileFormat, content: string, action: (tempFilePath: string) => T): T {
  const extension = format === 'yaml' ? 'yaml' : 'env';
  const tempDir = mkdtempSync(join(tmpdir(), 'hush-sops-'));
  const tempFile = join(tempDir, `staged.${extension}`);

  try {
    chmodSync(tempDir, 0o700);
    writeFileSync(tempFile, content, { encoding: 'utf-8', mode: 0o600 });
    return action(tempFile);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function writeEncryptedContent(content: string, outputPath: string, format: SopsFileFormat, options?: SopsOptions): void {
  withPrivatePlaintextTempFile(format, content, (tempFile) => {
    encryptWithFormat(tempFile, outputPath, format, options);
  });
}

export function encryptYamlContent(content: string, outputPath: string, options?: SopsOptions): void {
  writeEncryptedContent(content, outputPath, 'yaml', options);
}

export function edit(filePath: string, options?: SopsOptions): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Encrypted file not found: ${filePath}`);
  }

  if (!isSopsInstalled()) {
    throw new Error('SOPS is not installed. Install with: brew install sops');
  }

  const configPath = getSopsConfigFile(options);
  const configArgs = configPath ? ['--config', configPath] : [];

  const result = spawnSync(
    'sops',
    [...configArgs, '--input-type', 'dotenv', '--output-type', 'dotenv', filePath],
    {
      stdio: 'inherit',
      env: getSopsEnv(options),
      shell: true
    }
  );

  if (result.status !== 0) {
    throw new Error(`SOPS edit failed with exit code ${result.status}`);
  }
}

export function setKey(filePath: string, key: string, value: string, options?: SopsOptions): void {
  if (!isSopsInstalled()) {
    throw new Error('SOPS is not installed. Install with: brew install sops');
  }

  let content = '';
  
  if (fs.existsSync(filePath)) {
    content = decrypt(filePath, options);
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

  withPrivatePlaintextTempFile('dotenv', newContent, (tempFile) => {
    const configPath = getSopsConfigFile(options);
    const configFlag = configPath ? ` --config "${configPath}"` : '';

    execSync(
      `sops --input-type dotenv --output-type dotenv --encrypt${configFlag} "${tempFile}" > "${filePath}"`,
      {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: getSopsEnv(options),
      }
    );
  });
}
