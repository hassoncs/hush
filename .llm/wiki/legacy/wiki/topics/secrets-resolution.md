---
title: Secrets Resolution
last_compiled: 2026-04-22
sources: 4
coverage: high
topic_type: stable
---

# Secrets Resolution

## Summary [coverage: high -- 4 sources]

Secrets resolution is the process by which Hush takes a bundle or target name, discovers all contributing encrypted files (local and imported), checks identity-based access, selects winning values via precedence rules, interpolates variable references, and returns a typed result. The resolution engine (`resolveV3Bundle`, `resolveV3Target`) is the core of how hush provides secrets to any command. It enforces namespace containment, detects conflict scenarios, and logs audit events.

## Architecture [coverage: high -- 4 sources]

### Resolution Pipeline
```
resolveV3Target(name)
  └── resolveV3Bundle(bundleName)
        ├── 1. Resolve identity (active or explicit)
        ├── 2. Collect bundle candidates (local + imported + traversed imports)
        ├── 3. Partition readable files (check readers against identity + roles)
        ├── 4. Materialize candidates (load full file entries)
        ├── 5. Select winners (group by path, pick highest precedence)
        ├── 6. Detect conflicts (equal-precedence contenders → error)
        ├── 7. Interpolate variables ($REF substitution)
        └── 8. Return HushBundleResolution (values + artifacts + conflicts)
```

### Key Types

- **`ResolveV3BundleOptions`**: Store, repository, imported repos, active identity, command context, import precedence.
- **`HushBundleResolution`**: Identity, bundle name, values (KEY→resolved), artifacts, readable files, unreadable files, conflicts.
- **`HushTargetResolution`**: Bundle resolution + target name.
- **`HushSelectedEntryCandidate`**: Path, entry, precedence, provenance chain.

### Precedence System
- **Local** default precedence: 200
- **Imported** default precedence: 100
- Higher precedence wins. Equal precedence on same path → `HushResolutionConflictError`.

### Provenance Tracking
Every resolved value carries a `provenance` array of `HushProvenanceRecord` entries, tracking the namespace, file path, bundle name, and import chain that contributed to the value.

## Key Decisions [coverage: high -- 3 sources]

- **Import cycles are fatal** — Bundle traversal maintains a stack of `repoRoot::bundleName` pairs and throws on revisit.
- **Local-over-imported by default** — Local values (precedence 200) override imported values (precedence 100), but the `importPrecedence` flag can flip this.
- **Strict namespace containment** — Entry logical paths must stay within their file's namespace. A file at `env/project/shared` can only contain `env/...` entries.
- **Audit logging is mandatory** — Every resolution logs audit events for access denials, import resolutions, and identity changes.

## API Surface [coverage: high -- 2 sources]

### Core Functions
- `resolveV3Bundle(ctx, options)` — Resolves a named bundle, returns `HushBundleResolution`.
- `resolveV3Target(ctx, options)` — Resolves a named target (looks up target→bundle, then resolves bundle).
- `collectBundleCandidates(options)` — Gathers all file candidates from local + imported bundles with precedence.
- `selectWinningCandidates(candidates)` — Groups by path, picks max precedence, detects conflicts.
- `interpolateCandidates({ candidates, globalPathState })` — Substitutes `$REF` variable references across selected candidates.

### Error Types
- **`HushResolutionConflictError`**: Thrown when equal-precedence contenders exist for the same logical path. Contains the `conflicts` detail array.

## Usage Patterns [coverage: medium -- 2 sources]

### Debugging Resolution
```bash
hush resolve runtime           # Show what the 'runtime' target resolves to
hush resolve api-workers       # Resolve a specific target
```

### Variable Tracing
```bash
hush trace DATABASE_URL        # Follow DATABASE_URL through all contributing files
```

### Bundle Diffing
```bash
hush diff                      # Compare runtime target against HEAD
hush diff --bundle project     # Compare a bundle against HEAD
hush diff --ref HEAD~1         # Compare against specific git ref
```

## Troubleshooting [coverage: medium -- 2 sources]

- **`HushResolutionConflictError`** — Two files contribute to the same logical path with equal precedence. Fix by removing redundant file refs from the bundle or adjusting reader precedence.
- **"Bundle requires unreadable file(s)"** — Active identity lacks role/access for a file the bundle references. Run `hush config readers <file> --roles owner,member` to expand access.
- **"Import cycle detected"** — Bundle A imports bundle B which imports bundle A. Restructure imports to form a DAG.

## Related Topics

- [v3-repository-model](v3-repository-model.md)
- [materialization](materialization.md)
- [identity-based-access-control](../concepts/identity-based-access-control.md)
- [bundle-composition](../concepts/bundle-composition.md)

## Sources

- [resolver.ts](../../hush-cli/src/v3/resolver.ts) — Resolution engine
- [imports.ts](../../hush-cli/src/v3/imports.ts) — Bundle candidate collection, import traversal
- [interpolation.ts](../../hush-cli/src/v3/interpolation.ts) — Variable interpolation
- [provenance.ts](../../hush-cli/src/v3/provenance.ts) — Conflict and provenance types
