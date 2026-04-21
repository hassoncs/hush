# Hush Migration Learnings

This directory is the shared dropbox for batch migration agents.

Purpose:

- capture project-specific migration quirks
- capture Hush defects discovered during real migrations
- avoid losing cross-project lessons while many agents migrate in parallel

## File naming

Create one file per migrated repo:

- `YYYY-MM-DD-<project-slug>.md`

Example:

- `2026-04-21-streamforge-backend.md`

## Required contents

- Project path
- Legacy evidence found
- Commands run
- Migration result
- Validation result
- Cleanup result
- Hush defects found (if any)
- Suggested follow-up for the Hush team

## Hush team escalation rule

If an agent finds a real Hush problem, the note must include:

- exact command
- exact error text
- whether there is a workaround
- whether this is likely systemic across many repos

This directory is intentionally plain markdown so many parallel agents can write into it without needing extra tooling.
