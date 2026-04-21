# Migration Note: automation-core

**Date:** 2026-04-21
**Project path:** `/Users/hassoncs/Workspaces/Personal/home/automation-core`
**Hush CLI version:** 5.1.1 (via built dist)
**Migration agent:** claude-sonnet-4-6

---

## Legacy evidence found

- `hush.yaml` at repo root — `version: 2`, `project: hassoncs/home-automation`, 9 targets (root, evals, homeassistant, bottown, openclaw, openclaw-inventory, openclaw-sam-status-fix, radmedia, hindsight-dell)
- `.hush.encrypted` — single shared source file (dotenv-format SOPS with age recipient `age1en04xj06y9pgnf0km5myqlpq8englz73p333nd8wm465e5whty4sshfmj5`)
- `.hush.local` — **plaintext** local override file (not encrypted), declared as `local: .hush.local` in hush.yaml
- `.sops.yaml` at repo root
- `.envrc` present but does NOT set `SOPS_AGE_KEY_FILE` — mounts Home Assistant config via sshfs only
- No `.hush/` v3 directory existed prior to migration attempt
- Legacy sources declared but missing: `.hush.development.encrypted`, `.hush.production.encrypted`, `.hush.local.encrypted`
- Not a git repository (no `.git/` dir)
- `.gitignore` contains bare `.hush/` entry — would block v3 commits if not fixed

---

## Commands run

```bash
# 1. Inspect
bun <hush-cli> status
# → "Migration Required", repository: legacy-v2

# 2. Dry run
bun <hush-cli> migrate --from v2 --dry-run
# → 1/4 encrypted files found, 9 targets, 11 refs to review

# 3. Migration (without key)
bun <hush-cli> migrate --from v2
# → FAILED: Interpolation source "OLLAMA_API_KEY" does not exist in the repository graph

# 4. Migration with explicit key
SOPS_AGE_KEY_FILE=~/.config/sops/age/keys/hassoncs-home-automation.txt bun <hush-cli> migrate --from v2
# → SAME FAILURE — not a key-loading issue
```

---

## Migration result

**BLOCKED — migration failed with a Hush CLI defect.**

No `.hush/` directory was created. The repo remains in v2 state.

---

## Root cause analysis

The `.hush.encrypted` file (dotenv-format SOPS) contains two self-referential interpolation entries:

```
OLLAMA_API_KEY=${OLLAMA_API_KEY}
OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
```

The plaintext `.hush.local` file (declared as `local: .hush.local` in hush.yaml) provides the actual values for these keys as local machine overrides.

In v2 hush, this pattern worked: the shared encrypted file held a self-referential placeholder, and the local override file provided the real value. The v2 runtime merged shared → local, so `OLLAMA_API_KEY` resolved correctly at runtime.

During migration, two bugs interact:

**Bug 1: Migration ignores plaintext local sources.**
The migration only reads local vars if `.hush.local.encrypted` exists (line 505-507 of `migrate.ts`). The plaintext `.hush.local` (not encrypted) is completely ignored — the local vars are never merged in.

**Bug 2: Unresolved self-referential interpolations survive into v3 files.**
`readLegacyVars` calls `interpolateVars(parseEnvContent(decrypted))`. The `interpolateVars` function leaves `${OLLAMA_API_KEY}` unresolved when the value equals the interpolation pattern itself (self-referential). These literal `${...}` strings are then written into the v3 encrypted file documents.

When `validateMigratedRepository` runs, `materializeV3Target` invokes the v3 interpolation engine (`interpolateCandidates`). The v3 engine finds `${OLLAMA_API_KEY}` in a value and tries to look up `OLLAMA_API_KEY` as a v3 logical path — but the path doesn't exist in the candidates map (v3 uses full logical paths like `env/project/shared/OLLAMA_API_KEY`, not short key names). This throws:

```
Error: Interpolation source "OLLAMA_API_KEY" does not exist in the repository graph
```

---

## Hush defects found

### Defect 1: Migration ignores plaintext local sources (BLOCKER)

**Command:** `hush migrate --from v2`

**Error:** `Error: Interpolation source "OLLAMA_API_KEY" does not exist in the repository graph`

**Root cause:** `migrate.ts` line 505-507 only reads local vars if `.hush.local.encrypted` exists. Plaintext local sources (declared in hush.yaml as `local: .hush.local`) are silently skipped. This prevents self-referential placeholders in the shared encrypted file from being resolved via the local overrides.

**Fix needed:** `migrate.ts` should also read plaintext local files (where `local: .hush.local` is declared and the file exists without `.encrypted` extension), merging them into the shared vars for interpolation resolution before writing v3 file documents.

**Workaround:** None without either (a) modifying the Hush CLI, or (b) manually re-encrypting `.hush.encrypted` with the self-referential values replaced by actual values. Manual secret editing is out of scope for migration agents.

**Systemic risk:** Any v2 repo where the `local:` source is a plaintext file AND the shared encrypted file uses self-referential interpolations will hit this blocker. This pattern appears to have been a valid v2 "template + local override" idiom.

### Defect 2: Unresolved interpolations silently survive into v3 files

**Context:** Even if Bug 1 were fixed (plaintext local source read), if any value in an encrypted source contains `${SOME_KEY}` where `SOME_KEY` references a short key name (not a v3 logical path), the v3 materializer will fail on validation.

**Fix needed:** The migration should detect unresolved interpolations after `interpolateVars()` (using `hasUnresolvedVars` / `getUnresolvedVars` from `core/interpolate.ts`) and either:
- Resolve them using the merged local var context before writing to v3, or
- Strip the interpolation pattern and write the literal value as-is (with a warning)

---

## Validation result

Not reached — migration failed before `.hush/` was created.

---

## Cleanup result

Not applicable — nothing to clean up.

---

## Package scripts / stale references

- `/scripts/bootstrap-hush-keys.sh` line 129 calls `hush decrypt --force` — this is a v2 pattern that should be updated to `hush run` or `hush materialize` in v3. Not updated because migration is blocked.

## `.gitignore` hazards (not fixed — migration blocked)

`.gitignore` contains bare `.hush/` on line 8 (and `.hush.*/` on line 9). These would block v3 commits once migration is complete. The `repairGitignoreForV3` function in `migrate.ts` handles this automatically — but it never ran because migration failed before that step.

## Suggested follow-up for Hush team

1. **Fix Bug 1** (blocker): Read plaintext `local:` sources in `migrate.ts` when `.hush.local` exists without the `.encrypted` extension. Merge into shared vars for interpolation resolution before writing v3 documents.
2. **Fix Bug 2** (correctness): After calling `interpolateVars`, check for unresolved patterns with `getUnresolvedVars`. Either resolve them using merged local context or emit a clear warning and write literal values.
3. **Add a test case**: A v2 repo with `local: .hush.local` (plaintext) and shared vars that use self-referential `${KEY}` patterns to defer to local overrides.
4. **Re-run this migration** after fix: `/Users/hassoncs/Workspaces/Personal/home/automation-core` using age key `~/.config/sops/age/keys/hassoncs-home-automation.txt`.
