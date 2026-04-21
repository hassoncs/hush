# Migration Note: archive/seeds/actually-app

**Date:** 2026-04-21
**Project path:** `/Users/hassoncs/Workspaces/Personal/archive/seeds/actually-app`
**Status:** Migrated to v3

---

## Legacy evidence found

- `hush.yaml` with `version: 2`, `project: bootstrap`
- `.hush.template` (plaintext secrets template — not a Hush config, kept as documentation)
- Zero encrypted source files (`.hush.encrypted`, `.hush.development.encrypted`, `.hush.production.encrypted` all missing)
- No `.sops.yaml`, no `.envrc`, no age key for this project
- Legacy package.json scripts: `hush:decrypt` (`hush decrypt`) and `hush:encrypt` (`hush encrypt`)

---

## Commands run

```bash
# 1. Inspect current state
hush status
# → Repository: legacy-v2 (no v3 repo, migration required)

hush migrate --from v2 --dry-run
# → 0/4 encrypted files found, 3 targets inventoried
# → Dry run only, no changes

# 2. Attempt real migration
hush migrate --from v2
# → FAILED: "SOPS encryption failed: config file not found ... and no keys provided"
# → Root cause: no .sops.yaml, no age key for this project

# 3. Bootstrap instead (seed repo with no actual secrets)
hush bootstrap
# → Generated key: local/actually-app → ~/.config/sops/age/keys/local-actually-app.txt
# → Backed up to 1Password
# → Created .sops.yaml, .hush/manifest.encrypted, .hush/files/env/project/shared.encrypted

# 4. Re-run migration dry-run
hush migrate --from v2 --dry-run
# → "This repository already has .hush/ v3 state."

# 5. Set active identity
SOPS_AGE_KEY_FILE=~/.config/sops/age/keys/local-actually-app.txt hush config active-identity owner-local

# 6. Validate
SOPS_AGE_KEY_FILE=~/.config/sops/age/keys/local-actually-app.txt hush status
# → Repository: v3, Active identity: owner-local

SOPS_AGE_KEY_FILE=~/.config/sops/age/keys/local-actually-app.txt hush inspect
# → Readable files: 1 (env/project/shared), Unreadable: 0

# 7. Migration cleanup
SOPS_AGE_KEY_FILE=~/.config/sops/age/keys/local-actually-app.txt hush migrate --from v2 --cleanup
# → "No validated v2 cleanup marker found. Nothing to clean."
# → Expected: bootstrap path does not set a cleanup marker — manual removal required

# 8. Manual cleanup of legacy hush.yaml
rm hush.yaml

# 9. Final status
SOPS_AGE_KEY_FILE=~/.config/sops/age/keys/local-actually-app.txt hush status
# → Repository: v3, Active identity: owner-local ✓
```

---

## Migration result

Completed via `hush bootstrap` (not `hush migrate --from v2`) because:
- Repo had zero encrypted secrets — nothing to migrate
- No `.sops.yaml` or age key existed, so `hush migrate` failed at the SOPS bootstrap step
- `hush bootstrap` succeeded and created the full v3 layout

---

## Validation result

- `hush status` → `Repository: v3`, `Active identity: owner-local`
- `hush inspect` → 1 readable file, 0 unreadable files

---

## Cleanup result

- `hush migrate --from v2 --cleanup` → no-op (no cleanup marker from bootstrap path)
- `hush.yaml` removed manually
- `.hush.template` retained (plaintext onboarding doc, not a Hush config artifact)
- `.envrc` created with `SOPS_AGE_KEY_FILE` pointing to `local-actually-app.txt`

---

## Project-specific quirks

- This is an **archive/seed repo** with no real secrets encrypted. `hush.yaml` was purely a template config with no corresponding `.hush.encrypted`.
- The correct flow for such repos is `hush bootstrap` (not `hush migrate`), since there is nothing to decrypt and re-encrypt.
- The `hush:decrypt` and `hush:encrypt` package.json scripts were stale v2 aliases. Replaced with `hush:inspect` and `hush:set`.
- The `@chriscode/hush` devDependency points to a local `link:` path (`/Users/hassoncs/Workspaces/Personal/hush`) — this is fine for a personal seed but should be updated to a versioned npm package if this seed is ever published or shared.

---

## Hush defects found

### Defect: `hush migrate --from v2` fails with no age key even when there are zero encrypted source files

**Severity:** Low — does not block migration for repos with actual secrets. Workaround: use `hush bootstrap` instead.

**Repro steps:**
1. Repo has `hush.yaml` version 2 with no corresponding encrypted files (`.hush.encrypted` missing)
2. No `.sops.yaml` or age key exists for the project
3. Run: `hush migrate --from v2`

**Exact error:**
```
Error: SOPS encryption failed: config file not found, or has no creation rules, and no keys provided through command line options
```

**Expected behavior:** For repos with zero encrypted source files, `hush migrate --from v2` should either:
- Auto-invoke bootstrap (generate a key and create v3 layout), or
- Emit a clear message: "No encrypted secrets found. Run `hush bootstrap` to initialize v3."

**Actual behavior:** Hard fails with a SOPS error that doesn't explain the root cause.

**Blocks all migrations?** No — only repos with no existing age key AND no encrypted source files. Workaround is `hush bootstrap`.

---

### Defect: `hush keys generate` fails when repo is in legacy-v2 state with a `project:` field in hush.yaml

**Severity:** Low — error message is opaque.

**Repro steps:**
1. Repo has `hush.yaml` with `project: bootstrap`
2. Run: `hush keys generate`

**Exact error:**
```
No project identifier found.
Add "project: my-project" to hush.yaml
```

**Expected behavior:** Should read `project:` from the existing `hush.yaml` in legacy-v2 repos. The project name (`bootstrap`) is already present in the config.

**Actual behavior:** Returns "No project identifier found" even though `project: bootstrap` exists in `hush.yaml`.

**Blocks all migrations?** No — `hush bootstrap` succeeds and generates the key correctly.

---

### Note: `hush migrate --from v2 --cleanup` is a no-op after `hush bootstrap`

The cleanup marker set by `hush migrate --from v2` is not set when `hush bootstrap` is used as the migration path. As a result, `hush migrate --from v2 --cleanup` reports "No validated v2 cleanup marker found. Nothing to clean." and does not remove `hush.yaml`.

This is arguably correct behavior (bootstrap ≠ migrate), but the workflow docs should note that `hush.yaml` requires manual removal when bootstrap is used instead of migrate.
