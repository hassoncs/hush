# Migration Note: platform/ghost-browser

**Date:** 2026-04-21
**Project path:** `/Users/hassoncs/Workspaces/Personal/platform/ghost-browser`
**Status:** Migrated to v3

---

## Legacy evidence found

- `hush.yaml` with `version: 2`, `project: ghost-browser`
- `.sops.yaml` with age public key `age1zhuw50cafekeqsxw6t2e3ggdj2eac4ndxkuwvlzc9cp2cle76v4sf866qw`
- `.hush.encrypted` — 1 encrypted source file present (shared secrets)
- `.hush.development.encrypted`, `.hush.production.encrypted`, `.hush.local.encrypted` — all missing
- 1 target: `root` at `.` with `format: dotenv`
- `.gitignore` had v2-era entries: `.hush.encrypted`, `.sops.yaml`, `hush.yaml`

---

## Commands run

```bash
# 1. Inspect
hush status
# → Repository: legacy-v2

hush migrate --from v2 --dry-run
# → 1/4 encrypted files found, 1 target, 5 repo refs to review
# → Clean dry-run, no blockers

# 2. Migrate
hush migrate --from v2
# → Migration complete — .hush/ created, manifest and file docs written

# 3. Validate (key not in SOPS_AGE_KEY path, must use explicit SOPS_AGE_KEY_FILE)
SOPS_AGE_KEY_FILE=~/.config/sops/age/keys/ghost-browser.txt hush status
# → Repository: v3, Active identity: owner-local
# → 1 manifest file, 5 encrypted files, 3 identities, 2 targets

SOPS_AGE_KEY_FILE=~/.config/sops/age/keys/ghost-browser.txt hush inspect
# → Readable files: 5, Unreadable: 0
# → Secrets present: CLOUDFLARE_BROWSER_RUN_ACCOUNT_ID, CLOUDFLARE_BROWSER_RUN_API_TOKEN

# 4. Cleanup
SOPS_AGE_KEY_FILE=~/.config/sops/age/keys/ghost-browser.txt hush migrate --from v2 --cleanup
# → Removed: hush.yaml, .hush.encrypted, .hush/migration-v2-state.json

# 5. Manual cleanup
rm .sops.yaml     # v2 leftover, not removed by --cleanup
# Updated .gitignore — removed stale v2 entries (.hush.encrypted, .sops.yaml, hush.yaml)
# Replaced with comment noting .hush/ dir is committed in v3
```

---

## Migration result

Straight `hush migrate --from v2` — no bootstrap needed. Exactly one encrypted source file existed, key was present locally and in 1Password. Migration completed without issues.

---

## Validation result

- `hush status` → `Repository: v3`, `Active identity: owner-local`
- `hush inspect` → 5 readable files, 0 unreadable files
- Secrets: `CLOUDFLARE_BROWSER_RUN_ACCOUNT_ID`, `CLOUDFLARE_BROWSER_RUN_API_TOKEN` (redacted, confirmed readable)

---

## Cleanup result

- `hush migrate --from v2 --cleanup` removed: `hush.yaml`, `.hush.encrypted`, `.hush/migration-v2-state.json`
- `.sops.yaml` **not removed by --cleanup** — required manual removal
- `.gitignore` updated to remove stale v2 ignore rules
- `.hush/` is untracked (not gitignored, ready to commit)

---

## Project-specific quirks

- Key lives at `~/.config/sops/age/keys/ghost-browser.txt` and in 1Password. SOPS_AGE_KEY_FILE must be set explicitly since the key file name matches the project slug but is not auto-loaded by the shell environment in this project.
- Only `shared` source had real secrets (2 Cloudflare vars). Development/production/local source files were absent — those layers simply don't exist for this project.
- `.gitignore` had `.sops.yaml` marked as ignored — a v2-era pattern. Fixed.

---

## Hush defects found

### Note: `hush migrate --from v2 --cleanup` does not remove `.sops.yaml`

`.sops.yaml` is a v2 leftover (holds SOPS creation rules for the old flat-file layout). After v3 migration, it serves no purpose — the manifest carries its own SOPS config. The `--cleanup` step removed `hush.yaml` and `.hush.encrypted` but left `.sops.yaml` in place.

**Severity:** Low — no functional impact, just clutter. Could confuse a future reader into thinking SOPS is still configured via `.sops.yaml`.

**Workaround:** Manual `rm .sops.yaml` after `--cleanup`.

**Suggestion:** `--cleanup` should also remove `.sops.yaml` (or at minimum emit a note that it can be safely deleted).
