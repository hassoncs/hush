import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import * as nodeFs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { decrypt, decryptYaml, encryptYamlContent } from '../../src/core/sops.js';
import { createFileDocument, createFileIndexEntry, createManifestDocument } from '../../src/index.js';
import type { HushManifestDocument } from '../../src/types.js';

export const TEST_AGE_PUBLIC_KEY = 'age1k6085c7hu6xgwtp2w35kf224peecjjagvswzhgtgmh76gaxcppnq9rlkqx';
export const TEST_AGE_PRIVATE_KEY = 'AGE-SECRET-KEY-1NRM2VW0WPL94YENWTCUNCSR0QNTFHLNZR0MHARQ2G5FL9PQW9TKQKV32PS';

const TEST_KEY_FILE = join(tmpdir(), 'hush-test-age-key.txt');

export function ensureTestSopsEnv(): string {
  if (!nodeFs.existsSync(TEST_KEY_FILE)) {
    nodeFs.writeFileSync(TEST_KEY_FILE, `${TEST_AGE_PRIVATE_KEY}\n`, 'utf-8');
  }

  process.env.SOPS_AGE_KEY_FILE = TEST_KEY_FILE;
  return TEST_KEY_FILE;
}

export function ensureTestSopsConfig(root: string): void {
  ensureTestSopsEnv();
  nodeFs.mkdirSync(root, { recursive: true });

  const configPath = join(root, '.sops.yaml');
  if (!nodeFs.existsSync(configPath)) {
    nodeFs.writeFileSync(configPath, stringifyYaml({
      creation_rules: [{ encrypted_regex: '.*', age: TEST_AGE_PUBLIC_KEY }],
    }), 'utf-8');
  }
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith('\n') ? content : `${content}\n`;
}

export function writeEncryptedYamlFile(root: string, filePath: string, content: string): void {
  ensureTestSopsConfig(root);
  nodeFs.mkdirSync(dirname(filePath), { recursive: true });
  encryptYamlContent(ensureTrailingNewline(content), filePath, { root });
}

export function writeEncryptedDotenvFile(root: string, filePath: string, content: string): void {
  ensureTestSopsConfig(root);
  nodeFs.mkdirSync(dirname(filePath), { recursive: true });
  const tempPlainPath = `${filePath}.plain`;

  try {
    nodeFs.writeFileSync(tempPlainPath, ensureTrailingNewline(content), 'utf-8');
    const result = spawnSync(
      'sops',
      [
        '--input-type', 'dotenv',
        '--output-type', 'dotenv',
        '--encrypt',
        '--filename-override', filePath,
        '--config', join(root, '.sops.yaml'),
        tempPlainPath,
      ],
      {
        encoding: 'utf-8',
        env: { ...process.env, SOPS_AGE_KEY_FILE: TEST_KEY_FILE },
      },
    );
    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || `sops exited ${result.status}`);
    }
    nodeFs.writeFileSync(filePath, result.stdout, 'utf-8');
  } finally {
    nodeFs.rmSync(tempPlainPath, { force: true });
  }
}

export function readDecryptedYamlFile(root: string, filePath: string): string {
  ensureTestSopsConfig(root);
  return decryptYaml(filePath, { root });
}

export function readDecryptedDotenvFile(root: string, filePath: string): string {
  ensureTestSopsConfig(root);
  return decrypt(filePath, { root });
}

export function ensureEncryptedFixtureRepo(root: string): void {
  ensureTestSopsConfig(root);

  const readYaml = (filePath: string): string => {
    try {
      return decryptYaml(filePath, { root });
    } catch {
      return nodeFs.readFileSync(filePath, 'utf-8');
    }
  };

  const manifestPath = join(root, '.hush', 'manifest.encrypted');
  if (nodeFs.existsSync(manifestPath)) {
    try {
      const existingManifest = parseYaml(decryptYaml(manifestPath, { root })) as { fileIndex?: unknown };
      if (existingManifest?.fileIndex && typeof existingManifest.fileIndex === 'object') {
        return;
      }
    } catch {
    }

    const fileIndex: Record<string, ReturnType<typeof createFileIndexEntry>> = {};
    const queueForIndex = [join(root, '.hush', 'files')];

    while (queueForIndex.length > 0) {
      const current = queueForIndex.shift()!;
      if (!nodeFs.existsSync(current)) {
        continue;
      }

      for (const entry of nodeFs.readdirSync(current, { withFileTypes: true })) {
        const entryPath = join(current, entry.name);
        if (entry.isDirectory()) {
          queueForIndex.push(entryPath);
          continue;
        }

        if (!entry.name.endsWith('.encrypted')) {
          continue;
        }

        const content = readYaml(entryPath);
        const parsed = createFileDocument(parseYaml(content));
        fileIndex[parsed.path] = createFileIndexEntry(parsed);
      }
    }

    const manifestContent = readYaml(manifestPath);
    const manifest = createManifestDocument({
      ...(parseYaml(manifestContent) as Record<string, unknown>),
      fileIndex,
    } as HushManifestDocument);
    nodeFs.writeFileSync(manifestPath, stringifyYaml(manifest, { indent: 2 }), 'utf-8');
  }

  const queue = [join(root, '.hush')];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (!nodeFs.existsSync(current)) {
      continue;
    }

    for (const entry of nodeFs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(entryPath);
        continue;
      }

      if (!entry.name.endsWith('.encrypted')) {
        continue;
      }

      const raw = nodeFs.readFileSync(entryPath, 'utf-8');
      if (raw.includes('\nsops:\n') || raw.includes('\nsops:')) {
        continue;
      }

      writeEncryptedYamlFile(root, entryPath, raw);
    }
  }
}
