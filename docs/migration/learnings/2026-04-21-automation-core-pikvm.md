# Migration Note: home/automation-core/pikvm

**Date:** 2026-04-21
**Project path:** `/Users/hassoncs/Workspaces/Personal/home/automation-core/pikvm`
**Status:** Migrated to v3

---

## Legacy evidence found

- `hush.yaml` with `version: 2`, `project: hassoncs/pikvm`, 1 target (`root`, dotenv format)
- `.hush.encrypted` (1 encrypted source file with `PIKVM_PASSWORD`)
- `.sops.yaml` present with age recipient `age1e4xhmfus6lp3tqes8f2d3jg7fqf0ghh2cjyy4vl653yurlvdg4wslvprq7`
- Local age key present at `~/.config/sops/age/keys/hassoncs-pikvm.txt`
- No `.envrc` — `SOPS_AGE_KEY_FILE` must be set manually

---

## Nested project note

This is a subdirectory inside `automation-core/`, which itself is still a v2 legacy repo. Migrated `pikvm` as an independent Hush repo per instructions. The parent repo's `.gitignore` had `.hush/` which blocked the v3 `.hush/` directory from being committed — fixed by adding negation exceptions (see below).

---

## Commands run

```bash
# 1. Inspect current state
hush status
# → Repository: legacy-v2

hush migrate --from v2 --dry-run
# → 1/4 encrypted files found (.hush.encrypted), 1 target
# → Ready to migrate

# 2. Run migration
hush migrate --from v2
# → Migration complete. .hush/ created, manifest.encrypted written.

# 3. Validate (SOPS_AGE_KEY_FILE required — no .envrc in this repo)
SOPS_AGE_KEY_FILE=~/.config/sops/age/keys/hassoncs-pikvm.txt hush status
# → Repository: v3, Active identity: owner-local

SOPS_AGE_KEY_FILE=~/.config/sops/age/keys/hassoncs-pikvm.txt hush inspect
# → 5 readable files, 0 unreadable, PIKVM_PASSWORD visible as [redacted]

# 4. Cleanup
SOPS_AGE_KEY_FILE=~/.config/sops/age/keys/hassoncs-pikvm.txt hush migrate --from v2 --cleanup
# → Removed hush.yaml, .hush.encrypted, .hush/migration-v2-state.json
```

---

## Migration result

Standard `hush migrate --from v2` path. Clean migration with 1 encrypted source file containing 1 secret (`PIKVM_PASSWORD`).

---

## Validation result

- `hush status` → `Repository: v3`, `Active identity: owner-local`, 5 encrypted files, 3 identities, 2 targets
- `hush inspect` → 5 readable files, 0 unreadable, `PIKVM_PASSWORD` present and redacted in 3 file documents

---

## Cleanup result

- `hush migrate --from v2 --cleanup` removed: `hush.yaml`, `.hush.encrypted`, `.hush/migration-v2-state.json`
- Final directory: `.hush/`, `.sops.yaml`, `.sisyphus/`
- No stale `hush decrypt` or `hush.yaml` references found in scripts

---

## Gitignore hazard — fixed

The parent repo at `automation-core/.gitignore` had:

```
.hush/
.hush
```

These patterns block the v3 `.hush/` directory in ALL subdirectories from being committed to git. This is a known defect pattern.

**Fix applied:** Added negation exceptions to `automation-core/.gitignore`:

```gitignore
# v3 migrated subdirectory repos (safe to commit)
!pikvm/.hush
!pikvm/.hush/
```

**Note for future migrations:** Any other subdirectory of `automation-core` that gets migrated to v3 will need a similar negation exception until the root repo itself is migrated and the blanket `.hush/` exclusion can be removed.

---

## Project-specific quirks

- No `.envrc` exists in the project — `SOPS_AGE_KEY_FILE` must be set manually or via parent direnv. Consider adding `.envrc` with `export SOPS_AGE_KEY_FILE=~/.config/sops/age/keys/hassoncs-pikvm.txt` after migration if the user regularly works in this directory.
- This is a **nested project** inside a non-migrated parent (`automation-core`). The parent `.gitignore` gitignore hazard will recur for every other v3-migrated subdirectory until the parent is also migrated.

---

## Hush defects found

None new. The `hush status` output on a machine with no `SOPS_AGE_KEY_FILE` set reports `Repository: missing` and suggests running `hush bootstrap` — misleading since the v3 repo is actually present and valid, just the decryption key is not loaded. The `status` command should distinguish between "v3 repo exists but key not loaded" and "no v3 repo found." This is a pre-existing defect documented in other learnings.
