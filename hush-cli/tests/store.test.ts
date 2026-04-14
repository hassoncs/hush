import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import * as nodeFs from 'node:fs';
import { resolveStoreContext, GLOBAL_STORE_KEY_IDENTITY } from '../src/store.js';

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

    const store = resolveStoreContext(join(TEST_DIR, 'apps/web/src'), 'project');

    expect(store.mode).toBe('project');
    expect(store.root).toBe(TEST_DIR);
    expect(store.configPath).toBe(join(TEST_DIR, 'hush.yaml'));
    expect(store.keyIdentity).toBe('acme/hush');
  });

  it('resolves global mode to the dedicated ~/.hush root', () => {
    const store = resolveStoreContext(TEST_DIR, 'global');

    expect(store.mode).toBe('global');
    expect(store.root.endsWith('/.hush')).toBe(true);
    expect(store.displayLabel).toBe('~/.hush');
    expect(store.keyIdentity).toBe(GLOBAL_STORE_KEY_IDENTITY);
  });
});
