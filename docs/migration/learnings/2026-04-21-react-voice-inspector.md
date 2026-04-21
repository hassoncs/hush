# Migration Note: react-voice-inspector

**Date:** 2026-04-21
**Project path:** `/Users/hassoncs/Workspaces/Personal/dev/react-voice-inspector`

## Legacy evidence found

- `hush.yaml` with `version: 2`
- `.hush.template` (documentation/template only, never encrypted)
- `.sops.yaml` with age public key
- No encrypted source files existed (`.hush.encrypted`, `.hush.development.encrypted`, `.hush.production.encrypted`, `.hush.local.encrypted` all missing)
- `.gitignore` contained `.hush` (bare directory entry) which would block v3 files from being committed

## Commands run

```bash
# Status check (run from project root)
bun ".../hush-cli/dist/cli.js" status
# → "legacy-v2", migration required

# Dry-run
bun ".../hush-cli/dist/cli.js" migrate --from v2 --dry-run
# → 0/4 encrypted files found, 3 targets, 1 repo ref to review

# Real migration
bun ".../hush-cli/dist/cli.js" migrate --from v2

# Post-migration validation
bun ".../hush-cli/dist/cli.js" status   # → Repository: v3
bun ".../hush-cli/dist/cli.js" inspect  # → 6 readable files, 0 unreadable

# Cleanup
bun ".../hush-cli/dist/cli.js" migrate --from v2 --cleanup
```

## Migration result

Success. `.hush/manifest.encrypted` and 6 `.hush/files/env/**/*.encrypted` documents created from the v2 config, even though no legacy encrypted data existed. The v3 repo skeleton was initialized correctly.

## Validation result

`hush status` reports v3. `hush inspect` shows 6 readable encrypted file documents (shared, development, production, plus per-target runtime files for root, extension, landing), 0 unreadable. All 3 identities (owner, member, ci) present.

## Cleanup result

Success. `hush.yaml` removed, `.hush/migration-v2-state.json` removed.

## Project-specific quirks

**Partially initialized repo** — this project had a `hush.yaml` and `.hush.template` but had never actually encrypted any secrets. There were zero legacy encrypted source files. Migration still succeeded cleanly, producing an empty-but-valid v3 repo shell ready for `hush set` usage.

**`.gitignore` hazard (manual fix required):** The legacy `.gitignore` contained:
```
.hush
.hush.*
!.hush.template
```
The bare `.hush` entry would silently prevent the newly created `.hush/` directory from ever being committed. This had to be fixed manually before the repo was usable:
```
# Fixed to:
.hush.*
!.hush.template
```
The `hush migrate` command does not fix `.gitignore` automatically. This is a potential footgun for any repo that followed the v2 gitignore pattern.

**No CI or package script changes needed** — the CI workflow has no hush steps, and no package.json scripts reference hush commands directly (hush is only a devDependency).

## Hush defects found

**Potential defect (non-blocking): `hush migrate` does not detect or fix `.hush`-ignoring `.gitignore` entries.**

- Severity: non-blocking (migration succeeds), but causes silent data loss risk — migrated encrypted files are silently ignored by git if the user does not notice the gitignore issue.
- Repro: any repo with `.hush` (bare entry, not `/.hush/`) in `.gitignore` + `hush migrate --from v2`
- After migration: `git status` shows `.hush/` as ignored, user cannot commit the v3 files without manually fixing gitignore
- Suggested fix: `hush migrate` should detect this pattern in `.gitignore` and either warn loudly or offer to fix it automatically
- Does not block migration itself, only blocks committing results
