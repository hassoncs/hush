# Migration Note: archive/automation-firefly-completion

**Date:** 2026-04-21
**Project path:** `/Users/hassoncs/Workspaces/Personal/archive/automation-firefly-completion`
**Status:** Migrated to v3

---

## Legacy evidence found

- `hush.yaml` with `version: 2`, 3 sources (`shared`, `development`, `production`, `local`), 8 targets (root, evals, homeassistant, nanoclaw, openclaw, openclaw-inventory, openclaw-sam-status-fix, radmedia)
- Zero encrypted source files (no `.hush.encrypted`, `.hush.development.encrypted`, `.hush.production.encrypted`)
- No `.sops.yaml`, no age key for this project
- `.gitignore` had bare `.hush/` pattern — would have blocked v3 commits
- Worktree-based git (`.git` is a file, not a dir) — `git status` failed with "fatal: not a git repository"
- No stale `hush decrypt` / `hush unsafe:decrypt` usage in scripts

---

## Commands run

```bash
# 1. Inspect current state
hush status
# → Repository: legacy-v2

hush migrate --from v2 --dry-run
# → FAILED: ENOENT on .tmp-fly-profiles/ctx-ghost/SingletonSocket (unrelated chrome socket file)
# → Root cause: dry-run stat'ing all files in the project, hitting stale socket path

# 2. Confirmed: zero encrypted files, no .sops.yaml
# → Bootstrap path applies

# 3. Bootstrap
hush bootstrap
# → Generated key: local/automation-firefly-completion
# → Saved to ~/.config/sops/age/keys/local-automation-firefly-completion.txt
# → Backed up to 1Password
# → Created .sops.yaml, .hush/manifest.encrypted, .hush/files/env/project/shared.encrypted

# 4. Set active identity
SOPS_AGE_KEY_FILE=~/.config/sops/age/keys/local-automation-firefly-completion.txt hush config active-identity owner-local

# 5. Validate
SOPS_AGE_KEY_FILE=~/.config/sops/age/keys/local-automation-firefly-completion.txt hush status
# → Repository: v3, Active identity: owner-local

SOPS_AGE_KEY_FILE=~/.config/sops/age/keys/local-automation-firefly-completion.txt hush inspect
# → Readable files: 1 (env/project/shared), Unreadable: 0

# 6. Cleanup attempt
SOPS_AGE_KEY_FILE=~/.config/sops/age/keys/local-automation-firefly-completion.txt hush migrate --from v2 --cleanup
# → "No validated v2 cleanup marker found. Nothing to clean." — expected for bootstrap path

# 7. Manual cleanup
rm hush.yaml

# 8. Fix .gitignore — bare .hush/ pattern blocked v3 commits
# Changed: ".hush/" → "# .hush/ is the v3 encrypted store — do NOT ignore it"
# Kept: ".hush.*/" for local overrides
```

---

## Migration result

Completed via `hush bootstrap` (not `hush migrate --from v2`) because:
- Repo had zero encrypted secrets — nothing to migrate
- No `.sops.yaml` or age key existed, so `hush migrate` would fail at the SOPS bootstrap step
- `hush bootstrap` succeeded and created the full v3 layout

---

## Validation result

- `hush status` → `Repository: v3`, `Active identity: owner-local`
- `hush inspect` → 1 readable file (env/project/shared), 0 unreadable files

---

## Cleanup result

- `hush migrate --from v2 --cleanup` → no-op (no cleanup marker from bootstrap path — expected)
- `hush.yaml` removed manually
- `.gitignore` fixed: bare `.hush/` pattern replaced so v3 `.hush/` directory is tracked

---

## Files changed

| File | Change |
|------|--------|
| `hush.yaml` | Removed (legacy v2 config, no secrets) |
| `.gitignore` | Fixed bare `.hush/` ignore → unblocks v3 commits |
| `.sops.yaml` | Created by bootstrap |
| `.hush/manifest.encrypted` | Created by bootstrap |
| `.hush/files/env/project/shared.encrypted` | Created by bootstrap |

---

## Project-specific quirks

- This is an **archive/automation workspace** with no actual secrets encrypted in hush. The `hush.yaml` listed 8 targets but none had corresponding encrypted source files.
- The git repo is a **worktree** (`.git` is a file pointing to a bare repo at `../automation/.git/worktrees/automation-firefly-completion`). This is fine — hush operates on the working tree, not git internals.
- `.tmp-fly-profiles/` contains stale Chrome singleton socket files which caused the `migrate --from v2 --dry-run` to crash with ENOENT. This is a known issue (dry-run stat's everything in the project dir).
- The `.envrc` configures SSHFS for Home Assistant and does not reference Hush — no changes needed there.

---

## Hush defects found

### Defect: `hush migrate --from v2 --dry-run` crashes on unrelated stale socket files

**Severity:** Low — blocks dry-run diagnostics but not actual migration.

**Repro steps:**
1. Project has any stale/nonexistent socket file in a subdirectory (e.g., `.tmp-fly-profiles/ctx-ghost/SingletonSocket`)
2. Run: `hush migrate --from v2 --dry-run`

**Exact error:**
```
Error: ENOENT: no such file or directory, stat '/path/to/.tmp-fly-profiles/ctx-ghost/SingletonSocket'
```

**Expected behavior:** Dry-run should skip non-regular files (sockets, FIFOs, symlinks to missing targets) gracefully, or at minimum emit a warning rather than crashing.

**Actual behavior:** Hard crash with exit code 1 before producing any inventory output.

**Workaround:** Bootstrap directly when evidence indicates zero encrypted files.
