---
title: V3 Repository Model
last_compiled: 2026-04-22
sources: 6
coverage: high
topic_type: stable
---

# V3 Repository Model

## Summary [coverage: high -- 6 sources]

Hush v3 stores all repository authority in encrypted-at-rest YAML documents under `.hush/`. The model replaced the legacy `hush.yaml` config with a namespace-driven document system: a single `manifest.encrypted` defines identities, bundles, targets, imports, and a file index; individual `files/**/*.encrypted` contain secret entries organized by namespace (env, artifacts, user, imports). Schema version is 3. All files use SOPS with age encryption.

## Architecture [coverage: high -- 4 sources]

### Directory Layout
```
.hush/
├── manifest.encrypted                # Repository metadata (YAML, SOPS-encrypted)
└── files/
    ├── env/project/shared.encrypted  # Environment variables for the project bundle
    ├── env/development/owner.encrypted  # Owner-scoped dev secrets
    └── artifacts/**/*.encrypted     # Binary/file artifacts (signing certs, etc.)
```

### Manifest Document (`HushManifestDocument`)
```typescript
interface HushManifestDocument {
  version: 3;
  activeIdentity?: string;           // Current user identity
  identities: Record<string, HushIdentityRecord>;  // Defined identities
  fileIndex?: Record<string, HushFileIndexEntry>;  // File registry
  imports?: Record<string, HushImportDefinition>;  // Cross-project imports
  bundles?: Record<string, HushBundleDefinition>;  // Secret groupings
  targets?: Record<string, HushTargetDefinition>;  // Runtime outputs
  metadata?: Record<string, HushScalarValue>;      // Arbitrary metadata
}
```

### File Document (`HushFileDocument`)
```typescript
interface HushFileDocument {
  path: string;          // Namespaced path (e.g., "env/project/shared")
  readers: HushReaders;  // Who can decrypt (roles + specific identities)
  sensitive: boolean;    // Overall sensitivity flag
  entries: Record<string, HushFileEntry>;  // key-value pairs or artifacts
}
```

### Namespaces and Paths
The `.hush/files/` directory uses **namespace-based routing**:
- `env/` — Environment variables (KEY=VALUE)
- `artifacts/` — Binary files, signing certs, configs
- `bundles/` — Bundle definitions
- `user/` — User-specific overrides
- `imports/` — Cross-project imports

Each file is stored as `{logicalPath}.encrypted` — e.g., `env/project/shared.encrypted`.

**Sources:**
- [domain.ts](../../hush-cli/src/v3/domain.ts) — Domain model interfaces and factories
- [schema.ts](../../hush-cli/src/v3/schema.ts) — Schema constants, namespaces, roles
- [paths.ts](../../hush-cli/src/v3/paths.ts) — Path construction helpers
- [manifest.ts](../../hush-cli/src/v3/manifest.ts) — Manifest loading/creation

## Key Decisions [coverage: medium -- 3 sources]

- **Encrypted-at-rest only** — No plaintext secret files. The `.hush/` directory contains ONLY `.encrypted` files with SOPs-encrypted YAML. AI agents never see raw secret values.
- **Namespaced logical paths** — All entries use paths like `env/project/shared` rather than flat keys. Namespaces determine entry type and resolution behavior.
- **Identity-based readers** — Each file declares which roles (owner, member, ci) and specific identities can decrypt it. Cross-repository imports inherit reader rules.
- **Versioned schema** — `V3_SCHEMA_VERSION = 3` is enforced at manifest creation. This prevents silent incompatibilities during upgrades.

## API Surface [coverage: high -- 2 sources]

### Domain Factory Functions
- `createManifestDocument(manifest)` — Validates and normalizes a full manifest
- `createIdentityRecord(identity)` — Creates a validated identity with role assertion
- `createReaders(readers)` — Validates roles and identity lists
- `createFileDocument(file)` — Validates path namespaces, enforces namespace containment for entries
- `createBundleDefinition(bundle)` — Validates bundle file refs and import refs
- `createTargetDefinition(target)` — Validates target references a bundle or path with a format
- `createImportDefinition(definition)` — Validates import project and pull spec
- `createProvenanceRecord(record)` — Creates provenance with namespace derivation
- `isIdentityAllowed(readers, identity, role)` — Checks if identity/role can access file
- `upsertManifestFileIndexEntry(manifest, path, entry)` — Adds file to manifest index

### Schema Constants
- `HUSH_V3_ROOT_DIR` — `.hush`
- `HUSH_V3_MANIFEST_BASENAME` — `manifest.encrypted`
- `HUSH_V3_FILES_DIRNAME` — `files`
- `HUSH_V3_ENCRYPTED_FILE_EXTENSION` — `.encrypted`
- `HUSH_V3_NAMESPACES` — `['env', 'artifacts', 'bundles', 'user', 'imports']`
- `HUSH_V3_ROLES` — `['owner', 'member', 'ci']`

## Usage Patterns [coverage: medium -- 2 sources]

### Inspecting the Repository
```bash
hush config show manifest    # Show decrypted manifest
hush config show files       # Show file index
hush config show state       # Show repository health check
hush config show identities  # Show declared identities
```

### File Index Management
The file index is maintained automatically as files are added via `hush set`. Each file entry tracks logical paths, readers, and sensitivity.

### Multi-Identity Workflow
```bash
hush config active-identity              # Show current
hush config active-identity owner-local  # Switch identity
hush set API_KEY                         # Writes to current identity's scope
```

## Troubleshooting [coverage: low -- 1 source]

- "Manifest version must be 3" — Repository was bootstrapped with wrong version; run `hush bootstrap` on a clean directory.
- "Identity name cannot be empty" — Empty identity name in manifest; check manifest YAML formatting.
- "Entry path must stay inside file namespace" — Entry logical path namespace doesn't match file path namespace (e.g., `env/...` entry in `artifacts/...` file).

## Related Topics

- [cli-commands](cli-commands.md)
- [secrets-resolution](secrets-resolution.md)
- [key-management](key-management.md)
- [encrypted-runtime-execution](../concepts/encrypted-runtime-execution.md)
- [identity-based-access-control](../concepts/identity-based-access-control.md)

## Sources

- [domain.ts](../../hush-cli/src/v3/domain.ts) — Full domain model + factory functions
- [schema.ts](../../hush-cli/src/v3/schema.ts) — Schema constants, namespace/role validation
- [paths.ts](../../hush-cli/src/v3/paths.ts) — Path construction and detection
- [manifest.ts](../../hush-cli/src/v3/manifest.ts) — Manifest I/O
- [repository.ts](../../hush-cli/src/v3/repository.ts) — Repository loading
- [README.md](../../README.md) — V3 layout documentation
