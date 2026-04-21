# Migration Learning: moltworker

**Date:** 2026-04-21
**Project path:** `/Users/hassoncs/Workspaces/Personal/platform/opencode-ecosystem/archive/moltworker`

## Legacy evidence found

- `hush.yaml` with `version: 2`, `project: hassoncs/moltworker`
- `.hush.encrypted` (single shared encrypted source file)
- No `.hush/` v3 repo present at start
- `.envrc` correctly set `SOPS_AGE_KEY_FILE` to `~/.config/sops/age/keys/hassoncs-moltworker.txt`
- `.sops.yaml` present with a single age recipient

## Commands run

```bash
# Initial inspection
hush status
# → legacy-v2

# Dry run
hush migrate --from v2 --dry-run
# → 1/4 encrypted files found (shared only), 1 target, 1 repo ref

# Real migration
hush migrate --from v2
# → success

# Validation
hush status
# → v3, manifest.encrypted present, 5 encrypted files, 9 secrets readable

hush inspect
# → all 5 files readable, 9 sensitive values confirmed [redacted]

# Cleanup
hush migrate --from v2 --cleanup
# → removed hush.yaml, .hush.encrypted, .hush/migration-v2-state.json
```

Key file used: `SOPS_AGE_KEY_FILE=$HOME/.config/sops/age/keys/hassoncs-moltworker.txt`

## Migration result

Successful. No blockers.

Post-migration v3 layout:
- `.hush/manifest.encrypted` (14957 bytes)
- `.hush/files/env/` (5 encrypted files: shared, development, production, plus 2 target-specific docs)
- 3 identities (owner-local, member-local, ci)
- 3 bundles, 2 targets

## Validation result

- `hush status` reports `Repository: v3`
- `hush inspect` shows 5/5 files readable, all 9 secrets present and redacted
- No unreadable files
- Machine-local state fully initialized (active identity, audit log present)
- `package.json` scripts do not reference `hush decrypt` or any legacy Hush commands — no script updates needed

## Cleanup result

Successful. Removed:
- `hush.yaml`
- `.hush.encrypted`
- `.hush/migration-v2-state.json`

## Hush defects found

None. Migration was clean end-to-end.

## Project-specific quirks

- Only 1 of 4 declared source files (`shared`) actually existed encrypted. The `development`, `production`, and `local` sources were declared in `hush.yaml` but had no corresponding `.hush.development.encrypted` / `.hush.production.encrypted` / `.hush.local.encrypted` files. Hush handled this gracefully — dry run called them "missing" and migration proceeded without error.
- The migrated `inspect` output shows the shared secrets duplicated across `env/targets/root/production` and `env/targets/root/runtime` as well as `env/project/shared`. This appears to be expected v3 behavior when a v2 wrangler target is migrated.
- This is an archived repo. No active CI/CD pipeline using Hush was present.
