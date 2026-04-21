# Migration Note: canary-service

**Date:** 2026-04-21
**Project path:** `/Users/hassoncs/Workspaces/Personal/canary-service`
**Status:** Migrated to v3

---

## Legacy evidence found

- `hush.yaml` with `version: 2`, `project: hassoncs/canary-service`
- `.hush.encrypted` (1 encrypted source file — shared secrets)
- `.sops.yaml` with age public key `age1flz70tmxxx4wqxyehqg8k7wnvzyduw438wng8gj3lmjs6ll9f30slwpkkd`
- Age private key present at `~/.config/sops/age/keys/hassoncs-canary-service.txt`
- 3 missing optional sources: `.hush.development.encrypted`, `.hush.production.encrypted`, `.hush.local.encrypted`
- No `hush decrypt` usage in scripts or CI (already using `hush run`)
- No bare `.hush` entry in `.gitignore` (no gitignore hazard)
- Stale doc references to `.hush.encrypted` / `hush.yaml` in `AGENTS.md` and `DEPLOYMENT.md`

---

## Commands run

```bash
# 1. Inspect
hush status
# → Repository: legacy-v2, migration required

hush migrate --from v2 --dry-run
# → 1/4 encrypted files found, 3 targets, 3 refs to review

# 2. Migrate
hush migrate --from v2
# → Created .hush/manifest.encrypted and file documents
# → Migrated machine-local overrides, validated v3 state

# 3. Validate (key file required — SOPS_AGE_KEY env not set by default)
SOPS_AGE_KEY_FILE=~/.config/sops/age/keys/hassoncs-canary-service.txt hush status
# → Repository: v3, Active identity: owner-local
# → manifest files: 1, encrypted files: 7, identities: 3, bundles: 5, targets: 4

SOPS_AGE_KEY_FILE=~/.config/sops/age/keys/hassoncs-canary-service.txt hush inspect
# → Readable files: 7, Unreadable: 0
# → 8 vars in env/project/shared, production and runtime targets for api and root

# 4. Cleanup
SOPS_AGE_KEY_FILE=~/.config/sops/age/keys/hassoncs-canary-service.txt hush migrate --from v2 --cleanup
# → Removed hush.yaml, .hush.encrypted, .hush/migration-v2-state.json

# 5. Fix stale docs
# AGENTS.md line 33: `.hush.encrypted` → `.hush/ v3 repo`
# DEPLOYMENT.md line 73: removed reference to `.hush.encrypted` and `hush.yaml`
```

---

## Migration result

Standard happy-path migration. One real encrypted source file (`.hush.encrypted`) migrated cleanly to v3 `.hush/` layout. The 3 missing sources (development, production, local) were correctly inventoried and skipped.

---

## Validation result

- `hush status` → `Repository: v3`, `Active identity: owner-local`
- `hush inspect` → 7 readable files, 0 unreadable files
- 8 secrets confirmed readable across shared, production, and runtime bundles

---

## Cleanup result

- `hush migrate --from v2 --cleanup` succeeded cleanly
- Removed: `hush.yaml`, `.hush.encrypted`, `.hush/migration-v2-state.json`
- Remaining legacy gitignore entries (`.hush.local`, `.hush.local.encrypted`) are harmless and intentional

---

## Stale scripts/docs fixed

- `AGENTS.md`: updated secrets section from `.hush.encrypted` to `.hush/ v3 repo`
- `DEPLOYMENT.md`: removed reference to `.hush.encrypted` and `hush.yaml` in secrets management paragraph

No package.json scripts required changes (no `hush decrypt` usage present).

---

## Project-specific quirks

- `SOPS_AGE_KEY_FILE` must be set explicitly — no `.envrc` or shell config wires it automatically for this project. Operators need to export it or use `direnv` to auto-load.
- `hush.yaml` had a duplicate `api` target definition (two identical entries). This was a pre-existing authoring error; migration handled it without issue.
- No `.hush` bare entry in `.gitignore` — the known v3 gitignore hazard was not present here.

---

## Hush defects observed

None new. Migration went cleanly. The key-not-loaded error surface (SOPS_AGE_KEY_FILE not set) is expected behavior, not a defect.
