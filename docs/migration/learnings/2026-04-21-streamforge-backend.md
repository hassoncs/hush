# Migration Note: streamforge-backend

**Date:** 2026-04-21
**Project path:** `/Users/hassoncs/Workspaces/Personal/rad-media/streamforge-backend`
**Migration agent:** claude-sonnet-4-6

---

## Legacy evidence found

- `hush.yaml` with `version: 2`, `project: hassoncs/streamforge-backend`
- `.hush.encrypted` (shared source, 1 of 4 sources actually present)
- No `.hush/` v3 directory existed prior to migration
- Legacy sources declared but missing: `.hush.development.encrypted`, `.hush.production.encrypted`, `.hush.local.encrypted`
- 1 legacy target: `root` at `.` with `dotenv` format

## Commands run

```bash
# 1. Inspect state
bun <hush-cli> status
# → "Migration Required", repository: legacy-v2

# 2. Dry run
bun <hush-cli> migrate --from v2 --dry-run
# → 1 encrypted file found, 1 target, 5 refs to review (4 missing)

# 3. Actual migration
bun <hush-cli> migrate --from v2
# → Created .hush/manifest.encrypted + files/, success

# 4. Validate with age key
SOPS_AGE_KEY_FILE=~/.config/sops/age/keys/hassoncs-streamforge-backend.txt bun <hush-cli> status
# → Repository: v3, manifest present, 5 encrypted files, 0 unreadable

SOPS_AGE_KEY_FILE=... bun <hush-cli> inspect
# → 5 readable files, 0 unreadable, 14 secrets all present

# 5. Cleanup
SOPS_AGE_KEY_FILE=... bun <hush-cli> migrate --from v2 --cleanup
# → Removed hush.yaml, .hush.encrypted, .hush/migration-v2-state.json
```

## Migration result

Success. `.hush/manifest.encrypted` and `.hush/files/` created from `.hush.encrypted`.

## Validation result

All 5 encrypted files readable with the age key at `~/.config/sops/age/keys/hassoncs-streamforge-backend.txt`. All 14 secrets (CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET, CLOUDFLARED_TUNNEL_TOKEN, COMET_PROVIDER_NAME, COMET_URL, JELLYFIN_URL, MEDIA_ROOT, OMDB_API_KEY, PORT, STATE_DIR, STREAMFORGE_API_KEYS, TMDB_API_KEY, TMDB_API_READ_ACCESS_TOKEN, TORBOX_API_KEY) confirmed present via `inspect`.

## Cleanup result

Complete. Legacy files removed:
- `hush.yaml`
- `.hush.encrypted`
- `.hush/migration-v2-state.json`

Only `.hush/manifest.encrypted` and `.hush/files/` remain.

## Package scripts

No changes needed. `package.json` scripts already used `hush run --` (v3-compatible). No `hush decrypt` or `hush unsafe:decrypt` references found anywhere in the project.

## Hush defects found

None. Migration completed without errors or unexpected behavior.

## Project-specific quirks

- Only 1 of 4 declared legacy sources was present (`shared`). The three missing sources (development, production, local) were declared in `hush.yaml` but had no corresponding encrypted files. Hush handled these gracefully during dry-run and migration without errors.
- `hush status` without the age key set shows two status blocks (one v3 "present", one "missing" with decryption error) before failing. This is cosmetically confusing but not a bug — it reflects the two-pass design.
- The age key filename (`hassoncs-streamforge-backend.txt`) matched the project slug exactly, making key discovery straightforward.
