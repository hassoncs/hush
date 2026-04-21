# Migration Learning: archive/starters/bootstrap

**Date:** 2026-04-21
**Project path:** `/Users/hassoncs/Workspaces/Personal/archive/starters/bootstrap`

## Legacy evidence found

- `hush.yaml` (version: 2) with 3 targets: `root`, `app`, `api-workers`
- `.hush.template` — example secrets file for onboarding
- No `.hush.encrypted` or any other encrypted source files (zero secrets stored)
- No `.sops.yaml`
- `package.json` had retired scripts: `hush:decrypt` (`hush decrypt`) and `hush:encrypt` (`hush encrypt`)
- `@chriscode/hush` linked to stale local path `/Users/hassoncs/Workspaces/Personal/hush`
- `.envrc` did not set `SOPS_AGE_KEY_FILE`

## Commands run

```bash
# Status check
bun .../hush-cli/dist/cli.js status --root <project>
# → Repository: legacy-v2

# Dry-run migration
bun .../hush-cli/dist/cli.js migrate --from v2 --dry-run --root <project>
# → 0/4 encrypted files found, 3 targets inventoried

# Attempted migrate --from v2
bun .../hush-cli/dist/cli.js migrate --from v2 --root <project>
# → FAILED: SOPS encryption failed: config file not found, no keys provided
# (no .sops.yaml, no age key for this project)

# Bootstrap v3 fresh (correct path for template repos with 0 secrets)
bun .../hush-cli/dist/cli.js bootstrap --root <project>
# → Generated new key local/bootstrap, created .hush/, .sops.yaml, manifest.encrypted

# Set active identity
bun .../hush-cli/dist/cli.js config active-identity owner-local --root <project>

# Validate
bun .../hush-cli/dist/cli.js status ...    # → Repository: v3
bun .../hush-cli/dist/cli.js inspect ...   # → 1 readable file, 0 unreadable

# Manual cleanup (migrate --cleanup not applicable — no migrate run completed)
rm hush.yaml .hush.template
```

## Migration result

Migration via `hush migrate --from v2` was **not the correct path** for this repo. Because there were zero actual encrypted secret files, `migrate --from v2` attempted to create a new SOPS-encrypted manifest but failed immediately since there was no `.sops.yaml` or age key.

Correct path: `hush bootstrap` to establish the v3 repo fresh, then manual removal of legacy files.

## Validation result

Pass. `hush status` reports `Repository: v3`. `hush inspect` reports 1 readable file, 0 unreadable.

## Cleanup result

Manual: `hush.yaml` and `.hush.template` removed. `migrate --from v2 --cleanup` reported "no validated v2 cleanup marker" — expected since the migrate path was bypassed.

## Files changed

| File | Change |
|------|--------|
| `.hush/manifest.encrypted` | Created (new v3 manifest) |
| `.hush/files/env/project/shared.encrypted` | Created (empty shared secrets doc) |
| `.sops.yaml` | Created (age public key: `age1x35zj79wl4hncld3c835ppjupqecxa5ztdh9edmpglj9v8s2q5js4jy98a`) |
| `~/.config/sops/age/keys/local-bootstrap.txt` | Created (age private key, backed up to 1Password) |
| `.envrc` | Added `export SOPS_AGE_KEY_FILE=~/.config/sops/age/keys/local-bootstrap.txt` |
| `package.json` | Removed stale `hush:decrypt` and `hush:encrypt` scripts |
| `hush.yaml` | Deleted |
| `.hush.template` | Deleted |

## Hush defects found

**Defect: `hush migrate --from v2` fails with cryptic SOPS error on repos with 0 encrypted files and no `.sops.yaml`**

- Exact command: `bun .../hush-cli/dist/cli.js migrate --from v2 --root <project>`
- Exact error: `Error: SOPS encryption failed: config file not found, or has no creation rules, and no keys provided through command line options`
- Expected behavior: The migration command should detect 0 encrypted source files and no `.sops.yaml`, then recommend `hush bootstrap` rather than attempting SOPS encryption and failing.
- Actual behavior: Proceeds to create a manifest, hits SOPS with no config, and exits with exit code 1 and a raw SOPS error.
- Severity: Non-blocking for this repo (workaround: use `hush bootstrap` directly). But the error message is confusing — it gives no hint that the correct fix is `hush bootstrap`.
- Scope: Affects any repo with `hush.yaml` but no encrypted source files and no existing `.sops.yaml` (template/starter repos).

## Project-specific quirks

- This is a starter/template repo (`archive/starters/bootstrap`) — it has the v2 config shape but was never populated with real secrets.
- The `.hush.template` file was documentation-style (example values, safe to delete).
- `@chriscode/hush` in devDependencies was linked to a stale local path. Downstream consumers of this template should update to the published package or the correct dev workspace path.
- The pre-commit hook (`pnpm hush check --only-changed`) will now work correctly with the v3 repo.
