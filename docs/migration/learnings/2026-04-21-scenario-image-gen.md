# Migration Learning: scenario-image-gen

**Date:** 2026-04-21
**Project path:** `/Users/hassoncs/Workspaces/Personal/dev/scenario-image-gen`

## Legacy evidence found

- `hush.yaml` with `schema_version: 2`, `project: scenario-image-gen`
- `.env.encrypted` (single shared encrypted source file)
- No `.hush/` v3 repo present at start
- `.sops.yaml` present with a single age recipient (`age1utgzsxy35fxx6v32flw8n8w250z7vwasdfm7vyldst6ezqd6ru9qpa3yhc`)
- Local age key present at `~/.config/sops/age/keys/scenario-image-gen.txt`
- `.gitignore` had no bare `.hush` entry (no hazard)

## Commands run

```bash
# Initial inspection
hush status
# → legacy-v2, migration required

# Dry run
hush migrate --from v2 --dry-run
# → 1/4 encrypted files found (shared only), 1 target, 1 repo ref

# Real migration
hush migrate --from v2
# → success

# Validation (requires SOPS_AGE_KEY_FILE — not in default env for this project)
SOPS_AGE_KEY_FILE=~/.config/sops/age/keys/scenario-image-gen.txt hush status
# → v3, manifest.encrypted present, 5 encrypted files, 3 secrets readable

SOPS_AGE_KEY_FILE=~/.config/sops/age/keys/scenario-image-gen.txt hush inspect
# → all 5 files readable, 3 sensitive values confirmed [redacted]

# Cleanup
hush migrate --from v2 --cleanup
# → removed hush.yaml, .env.encrypted, .hush/migration-v2-state.json
```

Key file used: `SOPS_AGE_KEY_FILE=$HOME/.config/sops/age/keys/scenario-image-gen.txt`

## Migration result

Successful. No blockers.

Post-migration v3 layout:
- `.hush/manifest.encrypted` (11045 bytes)
- `.hush/files/` (5 encrypted files)
- 3 identities (owner-local, member-local, ci)
- 3 bundles, 2 targets

## Validation result

- `hush status` reports `Repository: v3`
- `hush inspect` shows 5/5 files readable, 3 secrets (SCENARIO_API_KEY, SCENARIO_API_URL, SCENARIO_SECRET_API_KEY) present and redacted
- No unreadable files
- Machine-local state fully initialized (active identity, audit log present)
- `AGENTS.md` already used `hush run` — no updates needed
- `package.json` scripts do not reference `hush decrypt` — no script updates needed

## Cleanup result

Successful. Removed:
- `hush.yaml`
- `.env.encrypted`
- `.hush/migration-v2-state.json`

## Hush defects found

None. Migration was clean end-to-end.

## Project-specific quirks

- `SOPS_AGE_KEY_FILE` is not set by default in this project's environment (no `.envrc`). Must be passed explicitly for `hush status` and `hush inspect` to decrypt. Key is present at `~/.config/sops/age/keys/scenario-image-gen.txt`.
- Only 1 of 4 declared source files (`shared`, as `.env.encrypted`) actually existed. The `development`, `production`, and `local` variants were declared in `hush.yaml` but had no corresponding encrypted files. Hush handled gracefully — dry run flagged them as "missing", migration proceeded without error.
- Secrets appear duplicated across `env/project/shared`, `env/targets/root/production`, and `env/targets/root/runtime` in v3. Expected behavior for single-source v2 repos with a root dotenv target.
- `.gitignore` was clean — no bare `.hush` line that would block committing the new `.hush/` directory.
- Git working tree is left with unstaged changes (`deleted: .env.encrypted`, `deleted: hush.yaml`, untracked `.hush/`). Commit not made per migration constraints.
