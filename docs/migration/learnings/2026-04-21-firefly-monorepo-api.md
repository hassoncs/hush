# Migration: firefly-monorepo/apps/api — 2026-04-21

## Project

- Path: `/Users/hassoncs/Workspaces/Personal/apps/firefly-monorepo/apps/api`
- Monorepo root: `/Users/hassoncs/Workspaces/Personal/apps/firefly-monorepo`
- Monorepo worktrees: only `main` at repo root (no active worktrees beyond that)

## Starting state

- `Repository: legacy-v2` (hush.yaml present)
- `hush.yaml`: version 2, project `firefly/api`, 1 target (`api`, format `dotenv`)
- Encrypted files: 1 of 4 present (`.hush.encrypted`; development/production/local all missing)
- `.sops.yaml`: present, single age recipient
- No `.hush/` directory
- No bare `.hush` gitignore hazard
- `package.json` scripts: already all using `hush run` — no stale `hush decrypt` calls

## Migration path

Used `hush migrate --from v2` (not bootstrap), because 1 encrypted file existed.

## Steps taken

1. `hush status` — confirmed `legacy-v2`
2. `hush migrate --from v2 --dry-run` — clean inventory, 1 encrypted source, 1 target
3. `hush migrate --from v2` — succeeded, created `.hush/` layout
4. Validation failed initially: `SOPS_AGE_KEY_FILE` not set in agent shell env
5. Located key at `~/.config/sops/age/keys/firefly-api.txt` — loaded it explicitly
6. `hush status` with key — `Repository: v3`, 5 encrypted files, 3 identities, 2 targets
7. `hush inspect` — 5/5 readable, 13 secrets all present and redacted correctly
8. `hush migrate --from v2 --cleanup` — removed `hush.yaml`, `.hush.encrypted`, `.hush/migration-v2-state.json`

## Final state

- `Repository: v3`
- `.hush/manifest.encrypted` + `.hush/files/` (5 encrypted files)
- No legacy artifacts remaining
- No script changes needed (scripts were already v3-compatible)

## Learnings / gotchas

- **Agent shell has no SOPS_AGE_KEY env** — direnv doesn't load in agent bash context. Must use `SOPS_AGE_KEY_FILE=~/.config/sops/age/keys/<project>.txt` prefix explicitly when validating.
- `hush status` with key missing outputs two stacked blocks: one saying `v3` (from the migration completion) then one saying `missing` (from the failed manifest read). Misleading — the second block is the real state without the key.
- Project was clean: no `.hush` gitignore hazard, no stale decrypt scripts, no plaintext env files. Smooth migration.
- Monorepo worktree: only the main worktree existed at monorepo root — no action needed.
