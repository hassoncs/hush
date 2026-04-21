# Migration Learning: opencode-ecosystem

**Date:** 2026-04-21
**Project:** `hassoncs/opencode-ecosystem`
**Path:** `/Users/hassoncs/Workspaces/Personal/platform/opencode-ecosystem`
**Result:** Migrated — v2 → v3 complete

## What Was Migrated

- 1 encrypted source (`shared` / `.hush.encrypted`) → v3 `.hush/files/env/project/shared.encrypted`
- 21 legacy targets → 42 v3 targets (runtime + production views per target)
- 43 command references found in docs
- `hush.yaml` and `.hush.encrypted` removed during cleanup

## Blockers Encountered

### 1. `collectCommandReferences` crashes on broken symlinks (hush bug)

The walker in `migrate.ts` calls `statSync` without try/catch. Two broken symlinks in `config-symlinks/` (`oh-my-opencode.json`, `model-preferences.json`) caused immediate crash.

**Fix applied to hush source:** wrapped `statSync` in try/catch to skip broken/inaccessible paths.

### 2. `collectCommandReferences` traverses pnpm virtual stores and sub-repos (hush bug / perf issue)

The walker skips `node_modules` and `.git` but not `.pnpm-store` or `.worktrees`. This monorepo has `bottown/.pnpm-store/v10` which contains symlink-chained virtual store entries resolving to deleted worktrees — caused ENOENT crashes and infinite traversal.

Additionally, this monorepo contains 11 embedded sub-repos with their own `.git` directories. Without skipping these, the walker would traverse ~55,000 markdown/package files (took >5 minutes, pegged CPU).

**Fix applied to hush source (`migrate.ts` `collectCommandReferences`):**
- Added `.pnpm-store` and `.worktrees` to the skip list alongside `node_modules`
- Added `dist`, `build`, `.cache`, `coverage` to skip list
- Added sub-repo detection: check if a directory has its own `.git` and skip it
- Reduced traversal from ~55,000 files to ~800 files; dry-run completes in seconds

## Key Details

- Age key: `age1mykk3hgxdmy8uvg57a9l93r58eq8w50pxtr7pvhad9y3f4w0agks3fw85g`
- Local key file: `~/.config/sops/age/keys/hassoncs-opencode-ecosystem.txt`
- Key was present locally; `SOPS_AGE_KEY_FILE` must be set to run hush commands (not auto-detected in this shell environment)
- `.gitignore` had no bare `.hush` entry — gitignore hazard was not present
- Sub-directory `archive/moltworker` already had v3; the walker correctly skips `.hush` dirs

## Stale Docs References

`hush decrypt` appears in root-level architecture docs (docs-only, not active scripts):
- `docs/architecture/DELL-BOOTSTRAP.md`
- `docs/architecture/BOOTSTRAP-ARCHITECTURE.md`
- `docs/architecture/FLY-BOOTSTRAP.md`
- `docs/architecture/CONFIG-SECRETS-DEPLOYMENT-SYNTHESIS.md`
- `opencode-worker-container/universal-daemon/ecosystem/skills/hush-secrets/SETUP.md` (comment only)

These are historical reference docs, not active runbooks. No shell scripts with active `hush decrypt` calls found.

## Hush Bug Filed

The two issues above (broken symlink crash + missing directory exclusions causing O(55k) traversal) should be filed as hush bugs. The fixes were applied directly to hush source and rebuilt before migration.
