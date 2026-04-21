# Migration Learning: forward-email skill

**Date:** 2026-04-21
**Project:** `hassoncs/forward-email-skill`
**Path:** `platform/opencode-ecosystem/opencode-worker-container/universal-daemon/ecosystem/skills/forward-email`

## Pre-Migration State

- Layout: legacy v2 (`hush.yaml` + `.hush.encrypted`)
- 1 encrypted source file (`shared`), 3 missing (`development`, `production`, `local`)
- 1 target (`skill`, dotenv format)
- Not a git repo (standalone skill dir)
- Key present at `~/.config/sops/age/keys/hassoncs-forward-email-skill.txt`

## Migration Path

Encrypted file existed → used `hush migrate --from v2` (not bootstrap).

Dry-run was clean with no blockers. Migration succeeded on first attempt.

## Post-Migration State

- 5 encrypted files under `.hush/files/`
- `manifest.encrypted` with 2 targets (`skill/production`, `skill/runtime`), 3 bundles
- 13 secrets total in `shared` bundle — all `FORWARD_EMAIL_*` credentials
- `hush inspect`: 5 readable, 0 unreadable
- Cleanup removed: `hush.yaml`, `.hush.encrypted`, `.hush/migration-v2-state.json`

## .gitignore

Migration auto-fixed `.gitignore` — removed bare `.hush` line, added `.hush-materialized/`. Leftover `!.hush.encrypted` / `!.hush.*.encrypted` exceptions are now orphaned but harmless; could be pruned manually.

## Key Resolution

`hush status` without `SOPS_AGE_KEY_FILE` set fails with "no identity matched". Key file naming convention `hassoncs-forward-email-skill.txt` matches project slug. All runtime commands need key in env unless shell profile sets it.

## No Issues

Straightforward single-file v2 migration. No hazards, no stale scripts, no plaintext files found. No `.hush` gitignore blocker (known defect did not apply here).
