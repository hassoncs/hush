# @chriscode/hush

> SOPS-based secrets management for monorepos. Encrypt once, decrypt everywhere.

Hush manages secrets across your monorepo using [SOPS](https://github.com/getsops/sops) with [age](https://github.com/FiloSottile/age) encryption. Configure targets explicitly via `hush.yaml` and route secrets with include/exclude patterns.

## Features

- **Multiple source files** - Separate `.env`, `.env.development`, `.env.production`
- **Explicit configuration** - `hush.yaml` defines sources and targets
- **Include/exclude patterns** - Route `EXPO_PUBLIC_*` to apps, other vars to APIs
- **Multiple output formats** - dotenv, Wrangler `.dev.vars`, JSON, shell exports
- **Cloudflare integration** - Push secrets to Workers with one command
- **AI-native inspection** - Query secrets without exposing values to LLMs

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

### 2. Initialize hush

```bash
npx hush init
```

This creates `hush.yaml` with auto-detected targets.

### 3. Create your env files

```bash
# .env (shared across environments)
DATABASE_URL=postgres://localhost/mydb
STRIPE_SECRET_KEY=sk_test_xxx
EXPO_PUBLIC_API_URL=${API_BASE}/v1

# .env.development
API_BASE=http://localhost:8787
DEBUG=true

# .env.production
API_BASE=https://api.example.com
DEBUG=false
```

### 4. Encrypt and use

```bash
# Encrypt your secrets
npx hush encrypt

# Decrypt for local development
npx hush decrypt

# Decrypt for production
npx hush decrypt -e production

# Check your setup
npx hush status
```

## Configuration

### hush.yaml

```yaml
sources:
  shared: .env
  development: .env.development
  production: .env.production

targets:
  - name: root
    path: .
    format: dotenv

  - name: app
    path: ./app
    format: dotenv
    include:
      - EXPO_PUBLIC_*
      - NEXT_PUBLIC_*
      - VITE_*

  - name: api
    path: ./api
    format: wrangler
    exclude:
      - EXPO_PUBLIC_*
      - NEXT_PUBLIC_*
      - VITE_*
```

### Target Options

| Option | Description |
|--------|-------------|
| `name` | Identifier for the target |
| `path` | Directory to write output file |
| `format` | Output format: `dotenv`, `wrangler`, `json`, `shell` |
| `include` | Glob patterns to include (e.g., `EXPO_PUBLIC_*`) |
| `exclude` | Glob patterns to exclude |

### Output Formats

| Format | Output File | Use Case |
|--------|-------------|----------|
| `dotenv` | `.env.development` / `.env.production` | Standard apps |
| `wrangler` | `.dev.vars` | Cloudflare Workers |
| `json` | `.env.development.json` | JSON consumers |
| `shell` | `.env.development.sh` | Sourceable shell exports |

## Commands

| Command | Description |
|---------|-------------|
| `hush init` | Generate `hush.yaml` with auto-detected targets |
| `hush encrypt` | Encrypt `.env` files to `.env.encrypted` |
| `hush decrypt` | Decrypt and distribute to all targets |
| `hush decrypt -e prod` | Decrypt with production values |
| `hush edit` | Edit shared secrets in `$EDITOR` |
| `hush edit development` | Edit development secrets |
| `hush list` | List all variables (shows values) |
| `hush inspect` | List all variables (masked values, AI-safe) |
| `hush has <KEY>` | Check if a secret exists (exit 0/1) |
| `hush push` | Push production secrets to Cloudflare Workers |
| `hush push --dry-run` | Preview what would be pushed |
| `hush status` | Show configuration and file status |

## AI-Native Commands

Hush provides commands that let AI agents and coding assistants query secrets without exposing actual values. This prevents secrets from being sent to LLM providers.

### `hush inspect` - Masked Variable Listing

Shows all secrets with masked values. Safe for AI agents to read.

```bash
$ hush inspect

Secrets for development:

  DATABASE_URL      = post****************... (45 chars)
  STRIPE_SECRET_KEY = sk_t****************... (32 chars)
  API_KEY           = (not set)

Total: 3 variables

Target distribution:

  root (.) - 3 vars
  app (./app/) - 1 vars
    include: EXPO_PUBLIC_*
  api (./api/) - 2 vars
    exclude: EXPO_PUBLIC_*
```

### `hush has <KEY>` - Check Secret Existence

Check if a specific secret is configured. Returns exit code 0 if set, 1 if not.

```bash
# Check if DATABASE_URL is set
$ hush has DATABASE_URL
DATABASE_URL is set (45 chars)
$ echo $?
0

# Check missing secret
$ hush has MISSING_KEY
MISSING_KEY not found
$ echo $?
1

# Quiet mode for scripting
$ hush has DATABASE_URL -q && echo "DB configured"
DB configured
```

### Use Cases for AI Agents

Instead of reading `.env` files directly (which exposes secrets to the LLM):

```bash
# AI agent checks configuration
hush inspect                    # See what's configured
hush has STRIPE_SECRET_KEY      # Verify specific secret exists
hush has DATABASE_URL -q || echo "Need to configure DATABASE_URL"
```

This lets agents reason about secrets (existence, which targets receive them) without ever seeing the actual values.

## How It Works

### Source File Merging

When you run `hush decrypt`:

1. **Shared** (`.env.encrypted`) - Base variables
2. **Environment** (`.env.development.encrypted` or `.env.production.encrypted`) - Overrides
3. **Local** (`.env.local`, unencrypted) - Personal overrides

Later files override earlier ones for the same key.

### Variable Interpolation

Reference other variables with `${VAR}`:

```bash
# .env
HOST=localhost
PORT=3000
BASE_URL=http://${HOST}:${PORT}
API_URL=${BASE_URL}/api
```

### Target Filtering

Use `include` and `exclude` patterns to route variables:

```yaml
targets:
  - name: app
    path: ./app
    format: dotenv
    include:
      - EXPO_PUBLIC_*    # Only client-safe vars

  - name: api
    path: ./api
    format: wrangler
    exclude:
      - EXPO_PUBLIC_*    # Everything except client vars
```

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

## File Reference

| File | Committed | Purpose |
|------|-----------|---------|
| `hush.yaml` | Yes | Configuration |
| `.sops.yaml` | Yes | SOPS config with public key |
| `.env.encrypted` | Yes | Encrypted shared secrets |
| `.env.development.encrypted` | Yes | Encrypted dev secrets |
| `.env.production.encrypted` | Yes | Encrypted prod secrets |
| `.env.local` | No | Personal overrides (unencrypted) |
| `.env.development` | No | Generated dev env |
| `.env.production` | No | Generated prod env |
| `api/.dev.vars` | No | Generated Wrangler secrets |

## Programmatic Usage

```typescript
import {
  loadConfig,
  parseEnvContent,
  interpolateVars,
  filterVarsForTarget,
  mergeVars,
  formatVars,
} from '@chriscode/hush';

const config = loadConfig('/path/to/repo');
const shared = parseEnvContent(decryptedContent);
const env = parseEnvContent(envContent);
const merged = mergeVars(shared, env);
const interpolated = interpolateVars(merged);
const filtered = filterVarsForTarget(interpolated, config.targets[0]);
const output = formatVars(filtered, 'dotenv');
```

## Migrating from v1

v2 replaces environment prefixes (`DEV__`, `PROD__`) with separate files:

| v1 | v2 |
|----|-----|
| `DEV__API_URL=...` in `.env` | `API_URL=...` in `.env.development` |
| `PROD__API_URL=...` in `.env` | `API_URL=...` in `.env.production` |
| Auto-detection of packages | Explicit `hush.yaml` configuration |
| Hardcoded `EXPO_PUBLIC_*` routing | Configurable `include`/`exclude` patterns |

## Troubleshooting

### "No identity matched"
Your age key doesn't match. Get the correct key from a team member.

### "SOPS is not installed"
```bash
brew install sops
```

### Target not receiving expected variables
Check your `include`/`exclude` patterns in `hush.yaml`. Run `hush status` to see target configuration.

## License

MIT
