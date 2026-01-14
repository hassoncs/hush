# @chriscode/hush

> SOPS-based secrets management for monorepos. Encrypt once, decrypt everywhere.

Hush manages secrets across your monorepo using [SOPS](https://github.com/getsops/sops) with [age](https://github.com/FiloSottile/age) encryption. It automatically detects your packages and generates the right env files for each.

## Features

- **Single encrypted file** - One `.env.encrypted` committed to git
- **Environment prefixes** - `DEV__` and `PROD__` for env-specific values
- **Auto-detection** - Finds packages, detects Wrangler vs standard
- **Smart routing** - `EXPO_PUBLIC_*` to apps, other vars to APIs
- **Cloudflare integration** - Push secrets to Workers with one command

## Installation

```bash
pnpm add -D @chriscode/hush
# or
npm install -D @chriscode/hush
```

### Prerequisites

```bash
brew install sops age
```

Set up your age key:

```bash
mkdir -p ~/.config/sops/age
age-keygen -o ~/.config/sops/age/key.txt
```

## Quick Start

### 1. Create `.sops.yaml` in your repo root

```yaml
creation_rules:
  - encrypted_regex: '.*'
    age: YOUR_AGE_PUBLIC_KEY
```

Get your public key from `~/.config/sops/age/key.txt`.

### 2. Create `.env` with your secrets

```bash
# Shared across all environments
DATABASE_URL=postgres://localhost/mydb
EXPO_PUBLIC_API_KEY=pk_xxx

# Development only (prefix stripped on decrypt)
DEV__EXPO_PUBLIC_API_URL=http://localhost:8787

# Production only
PROD__EXPO_PUBLIC_API_URL=https://api.example.com
```

### 3. Encrypt and use

```bash
# Encrypt your secrets
npx hush encrypt

# Decrypt for local development
npx hush decrypt

# Check your setup
npx hush status
```

## Commands

| Command | Description |
|---------|-------------|
| `hush decrypt` | Decrypt and generate env files for all packages |
| `hush decrypt --env prod` | Decrypt with production values |
| `hush encrypt` | Encrypt `.env` to `.env.encrypted` |
| `hush edit` | Edit encrypted file in `$EDITOR` |
| `hush push` | Push production secrets to Cloudflare Workers |
| `hush push --dry-run` | Preview what would be pushed |
| `hush status` | Show setup status and discovered packages |

## Package Scripts

Add to your `package.json`:

```json
{
  "scripts": {
    "secrets": "hush",
    "secrets:decrypt": "hush decrypt",
    "secrets:encrypt": "hush encrypt",
    "secrets:edit": "hush edit",
    "secrets:push": "hush push",
    "secrets:status": "hush status"
  }
}
```

## How It Works

### Package Detection

Hush scans for `package.json` files and determines the package type:

| Detection | Type | Output |
|-----------|------|--------|
| `wrangler.toml` (Workers) | wrangler | `.dev.vars` |
| `wrangler.toml` with `pages_build_output_dir` | standard | `.env.development` |
| No wrangler.toml | standard | `.env.development` |

### Variable Routing

- `EXPO_PUBLIC_*` → Standard packages only (apps, Pages)
- Other variables → Wrangler packages only (Workers APIs)

This ensures client-side vars go to your app and server secrets go to your API.

### Environment Prefixes

```bash
# No prefix = shared
API_KEY=xxx

# DEV__ prefix = development only (stripped to API_KEY)
DEV__API_KEY=dev_xxx

# PROD__ prefix = production only (stripped to API_KEY)
PROD__API_KEY=prod_xxx
```

When you run `hush decrypt`:
- `--env dev` (default): Uses `DEV__` vars, ignores `PROD__`
- `--env prod`: Uses `PROD__` vars, ignores `DEV__`

## Local Overrides

Create `.env.local` (gitignored) for personal overrides:

```bash
# .env.local
MY_DEBUG_VAR=true
```

Local overrides are merged last and take precedence.

## Programmatic Usage

```typescript
import { 
  discoverPackages, 
  decrypt, 
  parseEnvContent,
  getVarsForEnvironment 
} from '@chriscode/hush';

const packages = await discoverPackages('/path/to/monorepo');
const content = decrypt('/path/to/.env.encrypted');
const vars = parseEnvContent(content);
const devVars = getVarsForEnvironment(vars, 'dev');
```

## File Reference

| File | Committed | Purpose |
|------|-----------|---------|
| `.env.encrypted` | Yes | Encrypted secrets (source of truth) |
| `.sops.yaml` | Yes | SOPS config with public key |
| `.env` | No | Generated root env |
| `.env.local` | No | Personal overrides |
| `.env.development` | No | Generated dev env |
| `.env.production` | No | Generated prod env |
| `api/.dev.vars` | No | Generated Wrangler secrets |

## Troubleshooting

### "No identity matched"
Your age key doesn't match. Get the correct key from a team member.

### "SOPS is not installed"
```bash
brew install sops
```

### Package detected as wrong type
Check for unexpected `wrangler.toml` files. For Cloudflare Pages, ensure it has `pages_build_output_dir` to be treated as standard.

## License

MIT
