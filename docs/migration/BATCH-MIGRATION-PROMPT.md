# Batch Hush v2 → v3 Migration Prompt

Use this prompt to dispatch a parallel batch of agents to migrate local / CH5 projects from legacy Hush to the current v3 repository model.

---

You are migrating one project from legacy Hush v2 to current Hush v3.

You have **no prior context**. Use the full paths and docs below. Do not assume anything not verified from the repo.

## Goal

Migrate the assigned project from legacy Hush to Hush v3 safely, validate it, clean up legacy files, and report any Hush defects back to the Hush team.

## Canonical Hush references

- Hush repo root: `/Users/hassoncs/Workspaces/Personal/dev/hush`
- Current command docs: `/Users/hassoncs/Workspaces/Personal/dev/hush/docs/src/content/docs/reference/commands.mdx`
- Historical migration note: `/Users/hassoncs/Workspaces/Personal/dev/hush/docs/src/content/docs/migrations/v2-to-v3.mdx`
- Current migration checklist: `/Users/hassoncs/Workspaces/Personal/dev/hush/docs/migration/CH5-HUSH-MIGRATION-CHECKLIST.md`
- Shared learnings dropbox: `/Users/hassoncs/Workspaces/Personal/dev/hush/docs/migration/learnings/`

## Use this Hush binary

Do **not** trust that the project’s local Hush dependency is current.

Use the built Hush CLI directly:

```bash
bun "/Users/hassoncs/Workspaces/Personal/dev/hush/hush-cli/dist/cli.js" <command>
```

If the project has a known age key, set `SOPS_AGE_KEY_FILE` explicitly when needed.

## Assigned project

PROJECT_PATH: `__PROJECT_PATH__`

## Required workflow

1. **Inspect current state**
   - check git status
   - run direct Hush CLI `status`
   - run `migrate --from v2 --dry-run`
   - identify whether the repo already has `.hush/manifest.encrypted`

2. **Fix obvious repo hazards first**
   - broken symlinks
   - malformed repo-local metadata that blocks migration
   - only if directly required for migration

3. **Run the real migration**
   - `hush migrate --from v2`

4. **Validate the migrated repo**
   - `hush status`
   - `hush inspect`
   - relevant project smoke checks (package scripts, workflow syntax, script syntax, etc.)

5. **Run migration cleanup**
   - `hush migrate --from v2 --cleanup`

6. **Update project integration if obviously required**
   - package scripts pointing at stale Hush commands
   - docs still telling users to rely on legacy `hush.yaml` flows
   - only if tightly coupled to the migration

7. **Record outcomes**
   - append project-specific findings to a new markdown note in:
     `/Users/hassoncs/Workspaces/Personal/dev/hush/docs/migration/learnings/`

## Mandatory learning note format

Create a file named like:

`YYYY-MM-DD-<project-slug>.md`

Include:

- Project path
- Legacy evidence found
- Commands run
- Migration result
- Validation result
- Cleanup result
- Any Hush defects found
- Any project-specific quirks

## Hush defect escalation rule

If you find a real Hush bug:

1. write it into the learning note immediately
2. include exact repro steps
3. include exact error text
4. state whether it blocks all migrations or only this repo

If the defect is severe, stop further risky migration steps and report the repo’s safest current state.

## Constraints

- Never read plaintext secret files directly
- Never print secret values
- Never use `as any`, `@ts-ignore`, or other unsafe shortcuts if code changes are required
- Do not commit unless explicitly requested
- Validate before cleanup
- Prefer minimal, migration-focused edits only

## Desired final report

Return:

- whether migration completed
- whether cleanup completed
- whether the repo is now on `.hush/manifest.encrypted`
- any blockers
- exact files changed

---

To run this in parallel, duplicate this prompt and replace `__PROJECT_PATH__` with one project from the checklist.
