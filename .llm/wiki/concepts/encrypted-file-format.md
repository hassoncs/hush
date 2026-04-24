# Concept: .encrypted File Format

> SOPS-encrypted YAML/DOTENV files — no plaintext at rest.

## What It Is

Every config document in Hush is stored as a SOPS-encrypted file with the `.encrypted` extension. SOPS (Secrets OPerationS) encrypts individual values within a structured document, keeping the document format intact but all values encrypted.

## Encryption Backend

Hush uses **age** (age-encryption.org) as its SOPS encryption backend:
- Age is a modern encryption tool designed for simplicity and security
- Uses X25519 for key exchange and ChaCha20-Poly1305 for encryption
- Key files contain both public and private components

## File Structure

An encrypted file looks like this on disk:

```yaml
sops:
    kms: []
    gcp_kms: []
    azure_kv: []
    hc_vault: []
    age:
        - recipient: age1publickey...
          enc: AQCencryptedkeyblob...
    lastmodified: "2025-01-15T..."
    mac: ENC[AES_256_GCM,data:...,iv:...,tag:...]
    pgp: []
    unencrypted_suffix: _unencrypted
    version: 3.9.0
env_key1: ENC[AES_256_GCM,data:encryptedvalue,iv:...,aad:...,tag:...]
env_key2: ENC[AES_256_GCM,data:encryptedvalue,iv:...,aad:...,tag:...]
```

Key observations:
- **SOPS metadata block** — Stores encryption info, including which age public key can decrypt
- **Each value is independently encrypted** — `ENC[AES_256_GCM,data:...,iv:...,tag:...]`
- **Keys remain visible** — The key names are not encrypted, only values
- **MAC covers the entire document** — Detects tampering

## Format Variants

Two SOPS formats are used:

### DOTENV Format
- Used for secret files (`.hush/files/**/*.encrypted`)
- `KEY=VALUE` line syntax
- Parsed via `decrypt(filePath)` in `hush-cli/src/core/sops.ts`

### YAML Format
- Used for the manifest (`.hush/manifest.encrypted`)
- Hierarchical structure
- Parsed via `decryptYaml(filePath)` in `hush-cli/src/core/sops.ts`

## SOPS Configuration

The `.sops.yaml` file in the project root tells SOPS how to encrypt new files:

```yaml
creation_rules:
  - encrypted_regex: '.*'
    age: age1publickeyxyz...
```

- **`encrypted_regex: '.*'`** — Encrypt ALL values (including non-secret ones)
- **`age`** — The age public key for encryption

This is committed to the repository. The public key can be shared freely — only the private key can decrypt.

## Decryption Requirements

To decrypt an `.encrypted` file:
1. SOPS must be installed (`brew install sops`)
2. An age private key matching the public key in the file's SOPS metadata must be available
3. SOPS_AGE_KEY_FILE env var or default key path must point to the key

## Security Properties

- **No plaintext on disk** — Values are encrypted at rest
- **Key names visible** — Attackers can see what secrets exist (e.g., `AWS_ACCESS_KEY_ID`) but not their values
- **Per-file encryption** — Each `.encrypted` file has its own SOPS metadata block
- **MAC verification** — SOPS detects tampered files via MAC check

> Sources: `hush-cli/src/core/sops.ts` (lines 86-110) — `decryptWithFormat`, SOPS CLI invocation; `hush-cli/src/core/sops.ts` (lines 120-153) — `encryptWithFormat`, SOPS encryption; `hush-cli/src/core/sops.ts` (lines 163-181) — `encryptYamlContent`, inline content encryption; `README.md` (lines 85-93) — v3 repository file layout
