import { fs } from './lib/fs.js';
import { spawnSync, execSync } from 'node:child_process';
import { join } from 'node:path';
import { loadConfig, findProjectRoot } from './config/loader.js';
import { decrypt, isSopsInstalled } from './core/sops.js';
import { ageAvailable, ageGenerate, agePublicFromPrivate, keyExists, keySave, keyLoad, keyPath } from './lib/age.js';
import { opInstalled, opAvailable, opGetKey, opStoreKey } from './lib/onepassword.js';
import type { HushContext } from './types.js';
import pc from 'picocolors';

export const defaultContext: HushContext = {
  fs,
  path: {
    join,
  },
  exec: {
    spawnSync: (command, args, options) => {
      // @ts-ignore - types are compatible at runtime
      return spawnSync(command, args, options);
    },
    execSync: (command, options) => {
      // @ts-ignore - types are compatible at runtime
      return execSync(command, options);
    },
  },
  logger: {
    log: (message) => console.log(message),
    error: (message) => console.error(pc.red(message)),
    warn: (message) => console.warn(pc.yellow(message)),
    info: (message) => console.info(pc.blue(message)),
  },
  process: {
    cwd: () => process.cwd(),
    exit: (code) => process.exit(code),
    env: process.env,
    stdin: process.stdin,
    stdout: process.stdout,
  },
  config: {
    loadConfig,
    findProjectRoot,
  },
  age: {
    ageAvailable,
    ageGenerate,
    keyExists,
    keySave,
    keyPath,
    keyLoad,
    agePublicFromPrivate,
  },
  onepassword: {
    opInstalled,
    opAvailable,
    opGetKey,
    opStoreKey,
  },
  sops: {
    decrypt,
    isSopsInstalled,
  },
};
