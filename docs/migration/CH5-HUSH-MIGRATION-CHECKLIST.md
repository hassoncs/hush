# CH5 / Local Hush Migration Checklist

Updated: 2026-04-21

This checklist inventories local / CH5-adjacent projects that still appear to use the legacy Hush v2 layout (`hush.yaml`, `.hush.encrypted`, `.hush.template`, or similar) and should be reviewed for migration to the current v3 repository model:

- `.hush/manifest.encrypted`
- `.hush/files/**.encrypted`
- `hush migrate --from v2`

Canonical Hush docs and references:

- Commands reference: `/Users/hassoncs/Workspaces/Personal/dev/hush/docs/src/content/docs/reference/commands.mdx`
- Current materialize docs: `/Users/hassoncs/Workspaces/Personal/dev/hush/docs/src/content/docs/reference/commands.mdx`
- Historical v2 migration note: `/Users/hassoncs/Workspaces/Personal/dev/hush/docs/src/content/docs/migrations/v2-to-v3.mdx`
- Hush repo root: `/Users/hassoncs/Workspaces/Personal/dev/hush`

## Status legend

- `[ ]` Not started
- `[~]` In progress / needs investigation
- `[x]` Done

## Already migrated / current v3

- [x] `/Users/hassoncs/Workspaces/Personal/fitbot`
  - Evidence: `.hush/manifest.encrypted` exists
  - Notes: migrated to v3 in this session; Hush-first Apple signing wiring added; still needs actual signing inventory populated

## Migration candidates — legacy v2

- [x] `/Users/hassoncs/Workspaces/Personal/rad-media/streamforge-backend`
  - Evidence: `hush.yaml` with `version: 2`, `.hush.encrypted`
  - Notes: migrated 2026-04-21; clean migration (1 of 4 declared sources present); 14 secrets validated; no defects; cleanup complete; see learnings/2026-04-21-streamforge-backend.md

- [x] `/Users/hassoncs/Workspaces/Personal/bigcapital`
  - Evidence: `hush.yaml` with `version: 2`, `.hush.encrypted`
  - Notes: migrated to v3 2026-04-21; single shared source, 1 target (root/dotenv); no legacy package script references; cleanup complete; age key at `~/.config/sops/age/keys/hassoncs-bigcapital-local-dell.txt`

- [x] `/Users/hassoncs/Workspaces/Personal/dev/react-voice-inspector`
  - Evidence: `hush.yaml` with `version: 2`, `.hush.template`
  - Notes: migrated to v3 2026-04-21; partially initialized (no encrypted data existed); v3 skeleton created; `.gitignore` had bare `.hush` entry blocking v3 files — fixed manually; see learnings/2026-04-21-react-voice-inspector.md

- [x] `/Users/hassoncs/Workspaces/Personal/apps/new-app`
  - Evidence: `hush.yaml` with `version: 2`, no `.hush/` v3 repo detected
  - Notes: template-only repo (no encrypted v2 data); used `hush bootstrap` (migrate blocked by missing key/sops.yaml); hush.yaml removed; stale hush:decrypt/hush:encrypt scripts replaced; 2 Hush defects filed; see learnings/2026-04-21-new-app.md

- [x] `/Users/hassoncs/Workspaces/Personal/archive/seeds/actually-app`
  - Evidence: `hush.yaml` with `version: 2`, no `.hush/` v3 repo detected
  - Notes: migrated 2026-04-21; archive/seed with 0 encrypted secrets — used `hush bootstrap` (migrate fails with no age key + no sources); hush.yaml removed manually; .envrc created; stale hush:decrypt/hush:encrypt scripts replaced; see learnings/2026-04-21-actually-app.md

- [x] `/Users/hassoncs/Workspaces/Personal/archive/seeds/protestiful`
  - Evidence: `hush.yaml` with `version: 2`, `.hush.encrypted`, `.hush.template`
  - Notes: migrated 2026-04-21; `.hush/manifest.encrypted` present; 9 encrypted files, all readable; legacy hush:decrypt/hush:encrypt scripts removed from package.json; Hush defect: `--cwd` flag ignored during migrate (workaround: cd to project dir); see learnings/2026-04-21-protestiful.md

- [x] `/Users/hassoncs/Workspaces/Personal/archive/starters/bootstrap`
  - Evidence: `hush.yaml` with `version: 2`, `.hush.template`
  - Notes: starter/template; 0 encrypted source files — used `hush bootstrap` instead of `hush migrate --from v2`; legacy files removed; `.envrc` updated with `SOPS_AGE_KEY_FILE`; stale `hush:decrypt`/`hush:encrypt` scripts removed; Hush defect filed: migrate fails with opaque SOPS error on repos with 0 secrets and no `.sops.yaml`; see learnings/2026-04-21-bootstrap-starter.md

- [x] `/Users/hassoncs/Workspaces/Personal/platform/opencode-ecosystem/archive/moltworker`
  - Evidence: `hush.yaml` with `version: 2`, `.hush.encrypted`
  - Notes: migrated 2026-04-21; clean migration, no blockers; cleanup complete; see learnings/2026-04-21-moltworker.md

## Workspace-level / special-case review

- [ ] `/Users/hassoncs/Workspaces`
  - Evidence: `/Users/hassoncs/Workspaces/hush.yaml`
  - Notes: top-level workspace config; review carefully before migrating because it may affect multiple nested repos or developer-global workflows

## Inconclusive / investigate before migration

- [~] `/Users/hassoncs/Workspaces/Personal/slopcade/apps/slopbox`
  - Evidence: scripts reference `hush run`, but no `hush.yaml` or `.hush/` repo was found in the scanned path
  - Notes: likely inherits Hush behavior from a parent workspace or another repo boundary

- [~] `/Users/hassoncs/Workspaces/Personal/waypoint-for-ios`
  - Evidence: no direct Hush config found; `@chriscode/hush` appears only as a transitive dependency in lock data
  - Notes: probably not a direct migration candidate

## Migration execution checklist per project

Use this exact sequence for each project unless a project-specific blocker requires deviation:

1. Confirm current state
   - `pnpm hush status` or direct Hush CLI if the local package is stale
   - `hush migrate --from v2 --dry-run`
2. Check for repo hazards
   - broken symlinks
   - weird generated files
   - legacy plaintext env leftovers
3. Run migration
   - `hush migrate --from v2`
4. Validate migrated repo
   - `hush status`
   - `hush inspect`
   - relevant app-specific smoke checks
5. Cleanup
   - `hush migrate --from v2 --cleanup`
6. Update docs/scripts/package aliases if needed
7. Record learnings in:
   - `/Users/hassoncs/Workspaces/Personal/dev/hush/docs/migration/learnings/`

## Hush bug escalation rule

If any migration agent finds a real Hush defect, it must immediately record it in:

- `/Users/hassoncs/Workspaces/Personal/dev/hush/docs/migration/learnings/`

and include:

- project path
- exact command run
- exact error
- suspected root cause
- whether the issue blocks migration entirely or has a workaround
