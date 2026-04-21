# Migration Note: archive/automation-agent-session-monitor

**Date:** 2026-04-21
**Project path:** `/Users/hassoncs/Workspaces/Personal/archive/automation-agent-session-monitor`
**Status:** Migrated to v3

---

## Legacy evidence found

- `hush.yaml` with `version: 2`, 8 targets (root, evals, homeassistant, nanoclaw, openclaw, openclaw-inventory, openclaw-sam-status-fix, radmedia)
- Zero encrypted source files (`.hush.encrypted`, `.hush.development.encrypted`, `.hush.production.encrypted`, `.hush.local.encrypted` all missing)
- No `.sops.yaml`, no age key for this project
- `.gitignore` had bare `.hush/` entry (known v3 hazard — blocks committing the v3 store)
- `.envrc` present but only configured SSHFS for Home Assistant — no `SOPS_AGE_KEY_FILE`

---

## Commands run

```bash
# 1. Inspect current state
hush status
# → Repository: legacy-v2

hush migrate --from v2 --dry-run
# → 0/4 encrypted files found, 8 targets inventoried

# 2. Fix .gitignore hazard before proceeding
# Removed bare `.hush/` entry, replaced with comment noting it must not be ignored

# 3. Bootstrap (not migrate — 0 encrypted files + no .sops.yaml)
hush bootstrap
# → Generated key: local/automation-agent-session-monitor
#   → ~/.config/sops/age/keys/local-automation-agent-session-monitor.txt
# → Backed up to 1Password
# → Created .sops.yaml, .hush/manifest.encrypted, .hush/files/env/project/shared.encrypted

# 4. Set active identity
SOPS_AGE_KEY_FILE=~/.config/sops/age/keys/local-automation-agent-session-monitor.txt \
  hush config active-identity owner-local

# 5. Validate
SOPS_AGE_KEY_FILE=~/.config/sops/age/keys/local-automation-agent-session-monitor.txt \
  hush status
# → Repository: v3, Active identity: owner-local

SOPS_AGE_KEY_FILE=~/.config/sops/age/keys/local-automation-agent-session-monitor.txt \
  hush inspect
# → Readable files: 1 (env/project/shared), Unreadable: 0

# 6. Manual cleanup
rm hush.yaml
```

---

## Migration result

Completed via `hush bootstrap` (not `hush migrate --from v2`) because:
- Repo had zero encrypted secrets — nothing to migrate
- No `.sops.yaml` or age key existed, so `hush migrate` would fail at SOPS bootstrap step
- `hush bootstrap` succeeded and created the full v3 layout

---

## Validation result

- `hush status` → `Repository: v3`, `Active identity: owner-local`
- `hush inspect` → 1 readable file, 0 unreadable files

---

## Cleanup result

- `hush.yaml` removed manually (bootstrap path sets no cleanup marker)
- `.gitignore` fixed: bare `.hush/` entry replaced with comment
- `.envrc` updated: added `SOPS_AGE_KEY_FILE` export pointing to project key

---

## Files changed

| File | Change |
|------|--------|
| `.gitignore` | Removed bare `.hush/` gitignore entry (v3 hazard); replaced with explanatory comment |
| `.envrc` | Added `export SOPS_AGE_KEY_FILE` for project age key |
| `hush.yaml` | Deleted (legacy v2 config) |
| `.sops.yaml` | Created by bootstrap |
| `.hush/manifest.encrypted` | Created by bootstrap |
| `.hush/files/env/project/shared.encrypted` | Created by bootstrap |

---

## Project-specific quirks

- This is an **automation workspace** repo (Home Assistant, nanoclaw, openclaw etc.) with no actual secrets encrypted. `hush.yaml` declared 8 targets but none had corresponding encrypted source files.
- The `.envrc` did not set `SOPS_AGE_KEY_FILE`, meaning hush commands would fail without the env var even after bootstrap. This is a common gap in projects where direnv was set up before hush was added.
- The `.gitignore` bare `.hush/` entry is the most important hazard to catch early — it would silently prevent the v3 store from being committed.

---

## Hush defects found

None new. Confirms the known defects documented in other migration notes:

1. `migrate --from v2` fails opaquely on no-encrypted-files + no `.sops.yaml` repos — use `bootstrap` instead.
2. Bare `.hush/` gitignore entry is a recurring hazard in projects migrated before v3 was established. The migrate dry-run does not flag it.

**Suggestion:** `hush migrate --from v2 --dry-run` (and `hush status`) should warn when `.hush/` appears in `.gitignore`, since this will silently block the user from ever committing the v3 store.
