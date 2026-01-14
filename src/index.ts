// Core exports for programmatic usage
export { discoverPackages } from './core/discover.js';
export {
  expandVariables,
  formatEnvFile,
  getVarsForEnvironment,
  mergeEnvVars,
  parseEnvContent,
  parseEnvFile,
} from './core/parse.js';
export { decrypt, edit, encrypt, isSopsInstalled } from './core/sops.js';

// Types
export { ENV_PREFIXES } from './types.js';
export type { EnvVar, Environment, Package, PackageStyle } from './types.js';

// Commands (for programmatic usage)
export { decryptCommand } from './commands/decrypt.js';
export { editCommand } from './commands/edit.js';
export { encryptCommand } from './commands/encrypt.js';
export { pushCommand } from './commands/push.js';
export { statusCommand } from './commands/status.js';
