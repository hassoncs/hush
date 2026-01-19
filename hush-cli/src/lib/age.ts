import { execSync } from 'node:child_process';
import { fs } from './fs.js';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

export interface AgeKey {
  private: string;
  public: string;
}

const KEYS_DIR = join(homedir(), '.config', 'sops', 'age', 'keys');

export function ageAvailable(): boolean {
  try {
    execSync('which age-keygen', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function ageGenerate(): AgeKey {
  const output = execSync('age-keygen', { encoding: 'utf-8' });
  const pub = output.match(/public key: (age1[a-z0-9]+)/)?.[1];
  const priv = output.match(/(AGE-SECRET-KEY-[A-Z0-9]+)/)?.[1];
  if (!pub || !priv) throw new Error('Failed to generate age key');
  return { private: priv, public: pub };
}

export function agePublicFromPrivate(privateKey: string): string {
  return execSync(`echo "${privateKey}" | age-keygen -y`, {
    encoding: 'utf-8',
    shell: '/bin/bash',
  }).trim();
}

export function keyPath(project: string): string {
  return join(KEYS_DIR, `${project.replace(/\//g, '-')}.txt`);
}

export function keyExists(project: string): boolean {
  return fs.existsSync(keyPath(project));
}

export function keySave(project: string, key: AgeKey): void {
  const path = keyPath(project);
  fs.mkdirSync(dirname(path), { recursive: true });
  fs.writeFileSync(path, `# project: ${project}\n# public key: ${key.public}\n${key.private}\n`, { mode: 0o600 });
}

export function keyLoad(project: string): AgeKey | null {
  const path = keyPath(project);
  if (!fs.existsSync(path)) return null;
  
  const content = fs.readFileSync(path, 'utf-8') as string;
  const pub = content.match(/# public key: (age1[a-z0-9]+)/)?.[1];
  const priv = content.match(/(AGE-SECRET-KEY-[A-Z0-9]+)/)?.[1];
  
  return pub && priv ? { private: priv, public: pub } : null;
}

export function keysList(): { project: string; public: string }[] {
  if (!fs.existsSync(KEYS_DIR)) return [];
  
  return fs.readdirSync(KEYS_DIR)
    .filter(f => f.endsWith('.txt'))
    .map(f => {
      const content = fs.readFileSync(join(KEYS_DIR, f), 'utf-8') as string;
      const project = content.match(/# project: (.+)/)?.[1] ?? content.match(/# repo: (.+)/)?.[1];
      const pub = content.match(/# public key: (age1[a-z0-9]+)/)?.[1];
      return project && pub ? { project, public: pub } : null;
    })
    .filter((k): k is { project: string; public: string } => k !== null);
}
