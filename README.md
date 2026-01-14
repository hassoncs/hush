# @chriscode/hush

> **The AI-native secrets manager.** Encrypt secrets, commit safely, let AI help—without exposing values.

Hush is a SOPS-based secrets management tool designed for the AI coding era. It encrypts your `.env` files so they can be safely committed to git, distributes secrets to any framework in your monorepo, and includes an **Agent Skill** that teaches AI assistants to work with secrets without ever seeing the actual values.

## Why Hush?

**The Problem:** AI coding assistants are incredibly helpful, but they can accidentally expose your secrets. When Claude, Copilot, or Cursor reads your `.env` file, those secrets get sent to the LLM provider.

**The Solution:** Hush provides AI-safe commands (`hush inspect`, `hush has`) that let AI agents reason about your secrets—checking which exist, their types, and where they're routed—without ever seeing the actual values. Plus, the included **Claude Code Skill** automatically teaches AI to use these commands.

## Features

- **Encrypted secrets in git** - Commit `.env.encrypted` files safely, decrypt anywhere
- **Every framework supported** - Next.js, Vite, Remix, Expo, Cloudflare Workers, and more
- **Smart routing** - Route `NEXT_PUBLIC_*` to frontend, server secrets to API
- **Multiple output formats** - dotenv, Wrangler, JSON, shell, YAML
- **AI-native by design** - Query secrets without exposing values to LLMs
- **Claude Code Skill included** - AI automatically uses safe commands

## Framework Support

Hush works with **every major framework** out of the box. Use `include`/`exclude` patterns to route the right variables to each target:

| Framework | Client Prefix | Example Pattern |
|-----------|--------------|-----------------|
| **Next.js** | `NEXT_PUBLIC_*` | `include: [NEXT_PUBLIC_*]` |
| **Vite** | `VITE_*` | `include: [VITE_*]` |
| **Create React App** | `REACT_APP_*` | `include: [REACT_APP_*]` |
| **Vue CLI** | `VUE_APP_*` | `include: [VUE_APP_*]` |
| **Nuxt** | `NUXT_PUBLIC_*` | `include: [NUXT_PUBLIC_*]` |
| **Astro** | `PUBLIC_*` | `include: [PUBLIC_*]` |
| **SvelteKit** | `PUBLIC_*` | `include: [PUBLIC_*]` |
| **Expo / React Native** | `EXPO_PUBLIC_*` | `include: [EXPO_PUBLIC_*]` |
| **Gatsby** | `GATSBY_*` | `include: [GATSBY_*]` |
| **Remix** | (server-only) | No filtering needed |
| **Cloudflare Workers** | (server-only) | `format: wrangler` |

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

### 2. Initialize Hush

```bash
npx hush init
```

This creates `hush.yaml` with auto-detected targets.

### 3. Create your env files

```bash
# .env (shared across environments)
DATABASE_URL=postgres://localhost/mydb
STRIPE_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_API_URL=${API_BASE}/v1

# .env.development
API_BASE=http://localhost:3000
DEBUG=true

# .env.production
API_BASE=https://api.example.com
DEBUG=false
```

### 4. Encrypt and use

```bash
npx hush encrypt          # Encrypt secrets
npx hush decrypt          # Decrypt for development
npx hush decrypt -e prod  # Decrypt for production
npx hush status           # Check your setup
```

## Configuration

### hush.yaml

```yaml
sources:
  shared: .env
  development: .env.development
  production: .env.production

targets:
  # Root gets all variables
  - name: root
    path: .
    format: dotenv

  # Next.js app gets only public variables
  - name: web
    path: ./apps/web
    format: dotenv
    include:
      - NEXT_PUBLIC_*

  # API gets everything except public variables  
  - name: api
    path: ./apps/api
    format: wrangler
    exclude:
      - NEXT_PUBLIC_*
      - VITE_*
      - EXPO_PUBLIC_*

  # Kubernetes config
  - name: k8s
    path: ./k8s
    format: yaml
```

### Output Formats

| Format | Output File | Use Case |
|--------|-------------|----------|
| `dotenv` | `.env.development` | Next.js, Vite, CRA, Vue, Nuxt, Remix, Astro, SvelteKit, Expo, Node.js |
| `wrangler` | `.dev.vars` | Cloudflare Workers & Pages |
| `json` | `.env.development.json` | AWS Lambda, serverless functions, custom tooling |
| `shell` | `.env.development.sh` | CI/CD pipelines, Docker builds, shell scripts |
| `yaml` | `.env.development.yaml` | Kubernetes ConfigMaps, Docker Compose |

### Target Options

| Option | Description |
|--------|-------------|
| `name` | Identifier for the target |
| `path` | Directory to write output file |
| `format` | Output format: `dotenv`, `wrangler`, `json`, `shell`, `yaml` |
| `include` | Glob patterns to include (e.g., `NEXT_PUBLIC_*`) |
| `exclude` | Glob patterns to exclude |

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
| `hush check` | Verify encrypted files are in sync (for pre-commit hooks) |
| `hush push` | Push production secrets to Cloudflare Workers |
| `hush status` | Show configuration and file status |
| `hush skill` | Install Claude Code / OpenCode skill |

## AI-Native Design

Hush is built for a world where AI helps write code. Traditional secrets management exposes values when AI reads `.env` files. Hush solves this with AI-safe commands.

### `hush inspect` - See What's Configured

Shows all secrets with **masked values**. AI can see what exists without seeing actual secrets.

```bash
$ hush inspect

Secrets for development:

  DATABASE_URL      = post****************... (45 chars)
  STRIPE_SECRET_KEY = sk_t****************... (32 chars)
  API_KEY           = (not set)

Total: 3 variables

Target distribution:
  web (./apps/web) - 1 var (include: NEXT_PUBLIC_*)
  api (./apps/api) - 2 vars (exclude: NEXT_PUBLIC_*)
```

### `hush has <KEY>` - Check Specific Secrets

```bash
$ hush has DATABASE_URL
DATABASE_URL is set (45 chars)

$ hush has MISSING_KEY
MISSING_KEY not found

# Quiet mode for scripts
$ hush has API_KEY -q && echo "configured" || echo "missing"
```

### Claude Code / OpenCode Skill

For [Claude Code](https://docs.anthropic.com/en/docs/claude-code) or [OpenCode](https://github.com/opencode-ai/opencode) users, Hush includes a ready-to-use **Agent Skill** that automatically teaches the AI to never read `.env` files directly.

**Install the skill:**

```bash
npx hush skill           # Interactive: choose global or local
npx hush skill --global  # Install to ~/.claude/skills/ (all projects)
npx hush skill --local   # Install to ./.claude/skills/ (this project)
```

**Global vs Local:**
- **Global** (`~/.claude/skills/`) - Works across all your projects. Recommended for personal use.
- **Local** (`./.claude/skills/`) - Bundled with the project. Recommended for teams (commit to git).

**What the skill does:**
- Detects when you're working with secrets or environment variables
- Uses `hush inspect` and `hush has` instead of reading `.env` files
- Guides you through adding or modifying secrets safely
- Never exposes secret values to the LLM

The skill includes `SKILL.md` (core instructions), `REFERENCE.md` (command details), and `examples/workflows.md` (step-by-step guides).

## Example: Monorepo with Next.js + Cloudflare Worker

```yaml
# hush.yaml
sources:
  shared: .env
  development: .env.development
  production: .env.production

targets:
  # Next.js frontend - only public vars
  - name: web
    path: ./apps/web
    format: dotenv
    include:
      - NEXT_PUBLIC_*

  # Cloudflare Worker API - server secrets only
  - name: api
    path: ./apps/api
    format: wrangler
    exclude:
      - NEXT_PUBLIC_*
```

```bash
# .env
DATABASE_URL=postgres://...
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_API_URL=${API_BASE}/v1
NEXT_PUBLIC_STRIPE_KEY=pk_live_...

# .env.development
API_BASE=http://localhost:8787

# .env.production
API_BASE=https://api.myapp.com
```

After `hush decrypt`:
- `apps/web/.env.development` contains only `NEXT_PUBLIC_*` variables
- `apps/api/.dev.vars` contains `DATABASE_URL`, `STRIPE_SECRET_KEY` (no public vars)

## How It Works

### Source File Merging

When you run `hush decrypt`:

1. **Shared** (`.env.encrypted`) - Base variables
2. **Environment** (`.env.development.encrypted` or `.env.production.encrypted`) - Overrides
3. **Local** (`.env.local`, unencrypted) - Personal overrides (not committed)

Later files override earlier ones for the same key.

### Variable Interpolation

Reference other variables with `${VAR}`:

```bash
HOST=localhost
PORT=3000
BASE_URL=http://${HOST}:${PORT}
API_URL=${BASE_URL}/api
```

### Target Filtering

Use `include` and `exclude` patterns to route variables to the right places:

```yaml
targets:
  - name: frontend
    include: [NEXT_PUBLIC_*, VITE_*]    # Only client-safe vars
    
  - name: backend
    exclude: [NEXT_PUBLIC_*, VITE_*]    # Everything except client vars
```

## Git Hook Integration

Prevent committing unencrypted changes with `hush check`:

```bash
# .husky/pre-commit
npx hush check || exit 1
```

Bypass when needed: `HUSH_SKIP_CHECK=1 git commit -m "emergency fix"`

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
| `*/.dev.vars` | No | Generated Wrangler secrets |

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
const vars = parseEnvContent(decryptedContent);
const interpolated = interpolateVars(vars);
const filtered = filterVarsForTarget(interpolated, config.targets[0]);
const output = formatVars(filtered, 'dotenv');
```

## Troubleshooting

### "No identity matched"
Your age key doesn't match. Get the correct key from a team member.

### "SOPS is not installed"
```bash
brew install sops age
```

### Target not receiving expected variables
Check your `include`/`exclude` patterns in `hush.yaml`. Run `hush status` to see target configuration.

### AI assistant reading .env files directly
Install the Claude Code skill: `cp -r .claude/skills/hush-secrets ~/.claude/skills/`

## License

MIT
