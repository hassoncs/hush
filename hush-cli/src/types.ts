import { V3_SCHEMA_VERSION } from './v3/schema.js';
import type { HushFileDocument, HushFileIndexEntry, HushFilePath, HushManifestDocument } from './v3/domain.js';
export type { HushProjectStatePaths } from './v3/state.js';
export type { HushAuditCommandContext, HushAuditEvent, HushAuditEventType } from './v3/audit.js';
export type { ActiveIdentityStateDocument } from './v3/identity.js';
export type {
  HushBundleConflictDetail,
  HushBundleResolution,
  HushResolvedNode,
  HushTargetResolution,
  HushInterpolationDependency,
  HushSelectedEntryCandidate,
} from './v3/provenance.js';
export type { HushImportRepositoryMap } from './v3/imports.js';
export type {
  ResolveV3BundleOptions,
  ResolveV3Options,
  ResolveV3TargetOptions,
} from './v3/resolver.js';
export type {
  HushArtifactDescriptor,
  HushArtifactFileDescriptor,
  HushArtifactBinaryDescriptor,
  HushArtifactShapeResult,
  HushTargetArtifactDescriptor,
} from './v3/artifacts.js';
export type {
  HushMaterialization,
  HushMaterializationFailure,
  HushMaterializationMode,
  HushMaterializeBundleOptions,
  HushMaterializeTargetOptions,
} from './v3/materialize.js';
export type {
  HushNamespace,
  HushRole,
} from './v3/schema.js';
export {
  ACTIVE_IDENTITY_STATE_BASENAME,
  AUDIT_LOG_BASENAME,
  HUSH_MACHINE_ROOT,
  HUSH_STATE_DIRNAME,
  HUSH_STATE_PROJECTS_DIRNAME,
  createProjectSlug,
  ensureProjectStateRoot,
  getProjectStatePaths,
  getStoreStateSeed,
  readStateJsonFile,
  writeStateJsonFile,
} from './v3/state.js';
export {
  HUSH_AUDIT_EVENT_VERSION,
  appendAuditEvent,
  createAuditEvent,
  serializeAuditEvent,
} from './v3/audit.js';
export {
  ACTIVE_IDENTITY_STATE_VERSION,
  getActiveIdentity,
  readActiveIdentityState,
  requireActiveIdentity,
  setActiveIdentity,
} from './v3/identity.js';
export { HushResolutionConflictError, resolveV3Bundle, resolveV3Target } from './v3/resolver.js';
export {
  shapeBundleArtifacts,
  shapeResolvedArtifacts,
  shapeTargetArtifacts,
  targetFormatToArtifactFormat,
} from './v3/artifacts.js';
export {
  HushMaterializationInterruptedError,
  materializeV3Bundle,
  materializeV3Target,
  withMaterializedBundle,
  withMaterializedTarget,
} from './v3/materialize.js';
export {
  HUSH_V3_ROOT_DIR,
  HUSH_V3_MANIFEST_BASENAME,
  HUSH_V3_FILES_DIRNAME,
  HUSH_V3_ENCRYPTED_FILE_EXTENSION,
  HUSH_V3_NAMESPACES,
  HUSH_V3_ROLES,
  V3_SCHEMA_VERSION,
  assertHushNamespace,
  assertHushRole,
  assertNamespacedPath,
  getNamespaceFromPath,
  isHushNamespace,
  isHushRole,
  normalizeHushPath,
} from './v3/schema.js';
export type {
  HushArtifactEntry,
  HushArtifactBinaryEntry,
  HushArtifactFileEntry,
  HushArtifactFormat,
  HushBundleConflict,
  HushBundleDefinition,
  HushBundleFileRef,
  HushBundleImportRef,
  HushBundleName,
  HushFileDocument,
  HushFileEntry,
  HushFileIndexEntry,
  HushFilePath,
  HushIdentityName,
  HushIdentityRecord,
  HushImportDefinition,
  HushImportName,
  HushImportPullSpec,
  HushLogicalPath,
  HushManifestDocument,
  HushProvenanceImportRecord,
  HushProvenanceRecord,
  HushReaders,
  HushResolvedValue,
  HushResolverResult,
  HushScalarValue,
  HushTargetDefinition,
  HushTargetName,
  HushValueEntry,
} from './v3/domain.js';
export {
  createBundleDefinition,
  createFileDocument,
  createFileIndexEntry,
  createIdentityRecord,
  createImportDefinition,
  createManifestDocument,
  createProvenanceRecord,
  createReaders,
  createTargetDefinition,
  isIdentityAllowed,
  upsertManifestFileIndexEntry,
} from './v3/domain.js';
export {
  getV3EncryptedFilePath,
  getV3FilesRoot,
  getV3ManifestPath,
  getV3RepoRoot,
  isV3EncryptedFilePath,
  isV3ManifestPath,
  stripEncryptedFileExtension,
} from './v3/paths.js';

export type OutputFormat = 'dotenv' | 'wrangler' | 'json' | 'shell' | 'yaml';
export type Environment = 'development' | 'production';
export type PushDestinationType = 'cloudflare-workers' | 'cloudflare-pages';

export interface CloudflareWorkersPushConfig {
  type: 'cloudflare-workers';
}

export interface CloudflarePagesPushConfig {
  type: 'cloudflare-pages';
  project: string;
}

export type PushConfig = CloudflareWorkersPushConfig | CloudflarePagesPushConfig;

export interface LegacyTarget {
  name: string;
  path: string;
  format: OutputFormat;
  include?: string[];
  exclude?: string[];
  push_to?: PushConfig;
}

export interface LegacySourceFiles {
  shared: string;
  development: string;
  production: string;
  local: string;
}

export interface LegacyHushConfig {
  version?: number;
  project?: string;
  sources: LegacySourceFiles;
  targets: LegacyTarget[];
}

export interface LegacyV2Inventory {
  kind: 'legacy-v2';
  projectRoot: string;
  configPath: string;
  config: LegacyHushConfig;
  sources: Array<{ name: keyof LegacySourceFiles; path: string }>;
  targets: LegacyTarget[];
}

export interface HushV3Repository {
  kind: 'v3';
  projectRoot: string;
  manifestPath: string;
  filesRoot: string;
  manifest: HushManifestDocument;
  files: HushFileIndexEntry[];
  filesByPath: Record<HushFilePath, HushFileIndexEntry>;
  fileSystemPaths: Record<HushFilePath, string>;
  loadFile(path: HushFilePath): HushFileDocument;
}

export interface HushProjectDiscoveryResult {
  repositoryKind: 'legacy-v2' | 'v3';
  configPath: string | null;
  projectRoot: string;
}

export type HushProjectRuntimeAuthority = LegacyV2Inventory | HushV3Repository;

export const CURRENT_SCHEMA_VERSION = V3_SCHEMA_VERSION;

export interface EnvVar {
  key: string;
  value: string;
}

export interface EncryptOptions {
  store: StoreContext;
}

export interface DecryptOptions {
  store: StoreContext;
  env: Environment;
  force: boolean;
}

export interface EditOptions {
  store: StoreContext;
  file?: 'shared' | 'development' | 'production' | 'local';
}

export interface SetOptions {
  store: StoreContext;
  file?: 'shared' | 'development' | 'production' | 'local';
  key?: string;
  value?: string;
  gui?: boolean;
}

export interface RunOptions {
  store: StoreContext;
  cwd: string;
  env: Environment;
  target?: string;
  command: string[];
}

export interface PushOptions {
  store: StoreContext;
  dryRun: boolean;
  verbose: boolean;
  target?: string;
}

export interface StatusOptions {
  store: StoreContext;
}

export interface InitOptions {
  store: StoreContext;
}

export interface BootstrapOptions {
  store: StoreContext;
}

export interface ConfigOptions {
  store: StoreContext;
  subcommand?: string;
  args: string[];
  roles?: string;
  identities?: string;
}

export interface ListOptions {
  store: StoreContext;
  env: Environment;
}

export interface CheckOptions {
  store: StoreContext;
  warn: boolean;
  json: boolean;
  quiet: boolean;
  onlyChanged: boolean;
  requireSource: boolean;
  allowPlaintext?: boolean;
}

export type CheckErrorType = 'SOURCE_MISSING' | 'ENCRYPTED_MISSING' | 'DECRYPT_FAILED' | 'SOPS_NOT_INSTALLED';

export interface CheckFileResult {
  source: string;
  encrypted: string;
  inSync: boolean;
  added: string[];
  removed: string[];
  changed: string[];
  error?: CheckErrorType;
}

export interface PlaintextFileResult {
  file: string;
  keyCount: number;
}

export interface CheckResult {
  status: 'ok' | 'drift' | 'error' | 'plaintext';
  files: CheckFileResult[];
  plaintextFiles?: PlaintextFileResult[];
}

export interface SkillOptions {
  root: string;
  global?: boolean;
  local?: boolean;
}

export interface ResolveOptions {
  store: StoreContext;
  env: Environment;
  target: string;
}

export interface TraceOptions {
  store: StoreContext;
  env: Environment;
  key: string;
}

export interface DiffOptions {
  store: StoreContext;
  env: Environment;
  target?: string;
  bundle?: string;
  ref?: string;
}

export interface ExportExampleOptions {
  store: StoreContext;
  env: Environment;
  target?: string;
  bundle?: string;
}

export interface MaterializeOptions {
  store: StoreContext;
  target?: string;
  bundle?: string;
  json: boolean;
  outputRoot?: string;
  cleanup: boolean;
  command?: string[];
}

export type StoreMode = 'project' | 'global';

export interface StoreContext {
  mode: StoreMode;
  root: string;
  configPath: string | null;
  keyIdentity?: string;
  displayLabel: string;
  projectSlug?: string;
  stateRoot?: string;
  projectStateRoot?: string;
  activeIdentityPath?: string;
  auditLogPath?: string;
}

export const DEFAULT_SOURCES: LegacySourceFiles = {
  shared: '.hush',
  development: '.hush.development',
  production: '.hush.production',
  local: '.hush.local',
};

export const FORMAT_OUTPUT_FILES: Record<OutputFormat, Record<Environment, string>> = {
  dotenv: {
    development: '.env.development',
    production: '.env.production',
  },
  wrangler: {
    development: '.dev.vars',
    production: '.dev.vars',
  },
  json: {
    development: '.env.development.json',
    production: '.env.production.json',
  },
  shell: {
    development: '.env.development.sh',
    production: '.env.production.sh',
  },
  yaml: {
    development: '.env.development.yaml',
    production: '.env.production.yaml',
  },
};

export interface HushContext {
  fs: {
    existsSync(path: string): boolean;
    readFileSync(path: string, options?: { encoding?: BufferEncoding; flag?: string } | BufferEncoding): string | Buffer;
    writeFileSync(path: string, data: string | Uint8Array, options?: { encoding?: BufferEncoding; mode?: number; flag?: string } | BufferEncoding | null): void;
    mkdirSync(path: string, options?: { recursive?: boolean; mode?: number }): string | undefined;
    readdirSync(path: string, options?: { recursive?: boolean; withFileTypes?: boolean }): (string | { name: string; isDirectory(): boolean })[];
    unlinkSync(path: string): void;
    rmSync?(path: string, options?: { recursive?: boolean; force?: boolean }): void;
    statSync(path: string): { isDirectory(): boolean; mtime: Date };
    renameSync(oldPath: string, newPath: string): void;
    chmodSync?(path: string, mode: number): void;
  };
  path: {
    join(...paths: string[]): string;
  };
  exec: {
    spawnSync(command: string, args: string[], options?: any): { status: number | null; stdout: string | Buffer; stderr: string | Buffer; error?: Error };
    execSync(command: string, options?: any): string | Buffer;
  };
  logger: {
    log(message: string): void;
    error(message: string): void;
    warn(message: string): void;
    info(message: string): void;
  };
  process: {
    cwd(): string;
    exit(code: number): never;
    env: NodeJS.ProcessEnv;
    stdin: NodeJS.ReadStream;
    stdout: NodeJS.WriteStream;
    on?(event: 'SIGINT' | 'SIGTERM', listener: () => void): void;
    removeListener?(event: 'SIGINT' | 'SIGTERM', listener: () => void): void;
  };
  config: {
    loadConfig(root: string): LegacyHushConfig;
    findProjectRoot(startDir: string): HushProjectDiscoveryResult | null;
  };
  age: {
    ageAvailable(): boolean;
    ageGenerate(): { private: string; public: string };
    keyExists(project: string): boolean;
    keySave(project: string, key: { private: string; public: string }): void;
    keyPath(project: string): string;
    keyLoad(project: string): { private: string; public: string } | null;
    agePublicFromPrivate(privateKey: string): string;
  };
  onepassword: {
    opInstalled(): boolean;
    opAvailable(): boolean;
    opGetKey(project: string): string | null;
    opStoreKey(project: string, privateKey: string, publicKey: string): void;
  };
  sops: {
    decrypt(path: string, options?: { root?: string; keyIdentity?: string }): string;
    decryptYaml(path: string, options?: { root?: string; keyIdentity?: string }): string;
    encrypt(inputPath: string, outputPath: string, options?: { root?: string; keyIdentity?: string }): void;
    encryptYaml(inputPath: string, outputPath: string, options?: { root?: string; keyIdentity?: string }): void;
    encryptYamlContent(content: string, outputPath: string, options?: { root?: string; keyIdentity?: string }): void;
    edit(path: string, options?: { root?: string; keyIdentity?: string }): void;
    isSopsInstalled(): boolean;
  };
}
