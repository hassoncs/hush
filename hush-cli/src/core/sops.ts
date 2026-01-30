import { execSync, spawnSync } from 'node:child_process';
import { fs } from '../lib/fs.js';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { loadConfig, findProjectRoot } from '../config/loader.js';
import { keyExists, keyPath } from '../lib/age.js';

function getProjectIdentifier(root: string): string | undefined {
  const config = loadConfig(root);
  if (config.project) {
    return config.project;
  }

  const pkgPath = join(root, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8') as string);
    if (typeof pkg.repository === 'string') {
      const match = pkg.repository.match(/github\.com[/:]([\w-]+\/[\w-]+)/);
      if (match) return match[1];
    }
    if (pkg.repository?.url) {
      const match = pkg.repository.url.match(/github\.com[/:]([\w-]+\/[\w-]+)/);
      if (match) return match[1];
    }
  }

  return undefined;
}

function getAgeKeyFile(): string | undefined {
  if (process.env.SOPS_AGE_KEY_FILE) {
    return process.env.SOPS_AGE_KEY_FILE;
  }

  const projectRoot = findProjectRoot(process.cwd())?.projectRoot;
  if (projectRoot) {
    const project = getProjectIdentifier(projectRoot);
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
  if (!fs.existsSync(filePath)) {
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
      const projectRoot = findProjectRoot(process.cwd())?.projectRoot;
      const project = projectRoot ? getProjectIdentifier(projectRoot) : undefined;
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

export function encrypt(inputPath: string, outputPath: string): void {
  if (!fs.existsSync(inputPath)) {
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
  if (!fs.existsSync(filePath)) {
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
  
  if (fs.existsSync(filePath)) {
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
    fs.writeFileSync(tempFile, newContent, 'utf-8');
    
    execSync(
      `sops --input-type dotenv --output-type dotenv --encrypt "${tempFile}" > "${filePath}"`,
      {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: getSopsEnv(),
      }
    );
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
}
