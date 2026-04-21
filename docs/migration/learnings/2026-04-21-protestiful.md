# Migration Learning: protestiful

**Date:** 2026-04-21
**Project path:** `/Users/hassoncs/Workspaces/Personal/archive/seeds/protestiful`
**Migrated by:** claude-sonnet-4-6 agent

---

## Legacy evidence found

- `hush.yaml` with `version: 2`, `project: bootstrap`
- `.hush.encrypted` (shared secrets file, present)
- `.hush.template` (developer onboarding template)
- No `.hush.development.encrypted`, `.hush.production.encrypted`, or `.hush.local.encrypted` (all missing)
- 3 targets declared: `root`, `app` (EXPO_PUBLIC_* filter), `api-workers` (wrangler format)

---

## Commands run

```bash
# Dry-run (from project cwd — required, see defect below)
cd /path/to/protestiful
bun <hush-cli> migrate --from v2 --dry-run

# Migration
bun <hush-cli> migrate --from v2

# Validation
bun <hush-cli> status
bun <hush-cli> inspect

# Cleanup
bun <hush-cli> migrate --from v2 --cleanup
```

---

## Migration result

SUCCESS. Migration completed cleanly in one pass.

- Inventory: 1/4 encrypted source files found (3 were missing — treated as empty)
- Created `.hush/manifest.encrypted` and file documents
- Repo is now v3, project slug `bootstrap-333c04dd`
- 9 encrypted files total, all readable by `owner-local` identity
- 6 secrets migrated into `env/project/shared`; targets generated for `root`, `app`, `api-workers`

---

## Validation result

`hush status` reported `Repository: v3` with:
- manifest files: 1
- encrypted files: 9
- identities: 3
- bundles: 7
- targets: 6

`hush inspect` confirmed all 9 files readable, 0 unreadable.

---

## Cleanup result

SUCCESS. Cleanup removed:
- `hush.yaml`
- `.hush.encrypted`
- `.hush/migration-v2-state.json`

`.hush.template` was left in place (not a Hush runtime artifact — developer documentation only).

---

## Project integration updates

`package.json` scripts updated:
- Removed `hush:decrypt` (`hush decrypt` now requires `--force` + interactive TTY — unusable in scripts)
- Removed `hush:encrypt` (`hush encrypt` is the retired legacy bridge, fails fast in v3)
- Added `hush:inspect` as v3 replacement for visibility

File changed: `/Users/hassoncs/Workspaces/Personal/archive/seeds/protestiful/package.json`

---

## Hush defects found

### Defect 1: `--cwd` flag ignored during `hush migrate --from v2`

**Severity:** Medium. Workaround available (run from project cwd).

**Repro:**
```bash
bun <hush-cli> migrate --from v2 --dry-run --cwd /path/to/protestiful
```

**Error:**
```
Error: ENOENT: no such file or directory, stat '/Users/hassoncs/Workspaces/Personal/platform/Claude-ecosystem/config-symlinks/oh-my-opencode.json'
```

**Root cause:** The `--cwd` flag does not properly scope config resolution to the given path. Hush walks up the directory tree from CWD at CLI invocation time (not from `--cwd`), finds the workspace-level `hush.yaml` at `~/Workspaces/hush.yaml`, and then that workspace config causes a filesystem stat failure when resolving a dangling symlink in an unrelated directory.

**Workaround:** Always `cd` to the project directory before running `migrate`, or any Hush command. Do not rely on `--cwd` for project isolation.

**Blocks all migrations:** No. Easy workaround. But `--cwd` is misleading — it appears to do nothing for config resolution.

---

## Project-specific quirks

- `hush.yaml` had `project: bootstrap` (not `protestiful`). The v3 slug is `bootstrap-333c04dd`. If other repos share `project: bootstrap`, their state paths would collide under `~/.hush/state/projects/`.
- No age key found in `~/.config/sops/age/keys/` matching the `.sops.yaml` public key (`age1t3uyjjdzgr8rg0y56x8mncyyemhk5kxjv670fxuc35dzata5vpuslgunj5`). Migration and inspect succeeded, implying the machine has the private key via a different resolution path (likely from a keys file that SOPS picks up automatically). No explicit `SOPS_AGE_KEY_FILE` was needed.
- This is an archive/seed repo — still has valuable v2 secrets, migration was worthwhile for template hygiene.
