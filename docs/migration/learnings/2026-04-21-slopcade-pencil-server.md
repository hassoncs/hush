# Migration Learning: slopcade-pencil-server
**Date:** 2026-04-21
**Project path:** `/Users/hassoncs/Workspaces/Personal/archive/slopcade-pencil-server`
**Outcome:** Bootstrap (not migrate) — no encrypted files existed

## What Was Found

- `hush.yaml` present with `version: 2`, 4 sources, 8 targets
- Zero encrypted files (`.hush`, `.hush.development`, `.hush.production`, `.hush.local` all missing)
- No `.sops.yaml`
- `.gitignore` had bare `.hush/` line — would block v3 commits
- No `hush decrypt` usage in scripts or package files
- Project is a git worktree (`.git` is a file pointer to `automation/.git/worktrees/slopcade-pencil-server`)

## Dry-Run Output

```
Legacy sources: 0/4 encrypted files found
Legacy targets: 8
All 4 source files missing
```

## Action Taken

Used `hush bootstrap` (not `hush migrate --from v2`) because: zero encrypted files + no `.sops.yaml`.

Bootstrap result:
- Generated new age key: `local/slopcade-pencil-server`
- Key saved to `~/.config/sops/age/keys/local-slopcade-pencil-server.txt`
- Backed up to 1Password
- Created `.sops.yaml`, `.hush/manifest.encrypted`, `.hush/files/env/project/shared.encrypted`

## Fixes Applied

1. `.gitignore`: Replaced bare `.hush/` (which would block v3 commits) with `.hush.*/` and `.env.hush-decrypt`
2. Set active identity to `owner-local` via `hush config active-identity owner-local`

## Key Discovery: SOPS_AGE_KEY_FILE Not Auto-Set

After bootstrap, `hush status` failed with SOPS decryption error — key file existed at
`~/.config/sops/age/keys/local-slopcade-pencil-server.txt` but SOPS couldn't find it.
Required explicit `SOPS_AGE_KEY_FILE=~/.config/sops/age/keys/local-slopcade-pencil-server.txt`
to make hush commands work. The `hush keys setup` flow or direnv should wire this up for the
project going forward.

## Final State

- `hush status`: Repository v3, manifest present, 1 encrypted file, 2 targets
- `hush inspect`: 1 readable file (`env/project/shared`, roles=owner,member,ci)
- No plaintext secrets on disk
- `.gitignore` fixed for v3 compatibility

## Recommendations

- Wire `SOPS_AGE_KEY_FILE` into `.envrc` or use `hush keys setup` to avoid manual env var
- The legacy `hush.yaml` can be removed once team is fully on v3; it is no longer authoritative
- 8 v2 targets (root, evals, homeassistant, nanoclaw, openclaw, openclaw-inventory, openclaw-sam-status-fix, radmedia) had no secrets — repo was effectively empty
