# Topic: Secrets Resolution Engine

> How `resolveV3Bundle` turns a bundle into resolved key-value pairs.

## Overview

The resolution engine (`hush-cli/src/v3/resolver.ts`) is the core of Hush v3. It takes a named bundle and produces a `HushBundleResolution` containing resolved values and artifacts, with file provenance tracking.

## Entry Points

- **`resolveV3Bundle()`** — Resolves a named bundle into values + artifacts
- **`resolveV3Target()`** — Resolves a target by first looking up its bundle, then calling `resolveV3Bundle()`

## Resolution Pipeline

### 1. Identity Resolution

```typescript
resolveIdentity(ctx, options)
```
- If `options.activeIdentity` is provided, validates it exists in the manifest
- Otherwise calls `requireActiveIdentity()` to determine the active identity from store context

### 2. Candidate Collection

```typescript
collectBundleCandidates({ repository, bundleName, importedRepositories, localPrecedence, importedPrecedence })
```
- Collects all files referenced by the bundle definition
- Includes files from imported bundles and cross-project imports
- Assigns precedence values: local files = 200, imported files = 100 (configurable)

### 3. Readability Partition

```typescript
partitionReadableCandidates(repository, importedRepositories, identity, candidates)
```
For each candidate:
- Gets the identity's roles from the repository
- Calls `canReadFile(file, identity, roles)` which checks `isIdentityAllowed(file.readers, identity, role)`
- Separates into readable vs unreadable
- Builds `globalPathState` — every logical path mapped to its readable/unreadable files across all repositories

**If any required file is unreadable**:
- An audit event is appended (`access_denied`)
- Resolution throws: `Bundle "X" requires unreadable file(s) for identity "Y": ...`

### 4. Readable File Materialization

```typescript
materializeReadableCandidates(candidates)
```
- Loads each readable file document via `repository.loadFile(path)`
- Expands into individual entry candidates with provenance records

### 5. Winner Selection (Conflict Detection)

```typescript
selectWinningCandidates(candidates)
```
Groups candidates by logical path and selects winners by highest precedence:

- **Single winner** — path resolves to that value
- **Multiple winners at same precedence** — **CONFLICT DETECTED**
  - `HushResolutionConflictError` is thrown with all contenders and their provenance
  - Conflicts mean equal-precedence sources define the same logical path

### 6. Interpolation

```typescript
interpolateCandidates({ candidates: selected, globalPathState })
```
- Resolves `${ref}` placeholders in values
- Interpolation cannot bypass file ACLs — if a source file is unreadable, resolution fails
- Circular interpolation detection should produce clear errors

### 7. Node Splitting

```typescript
splitResolvedNodes(nodes)
```
Separates resolved nodes into:
- **values** — scalar entries (`HushValueEntry`)
- **artifacts** — entries with `type` field (`HushArtifactFileEntry` or `HushArtifactBinaryEntry`)

### 8. Resolution Result

Returns `HushBundleResolution`:
```typescript
{
  identity: HushIdentityName,        // Active identity used
  bundle: HushBundleName,            // Bundle resolved
  values: Record<path, HushResolvedNode>,
  artifacts: Record<path, HushResolvedNode>,
  files: string[],                   // Files resolved
  unreadableFiles: string[],
  conflicts: HushBundleConflictDetail[],
}
```

## Import Precedence

The `importPrecedence` option controls whether local or imported values win on precedence ties:
- `'local'` (default): local=200, imported=100
- `'imported'`: local=100, imported=200

## Audit Events

Resolution appends:
- `access_denied` when required files are unreadable
- `import_resolution` for each imported project encountered

## Source Attribution

> Sources: `hush-cli/src/v3/resolver.ts` (lines 1-317) — `resolveV3Bundle`, `resolveV3Target`, candidate collection, conflict detection; `hush-cli/src/v3/interpolation.ts` — interpolation logic; `hush-cli/src/v3/imports.ts` — `collectBundleCandidates`, `collectAllRepositoryPaths`; `hush-cli/src/v3/provenance.ts` — `HushResolvedNode`, `HushBundleConflictDetail` types
