# Topic: V3 Repository Model

> Encrypted document system with manifest, file documents, and index.

## Overview

Hush v3 stores all configuration authority in encrypted documents under `.hush/`. This model replaces the legacy v2 plaintext `hush.yaml` + encrypted payload hybrid.

## File Layout

```
.hush/
├── manifest.encrypted    # SOPS-encrypted YAML containing manifest document
└── files/
    ├── env/
    │   └── project/
    │       └── shared.encrypted    # Encrypted file document
    └── artifacts/                  # File-artifact documents
```

## Manifest Document

The manifest (`hush-cli/src/v3/domain.ts:HushManifestDocument`) contains:

```yaml
version: 3
activeIdentity: developer-local
identities:
  developer-local:
    roles: [owner]
  ci:
    roles: [ci]
imports:
  shared-platform:
    project: github.com/example/platform
    pull:
      bundles: [bundles/platform/runtime]
      files: [env/platform/shared]
files:
  env/project/shared:
    readers:
      roles: [owner, member, ci]
      identities: [developer-local, ci]
    sensitive: false
    entries:
      env/apps/web/API_URL:
        value: https://api.example.com
        sensitive: false
bundles:
  web-runtime:
    files:
      - path: env/project/shared
targets:
  web-dev:
    bundle: web-runtime
    format: dotenv
```

### Key fields

- **`version`** — Must equal `V3_SCHEMA_VERSION` (validated by `createManifestDocument`)
- **`activeIdentity`** — Selector for which identity is currently operating
- **`identities`** — Map of identity name → `{ roles: HushRole[], description? }`
- **`fileIndex`** — Index of file documents: path → `{ readers, sensitive, logicalPaths[] }`
- **`imports`** — Cross-project pull relationships
- **`bundles`** — File + import composition
- **`targets`** — Consumer surfaces referencing bundles

## File Document

Each `.encrypted` file under `.hush/files/` is a SOPS-encrypted YAML containing:
- **`path`** — Namespaced path (validated by `assertNamespacedPath`)
- **`readers`** — `{ roles: HushRole[], identities: HushIdentityName[] }`
- **`sensitive`** — Default exposure posture for the file
- **`entries`** — Map of logical path → value or artifact descriptor

### Entry Types

- **`HushValueEntry`** — `{ value: HushScalarValue, sensitive: boolean }`
- **`HushArtifactFileEntry`** — `{ type: 'file', format, sensitive, value?, filename?, subpath? }`
- **`HushArtifactBinaryEntry`** — `{ type: 'binary', format, sensitive, value?, encoding? }`

### Namespace Validation

Entry paths MUST stay inside their file's namespace. `createFileDocument` validates that `getNamespaceFromPath(logicalPath) === getNamespaceFromPath(file.path)`. This ensures topology integrity — you cannot mix `env/` and `artifacts/` entries in the same file.

## File Index

The `fileIndex` is a lightweight index embedded in the manifest that tracks:
- File paths and their readers metadata
- Logical paths contained in each file
- Used for quick lookup without decrypting files

`createFileIndexEntry()` derives the index from a `HushFileDocument`.

## Repository Loading

`requireV3Repository()` (in `hush-cli/src/commands/v3-command-helpers.ts`) loads the repository by:
1. Finding the project root
2. Locating `.hush/manifest.encrypted`
3. Decrypting the manifest via SOPS
4. Loading all `.hush/files/*.encrypted` documents
5. Building the domain model

## Creation and Validation

All creation functions (`createManifestDocument`, `createFileDocument`, `createBundleDefinition`, `createTargetDefinition`) normalize and validate input. They are the authoritative gatekeepers for repository consistency.

> Sources: `hush-cli/src/v3/domain.ts` (lines 1-443) — all domain types, constructors, validation; `docs/HUSH_V3_SPEC.md` (lines 147-498) — unified config model, schema reference; `hush-cli/src/v3/repository.ts` — repository loading; `README.md` (lines 85-93) — current v3 repository model summary
