import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import type { StoreContext, StoreMode } from './types.js';
import { findConfigPath, findProjectRoot } from './config/loader.js';
import { getProjectIdentifier } from './project.js';

export const GLOBAL_STORE_ROOT = join(homedir(), '.hush');
export const GLOBAL_STORE_KEY_IDENTITY = 'hush-global';

export function resolveStoreContext(startDir: string, mode: StoreMode): StoreContext {
  if (mode === 'global') {
    const root = GLOBAL_STORE_ROOT;
    return {
      mode,
      root,
      configPath: findConfigPath(root),
      keyIdentity: GLOBAL_STORE_KEY_IDENTITY,
      displayLabel: '~/.hush',
    };
  }

  const resolvedStart = resolve(startDir);
  const projectInfo = findProjectRoot(resolvedStart);
  const root = projectInfo?.projectRoot ?? resolvedStart;

  return {
    mode,
    root,
    configPath: projectInfo?.configPath ?? findConfigPath(root),
    keyIdentity: getProjectIdentifier(root),
    displayLabel: projectInfo?.configPath ? root : resolvedStart,
  };
}
