# Migration: firefly-vm-api-runtime/apps/api

**Date:** 2026-04-21
**Path:** `/Users/hassoncs/Workspaces/Personal/dev/mac-e2e/firefly-vm-api-runtime/apps/api`
**Project:** `firefly-api`
**Result:** Migrated via `hush migrate --from v2` after fixing two bugs in Hush CLI.

---

## What was here

- `hush.yaml` v2, `project: firefly-api`, one target `api` using `dotenv: .dev.vars`
- `.hush.encrypted` (shared secrets, 10 keys: Supabase, Stripe)
- `.dev.vars` — plaintext `ALPHA_API_KEY` (gitignored, not in encrypted store)
- `.sops.yaml` with `path_regex` matching legacy `.hush*.encrypted` pattern only

## What happened

### Bug 1: `.sops.yaml` path_regex didn't match v3 paths

The legacy `.sops.yaml` used `path_regex: .*\.hush(\..*)?(\.encrypted)?$` which matches
`.hush.encrypted` but not `.hush/manifest.encrypted` or `.hush/files/**.encrypted`.

**Root cause:** SOPS matches `path_regex` against the input file path. When Hush CLI
encrypts via `encryptWithFormat`, it passes a temp file in `/tmp/hush-sops-XXXX/staged.yaml`
as the input. The temp file path matches no creation rule.

**Fix applied to Hush CLI (`hush-cli/src/core/sops.ts`):**
Added `--filename-override "${outputPath}"` to SOPS encrypt calls so SOPS matches
`path_regex` against the intended output path (e.g., `.hush/manifest.encrypted`),
not the temp input path.

**Also updated `.sops.yaml`** to add a v3-compatible rule:
```yaml
creation_rules:
  - path_regex: .*\.hush/.*\.encrypted$
    age: <public-key>
  - path_regex: .*\.hush(\..*)?(\.encrypted)?$   # legacy compat
    age: <public-key>
```

### Bug 2: `hush.yaml` targets using `dotenv:` field instead of `format:`

The v2 `hush.yaml` used the `dotenv` key to specify the output file but no explicit `format` field:
```yaml
targets:
  - name: api
    path: ./
    dotenv: .dev.vars
```

`normalizeLegacyTargets` in `legacy-v2.ts` returned the array as-is, leaving `format: undefined`.
The manifest builder then stored `format: undefined` and downstream threw "Target format is required".

**Fix applied to Hush CLI (`hush-cli/src/v3/legacy-v2.ts`):**
When normalizing array-format targets, infer `format: 'dotenv'` when `format` is absent.
```ts
format: entry.format ?? (entry.dotenv !== undefined ? 'dotenv' : 'dotenv'),
```

## Outcome

- `.hush/` created: 1 manifest + 5 encrypted files (shared, dev, prod, api/runtime, api/production)
- `hush.yaml`, `.hush.encrypted` cleaned up
- `.dev.vars` removed (plaintext, gitignored, contained `ALPHA_API_KEY` not in encrypted store)
- `hush status`: `Repository: v3`, 5 encrypted files, 2 targets (`api`, `api-production`), active identity `owner-local`
- `hush inspect`: 5 readable files, 0 unreadable, 10 secrets (all redacted)

## Not in encrypted store

`ALPHA_API_KEY` was only in `.dev.vars` (gitignored plaintext), not in `.hush.encrypted`.
Deleted as stale plaintext. If still needed, it should be added via `hush set`.

## Bugs filed / fixed in Hush CLI

Both bugs fixed in `hush-cli/src/core/sops.ts` and `hush-cli/src/v3/legacy-v2.ts`.
These are in the prerelease-next worktree — changes not committed (migration-agent scope only).

- `encryptWithFormat`: needs `--filename-override outputPath` to support repos where `.sops.yaml`
  uses `path_regex` with patterns that don't match temp file paths
- `normalizeLegacyTargets` array path: must default `format` to `'dotenv'` when only `dotenv:` key present
