# Topic: Secret Encryption

> SOPS+age wrapper around encryption/decryption operations.

## Overview

Hush delegates all encryption and decryption to **SOPS** (Secrets OPerationS) using **age** as the encryption backend. The `core/sops.ts` module wraps `sops` CLI invocations for encrypt, decrypt, and edit operations.

## Encryption Flow

1. **Input**: Plaintext content is written to a private temp file in a `0o700` directory with `0o600` permissions.
2. **SOPS invocation**: `sops --input-type <format> --output-type <format> --encrypt --filename-override <output> <input>`
3. **Output**: Encrypted YAML/DOTENV content is written to the target `.encrypted` file.
4. **Cleanup**: Temp directory is removed in a `finally` block.

```
hush-cli/src/core/sops.ts:withPrivatePlaintextTempFile()
  → mkdtempSync + writeFileSync (0o600)
  → action(tempFile)  // encryptWithFormat
  → rmSync (finally)
```

## Decryption Flow

1. **Key resolution**: Age key is located via explicit SOPS env (`SOPS_AGE_KEY_FILE`, `SOPS_AGE_KEY_CMD`, `SOPS_AGE_KEY`) → per-project key path → standard SOPS keyring `~/.config/sops/age/keys.txt` → legacy compatibility path `~/.config/sops/age/key.txt`.
2. **SOPS invocation**: `sops --input-type <format> --output-type <format> --decrypt <file>`
3. **Output**: Plaintext content returned as string.

```
hush-cli/src/core/sops.ts:decryptWithFormat()
  → getAgeKeyFile() → getSopsEnv() → execSync(sops --decrypt)
```

## Key Resolution Priority

`getAgeKeyFile()` (in `hush-cli/src/core/sops.ts`, lines 26-50):

1. `SOPS_AGE_KEY_FILE` env var (highest priority)
2. `SOPS_AGE_KEY_CMD` / `SOPS_AGE_KEY` env vars (passed through untouched)
3. Per-project key at `~/.config/sops/age/keys/{project}.txt` if `keyIdentity` matches
4. Project-identifier-derived key (from `getProjectIdentifier(root)`)
5. Standard SOPS keyring at `~/.config/sops/age/keys.txt`
6. Legacy compatibility fallback at `~/.config/sops/age/key.txt`

## Encryption Formats

Two formats are supported:
- **dotenv** — `KEY=VALUE` format for environment variable files
- **yaml** — YAML format for manifest and structured config

Each has dedicated functions: `encrypt`/`decrypt` for dotenv, `encryptYaml`/`decryptYaml` for YAML.

## SOPS Configuration

`getSopsConfigFile()` looks for `.sops.yaml` in the project root. If found, it's passed via `--config` to SOPS commands. The `.sops.yaml` file contains:
- `creation_rules` with `age` (public key) and optionally `encrypted_regex` to control what SOPS encrypts.

## Error Handling

Decryption errors check for `No identity matched` in stderr and now report the selected key identity/source plus every attempted key path so repo bootstrap and local key placement are easier to debug. All SOPS failures include stderr output in the error message.

### In-memory content encryption

`encryptYamlContent()` allows encrypting a YAML string directly without a source file, using `withPrivatePlaintextTempFile()` internally.

### File edit

`sops --encrypt` is called with `stdio: inherit` to allow SOPS's interactive editor. The file is edited in-place by SOPS.

## Source Attribution

> Sources: `hush-cli/src/core/sops.ts` (full file, lines 1-256) — `decryptWithFormat`, `encryptWithFormat`, `withPrivatePlaintextTempFile`, `getAgeKeyFile`, `getSopsEnv`, `setKey`, `edit`
