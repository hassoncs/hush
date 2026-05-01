# Bootstrap Behavior

## Root Discovery

`findProjectRoot` (config/loader.ts) walks upward from the current directory looking for:
1. `.hush/manifest.encrypted` → v3 repository
2. `hush.yaml` → legacy v2

### Options

- `ignoreAncestors: true` — only check `startDir` itself; do not walk upward
- `stopAtGitRoot: true` — stop at `.git` boundaries (prevents nested git repos from inheriting parent `.hush/`)

## Nested Git Repos

**Problem**: A child git repo inside a parent Hush repo would silently inherit the parent's `.hush/` — causing key identity confusion and bootstrap failures.

**Solution**: `hush bootstrap --new-repo` forces a child-local repository:
- Sets `ignoreAncestors: true` on root discovery
- Fails if `.hush/` already exists at the child root
- Uses `--root` as the explicit bootstrap root

## Bootstrap Flow

1. **Plan preview** — prints current directory, git root, parent repo (if found), selected root, and reason
2. **Confirmation** — requires `--yes` in non-interactive mode; interactive TTY requires typing "yes"
3. **Mutation** — key setup, `.sops.yaml`, manifest, shared file
4. **Verification** — three checks:
   - `hush status` — repository loads with project identity
   - `hush inspect` — shared file decrypts with runtime key resolution
   - Key resolution — selected key source matches `.sops.yaml` public key

## Key Files

- `hush-cli/src/commands/bootstrap.ts` — main command
- `hush-cli/src/config/loader.ts` — `findProjectRoot` with options
- `hush-cli/src/store.ts` — `resolveStoreContext` threads options
- `hush-cli/src/commands/doctor.ts` — diagnostic command for root/key resolution

## CLI Flags

| Flag | Behavior |
|------|----------|
| `--new-repo` | Force child-local bootstrap; ignore parent `.hush/` |
| `--yes`, `-y` | Skip interactive confirmation |
