import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import * as nodeFs from 'node:fs';
import { resolveStoreContext, GLOBAL_STORE_KEY_IDENTITY } from '../src/store.js';
import { createProjectSlug, getProjectStatePaths } from '../src/v3/state.js';

const TEST_DIR = join('/tmp', 'hush-test-store-context');

describe('resolveStoreContext', () => {
  beforeEach(() => {
    nodeFs.rmSync(TEST_DIR, { recursive: true, force: true });
    nodeFs.mkdirSync(join(TEST_DIR, 'apps/web/src'), { recursive: true });
  });

  afterEach(() => {
    nodeFs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('resolves project mode to the nearest hush project root', () => {
    nodeFs.writeFileSync(join(TEST_DIR, 'hush.yaml'), 'project: acme/hush\n');
    nodeFs.writeFileSync(
      join(TEST_DIR, 'package.json'),
      JSON.stringify({ repository: 'https://github.com/acme/hush' }),
      'utf-8',
    );

    const store = resolveStoreContext(join(TEST_DIR, 'apps/web/src'), 'project');
    const statePaths = getProjectStatePaths(store);

    expect(store.mode).toBe('project');
    expect(store.root).toBe(TEST_DIR);
    expect(store.configPath).toBe(join(TEST_DIR, 'hush.yaml'));
    expect(store.keyIdentity).toBe('acme/hush');
    expect(statePaths.projectSlug).toBe(createProjectSlug('acme/hush'));
    expect(statePaths.activeIdentityPath.endsWith(`/projects/${statePaths.projectSlug}/active-identity.json`)).toBe(true);
    expect(statePaths.auditLogPath.endsWith(`/projects/${statePaths.projectSlug}/audit.jsonl`)).toBe(true);
  });

  it('resolves global mode to the dedicated ~/.hush root', () => {
    const store = resolveStoreContext(TEST_DIR, 'global');
    const statePaths = getProjectStatePaths(store);

    expect(store.mode).toBe('global');
    expect(store.root.endsWith('/.hush')).toBe(true);
    expect(store.displayLabel).toBe('~/.hush');
    expect(store.keyIdentity).toBe(GLOBAL_STORE_KEY_IDENTITY);
    expect(statePaths.projectSlug).toBe(createProjectSlug(GLOBAL_STORE_KEY_IDENTITY));
    expect(statePaths.activeIdentityPath.endsWith(`/projects/${statePaths.projectSlug}/active-identity.json`)).toBe(true);
    expect(statePaths.auditLogPath.endsWith(`/projects/${statePaths.projectSlug}/audit.jsonl`)).toBe(true);
  });
});
