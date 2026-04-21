# Migration Note: bigcapital

**Date:** 2026-04-21
**Project path:** `/Users/hassoncs/Workspaces/Personal/bigcapital`
**Hush CLI version:** 5.1.1 (via built dist)

---

## Legacy evidence found

- `hush.yaml` at repo root — `version: 2`, project `hassoncs/bigcapital-local-dell`, one target (`root`, format `dotenv`)
- `.hush.encrypted` — single shared source file
- `.sops.yaml` at repo root with age recipient `age19xrwza5xylcu4zy7frcdg7slx7lakzppq2zrj9khua9zxp6524uqwpf576`
- No `.hush/` directory present before migration
- No `.envrc` in repo (direnv not wired; age key must be set explicitly via `SOPS_AGE_KEY_FILE`)

---

## Commands run

```bash
# Status (confirmed legacy-v2)
bun /path/to/hush-cli/dist/cli.js status --root /Users/hassoncs/Workspaces/Personal/bigcapital

# Dry-run (inventory only)
bun /path/to/hush-cli/dist/cli.js migrate --from v2 --dry-run --root ...

# Migration
bun /path/to/hush-cli/dist/cli.js migrate --from v2 --root ...

# Validate
SOPS_AGE_KEY_FILE=~/.config/sops/age/keys/hassoncs-bigcapital-local-dell.txt \
  bun /path/to/hush-cli/dist/cli.js status --root ...

SOPS_AGE_KEY_FILE=~/.config/sops/age/keys/hassoncs-bigcapital-local-dell.txt \
  bun /path/to/hush-cli/dist/cli.js inspect --root ...

# Cleanup
SOPS_AGE_KEY_FILE=~/.config/sops/age/keys/hassoncs-bigcapital-local-dell.txt \
  bun /path/to/hush-cli/dist/cli.js migrate --from v2 --cleanup --root ...
```

---

## Migration result

Success. Output from `hush migrate --from v2`:

```
Migration complete.
Created .hush/ manifest and file documents, migrated machine-local overrides, and validated the new v3 repo state.
Run "hush migrate --from v2 --cleanup" after you review the migrated repo to remove legacy hush.yaml and encrypted source leftovers.
```

---

## Validation result

`hush status` (with key):
- Repository: v3
- Manifest: `.hush/manifest.encrypted`
- 5 encrypted files, 3 identities, 3 bundles, 2 targets, 0 imports
- Active identity: owner-local
- Machine-local state fully present

`hush inspect`:
- 5 readable files, 0 unreadable
- 3 secrets resolved from `env/project/shared` (BIGCAPITAL_BASE_URL, BIGCAPITAL_LOGIN_EMAIL, BIGCAPITAL_LOGIN_PASSWORD)
- Target env files also present (root/production, root/runtime)
- All values properly redacted

---

## Cleanup result

Success. Output from `hush migrate --from v2 --cleanup`:

```
Cleanup complete.
  Removed hush.yaml
  Removed .hush.encrypted
  Removed .hush/migration-v2-state.json
```

Post-cleanup `.hush/` contains only `manifest.encrypted` and `files/` — no legacy artifacts remain.

---

## Hush defects found

None.

---

## Project-specific quirks

- No `.envrc` in repo. The age key is stored at `~/.config/sops/age/keys/hassoncs-bigcapital-local-dell.txt` but is NOT auto-loaded. Any future `hush run` or `hush inspect` invocations must set `SOPS_AGE_KEY_FILE` explicitly or add a `.envrc` with `export SOPS_AGE_KEY_FILE=...` and `direnv allow`.
- `hush status` without the key set produces two output blocks: the first shows `Repository: v3` (correct), the second falls into a SOPS decrypt error block and shows `Repository: missing`. This is expected behavior when the key is unavailable, not a Hush bug — but the doubled output format could confuse users. Worth noting for UX.
- No package scripts in `package.json` or sub-packages referenced Hush, so no integration edits were required.
- Repo is on `develop` branch, diverged 2 commits ahead and 164 commits behind `origin/develop`. Not migration-related; no commit made per task constraints.
