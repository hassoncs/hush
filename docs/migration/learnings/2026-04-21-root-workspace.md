# Migration Note: root workspace hush.yaml

**Date:** 2026-04-21
**Project path:** `/Users/hassoncs/Workspaces`
**Hush CLI version:** 5.1.1 (via built dist)

---

## Legacy evidence found

- `hush.yaml` at `/Users/hassoncs/Workspaces/hush.yaml` — `version: 2`, no `project:` declared
- Sources declared: `shared` (`.hush`), `development` (`.hush.development`), `production` (`.hush.production`), `local` (`.hush.local`) — **none of these encrypted files exist on disk**
- 28 targets declared (dotenv format), pointing to subdirectories: `ClawRouter`, `coinbase-bot`, `fsf-sniper`, `gemini-cli`, `handbook`, `iterm-mcp`, `liftlog`, `liftlog-web`, `lynx-macros-ai`, `mintable`, `open-pencil`, `open-webui`, `opencode-anthropic-auth`, `openrouter-scriptable-widget`, `penpot`, `playwright-vscode`, `react-bits`, `react-native-godot`, `shader-tool`, `starter-vite-turbo`, `supermemory-mcp`, `tambo`, `three.js`, `tidbyt-sf-transit`, `vosk-tests`, `vscode-power-mode`, `word-fling`, plus a `root` target at `.`
- No `.sops.yaml` at workspace root
- No `.hush*` encrypted files at workspace root
- Not a git repository (no `.git` dir)

This is a **keyless, empty shell config** — it declared structure but no secrets were ever stored here.

---

## Does v3 have a global or workspace-level Hush concept?

Yes, partially. v3 has a `--global` flag that uses `~/.hush` as an explicit global store. Commands like `hush bootstrap --global`, `hush set --global`, `hush edit --global`, `hush status --global`, and `hush run --global` all target the global store at `~/.hush`.

However, there is **no workspace-level concept** in v3. The model is:
- **Per-project repos**: `.hush/` directory inside each individual project
- **Global store**: `~/.hush` for cross-project / machine-level secrets

The legacy `hush.yaml` at `/Users/hassoncs/Workspaces` was acting as a workspace meta-config spanning many sub-projects, writing `.env` files into each subdirectory. This usage pattern **does not exist in v3** — each project manages its own `.hush/` repo, or uses the global store for shared secrets.

The sub-projects that actually had secrets (`Personal/bigcapital`, `Personal/canary-service`, `Personal/fitbot`) already have their own v3 `.hush/` repos migrated separately.

---

## Migration decision

**Path taken: straight deletion — no bootstrap, no migrate.**

Rationale:
1. No encrypted source files existed alongside `hush.yaml` — there was nothing to decrypt or migrate.
2. `hush migrate --from v2` would fail at `validateMigrationPrerequisites` (line 224-229 of migrate.ts) because there are no encrypted sources and no `.sops.yaml`. The code explicitly says: "Use `hush bootstrap` instead."
3. `hush bootstrap` would create a new v3 repo with an age key — wrong move for an empty shell that held no data.
4. The v3 workspace concept does not exist; this config pattern is obsolete.
5. Not a git repo, so no commit concerns.

The correct action was simply to remove the orphaned file.

---

## Commands run

```bash
# Status check (confirmed legacy-v2, no encrypted files)
cd /Users/hassoncs/Workspaces && bun /path/to/hush-cli/dist/cli.js status

# Dry-run attempt (hit EACCES defect — see below)
cd /Users/hassoncs/Workspaces && bun /path/to/hush-cli/dist/cli.js migrate --from v2 --dry-run

# Removal
rm /Users/hassoncs/Workspaces/hush.yaml
```

---

## Defects found

### 1. `collectCommandReferences` EACCES crash (migrate.ts)

`hush migrate --from v2 --dry-run` and `hush migrate --from v2` both exit with:

```
Error: EACCES: permission denied, scandir '/Users/hassoncs/Workspaces/Personal/dev/mac-e2e/.Trashes'
```

`collectCommandReferences` in `migrate.ts` (lines 113-152) does a recursive directory walk using `ctx.fs.readdirSync` without any error handling. When it hits a directory it cannot read (e.g. `.Trashes` inside a project), the whole migration aborts.

The fix is to wrap the `readdirSync` call in a try/catch and skip unreadable directories. The walker already skips `node_modules`, `.git`, and `.hush`, but not system-protected directories.

**Impact:** Any migration run from a workspace root (or any directory with permission-denied subdirs) will fail before producing inventory output. This makes `--dry-run` useless in large workspace roots.

**Workaround:** Run migrate from a tighter project root where you have read access to all subdirectories. Not applicable here since the workspace root itself was the problem.

### 2. `migrate --from v2` would have failed at prerequisites anyway

Even if the EACCES bug were fixed, `validateMigrationPrerequisites` throws for keyless repos with no encrypted sources. The error message is reasonable: "Use `hush bootstrap` instead." But in this case, bootstrap is also wrong. There is no good migration path for a keyless/empty workspace-level `hush.yaml` — deletion is the only correct action, and the CLI gives no affordance for this case.

---

## Cleanup result

`hush.yaml` removed. Workspace root has no `.hush/` directory, no encrypted artifacts, and no legacy config. Sub-projects with actual secrets (`bigcapital`, `canary-service`, `fitbot`) were migrated separately and are unaffected.

---

## Files changed

- Deleted: `/Users/hassoncs/Workspaces/hush.yaml`
