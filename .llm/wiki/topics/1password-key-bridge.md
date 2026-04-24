# Topic: 1Password Key Bridge

> Age key backup and restore via 1Password CLI.

## Overview

Hush bridges 1Password and local age key storage. Per-project age private keys are backed up to 1Password items so team members and CI can retrieve them without sharing keys via insecure channels.

## Key Storage Locations

| Location | Purpose |
|----------|---------|
| `~/.config/sops/age/keys/{project}.txt` | Local private key file |
| 1Password: `SOPS Key - {project}` | Encrypted backup of private key |
| `.sops.yaml` (committed) | Public key for SOPS creation rules |

## Commands (`hush-cli/src/commands/keys.ts`)

### `hush keys setup`

Bootstrap workflow for new developers or machines:
1. Checks for existing local key
2. If not found, tries 1Password via `ctx.onepassword.opGetKey(project)`
3. If found in 1Password, saves locally with `ctx.age.keySave(project, { private, public })`
4. If nothing found, prompts user to run `hush keys generate`

```
keys.ts lines 45-66:
  → ctx.age.keyExists(project) → return if exists
  → ctx.onepassword.opAvailable() → ctx.onepassword.opGetKey(project) → keySave
  → "No key found. Run 'hush keys generate'"
```

### `hush keys generate`

1. Validates `age` is installed via `ctx.age.ageAvailable()`
2. Generates new key pair via `ctx.age.ageGenerate()`
3. Saves locally via `ctx.age.keySave(project, key)`
4. Creates `~/.hush` bootstrap if global store mode
5. Backs up to 1Password via `ctx.onepassword.opStoreKey(project, private, public)`
6. Creates `.sops.yaml` if missing (with age public key in creation rules)

```
keys.ts lines 69-117:
  → ageCheck → ageGenerate → keySave → opStoreKey → .sops.yaml creation
```

### `hush keys pull`

1. Validates 1Password CLI available
2. Retrieves key via `ctx.onepassword.opGetKey(project)`
3. Derives public key via `ctx.age.agePublicFromPrivate(priv)`
4. Saves locally

### `hush keys push`

1. Loads local key via `ctx.age.keyLoad(project)`
2. Stores in 1Password via `ctx.onepassword.opStoreKey(project, private, public)`

### `hush keys list`

1. Lists local keys via `keysList()` from `hush-cli/src/lib/age.ts`
2. Lists 1Password keys via `opListKeys()` from `hush-cli/src/lib/onepassword.ts`

## 1Password Integration Layer

`hush-cli/src/lib/onepassword.ts`:
- **`opAvailable()`** — Checks if 1Password CLI is installed and authenticated
- **`opGetKey(project)`** — Retrieves the private key from 1Password item `SOPS Key - {project}`
- **`opStoreKey(project, private, public)`** — Creates or updates the 1Password item
- **`opListKeys(vault?)`** — Lists all SOPS key items in 1Password

## Age Key Management

`hush-cli/src/lib/age.ts`:
- **`keyExists(project)`** — Checks if key file exists at expected path
- **`keyPath(project)`** — Returns the path to the key file
- **`keySave(project, keyPair)`** — Writes private key to file with `0o600` permissions
- **`keyLoad(project)`** — Reads and returns the key pair
- **`keysList()`** — Lists all local key files with public key prefixes
- **`ageGenerate()`** — Generates a new age key pair via `age-keygen`
- **`agePublicFromPrivate(priv)`** — Derives public key from private key
- **`ageAvailable()`** — Checks if `age` CLI is installed

## Project Identifier Resolution

`getProject()` in `keys.ts` resolves the project identifier:
1. For global store mode: returns `GLOBAL_STORE_KEY_IDENTITY`
2. For legacy v2 repos: reads from `hush.yaml` project field
3. For v3 repos: calls `getProjectIdentifier(root)` which checks `package.json` repository URL

## CI Integration

For CI builds, the age private key is stored as `SOPS_AGE_KEY` GitHub secret. The key is injected via `SOPS_AGE_KEY_FILE` or env var during CI workflow execution.

## Prerequisites

```bash
brew install --cask 1password
brew install 1password-cli
```

Enable "Integrate with 1Password CLI" in 1Password desktop app settings for biometric auth flow.

> Sources: `hush-cli/src/commands/keys.ts` (lines 1-179) — all key subcommands; `hush-cli/src/lib/onepassword.ts` — 1Password CLI wrapper; `hush-cli/src/lib/age.ts` — age key management; `AGENTS.md` (lines 89-143) — key management documentation
