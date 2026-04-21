# Migration Note: firefly-monorepo-runtime

**Date:** 2026-04-21
**Project path:** `/Users/hassoncs/Workspaces/Personal/apps/firefly-monorepo/apps/runtime`
**Migration agent:** claude-sonnet-4-6

---

## Legacy evidence found

- `hush.yaml` with `version: 2`, `project: firefly/runtime`
- `.hush.encrypted` (shared source, 1 of 4 sources actually present)
- No `.hush/` v3 directory existed prior to migration
- Legacy sources declared but missing: `.hush.development.encrypted`, `.hush.production.encrypted`, `.hush.local.encrypted`
- 1 legacy target: `runtime` at `.` with `dotenv` format

## Commands run

```bash
# 1. Inspect state
bun <hush-cli> status
# → "Migration Required", repository: legacy-v2

# 2. Dry run
bun <hush-cli> migrate --from v2 --dry-run
# → 1 encrypted file found, 1 target, 1 repo ref to review (3 missing sources)

# 3. Actual migration
bun <hush-cli> migrate --from v2
# → Created .hush/manifest.encrypted + files/, updated .gitignore, success

# 4. Validate with age key
SOPS_AGE_KEY_FILE=~/.config/sops/age/keys/firefly-runtime.txt bun <hush-cli> status
# → Repository: v3, 1 manifest file, 5 encrypted files, 3 identities, 3 bundles, 2 targets

SOPS_AGE_KEY_FILE=... bun <hush-cli> inspect
# → 5 readable files, 0 unreadable, 13 secrets confirmed present

# 5. Cleanup
SOPS_AGE_KEY_FILE=... bun <hush-cli> migrate --from v2 --cleanup
# → Removed hush.yaml, .hush.encrypted, .hush/migration-v2-state.json
```

## Migration result

Success. `.hush/manifest.encrypted` and `.hush/files/` created from `.hush.encrypted`. Gitignore auto-updated (bare `.hush` entry removed, `.hush-materialized/` kept).

## Validation result

All 5 encrypted files readable with the age key at `~/.config/sops/age/keys/firefly-runtime.txt`. All 13 secrets (ACCOUNT_ID, AGENT_BACKEND_TYPE, AGENT_BACKEND_URL, AGENT_GATEWAY_PORT, AGENT_REQUEST_TIMEOUT_MS, FIREFLY_API_BASE, HEARTBEAT_INTERVAL_MS, RUNTIME_AUTH_TOKEN, RUNTIME_ID, RUNTIME_TENANT_ID, SHIM_HEALTH_PORT, SHIM_VERSION, TASK_POLL_INTERVAL_MS) confirmed present via `inspect` across shared, production, and runtime target variants.

## Cleanup result

Complete. Legacy files removed:
- `hush.yaml`
- `.hush.encrypted`
- `.hush/migration-v2-state.json`

Only `.hush/manifest.encrypted` and `.hush/files/` remain alongside the existing `.sops.yaml`.

## Package scripts

No changes needed. No `hush decrypt` or `hush unsafe:decrypt` references found anywhere in the project scripts, Dockerfiles, or shell scripts.

## Hush defects found

None. Migration completed cleanly without errors.

## Project-specific quirks

- This is an app inside the `firefly-monorepo` monorepo. Hush treated it as a standalone project (its own `hush.yaml` at the app root) with no parent inheritance issues.
- `hush status` without the age key set shows a dual-block output (v3 "present" + "missing" decryption error). Cosmetically confusing but correct behavior — not a bug.
- The age key (`firefly-runtime.txt`) was already present locally, matching the project slug. No `hush keys setup` required.
- `.sops.yaml` was retained post-cleanup (correct — still needed for SOPS key routing to the age recipient).
- Inspect showed secrets replicated across 3 file variants: `env/project/shared`, `env/targets/runtime/production`, `env/targets/runtime/runtime`. This is normal v3 target expansion from the single v2 shared source.
