# @chriscode/hush

> **The AI-native secrets manager.** Secrets stay encrypted at rest. AI helps—without ever seeing values.

[![npm](https://img.shields.io/npm/v/@chriscode/hush)](https://www.npmjs.com/package/@chriscode/hush)
[![Documentation](https://img.shields.io/badge/docs-hush--docs.pages.dev-blue)](https://hush-docs.pages.dev)

<img src="./hero.webp" alt="Hush - AI-native secrets manager" style="width: 100%; max-width: 1200px; height: auto; border-radius: 8px; margin: 1.5rem 0;">

Hush keeps secrets **encrypted at rest** and only decrypts them in memory when running programs. AI assistants can help manage your secrets without ever seeing the actual values—because there are no plaintext files to read.

**[Read the full documentation →](https://hush-docs.pages.dev)**

## Quick Start (with AI)

```bash
npx @chriscode/hush skill
```

That's it. Once installed, ask your AI assistant: *"Set up Hush for this project"* — it knows what to do.

## Why Hush?

**The Problem:** AI coding assistants are incredibly helpful, but they can accidentally expose your secrets. Even with instructions to "not read .env files", LLMs find creative ways to access them using `cat`, `grep`, or shell tricks.

**The Solution:** Hush keeps secrets **encrypted at rest**—there are no plaintext `.env` files to read. When you need to run a program, `hush run -- <command>` decrypts secrets to memory and injects them as environment variables. The secrets never touch the disk.

## Features

- **Encrypted at rest** - No plaintext secrets on disk, ever
- **Run with secrets** - `hush run -- npm start` decrypts to memory only
- **AI-safe commands** - `hush inspect`, `hush has`, `hush set` never expose values
- **Interactive secret input** - `hush set API_KEY` prompts user, AI never sees value
- **Every framework** - Next.js, Vite, Remix, Expo, Cloudflare Workers, and more
- **Smart routing** - Route `NEXT_PUBLIC_*` to frontend, server secrets to API
- **Claude Code Skill** - AI automatically uses safe commands

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

**Optional but recommended:** Install 1Password CLI for automatic key backup:
```bash
brew install --cask 1password
brew install 1password-cli
```

## Quick Start

### 1. Initialize Hush (auto-generates keys)

```bash
npx hush init
```

This will:
- Auto-detect your project structure
- Generate an age encryption key
- Back up the key to 1Password (if available)
- Create `hush.yaml` and `.sops.yaml`

**No 1Password?** Keys are saved locally to `~/.config/sops/age/keys/`. Share them securely with your team.

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

### 4. Encrypt and run

```bash
npx hush encrypt              # Encrypt secrets
npx hush run -- npm start     # Run with secrets (never written to disk!)
npx hush run -e prod -- npm build  # Run with production secrets
npx hush status               # Check your setup
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

| Command | Description | AI-Safe? |
|---------|-------------|----------|
| `hush run -- <cmd>` | Run command with secrets in memory | ✅ |
| `hush set <KEY>` | Set a secret interactively | ✅ |
| `hush set <KEY> --gui` | Set secret via macOS dialog (for AI agents) | ✅ |
| `hush edit [env]` | Edit secrets in `$EDITOR` | ✅ |
| `hush inspect` | List variables (masked values) | ✅ |
| `hush has <KEY>` | Check if a secret exists | ✅ |
| `hush init` | Generate config + keys (auto 1Password backup) | ✅ |
| `hush encrypt` | Encrypt `.env` files | ✅ |
| `hush keys setup` | Pull key from 1Password or use local | ✅ |
| `hush keys generate` | Generate new key + backup to 1Password | ✅ |
| `hush keys list` | List local and 1Password keys | ✅ |
| `hush push` | Push to Cloudflare Workers | ✅ |
| `hush status` | Show configuration | ✅ |
| `hush skill` | Install AI skill | ✅ |
| `hush check` | Verify encryption sync | ✅ |
| `hush list` | List variables (shows values!) | ⚠️ |
| `hush decrypt` | Write secrets to disk (deprecated) | ⚠️ |

## AI-Native Design

Hush is built for a world where AI helps write code. Traditional secrets management fails because LLMs can read `.env` files using `cat`, `grep`, or other tools—even when told not to.

**Hush solves this by keeping secrets encrypted at rest.** There are no plaintext files to read. When you need secrets, `hush run` decrypts them to memory and injects them as environment variables.

### `hush run` - Run Programs with Secrets

The primary way to use secrets. Decrypts to memory, never writes to disk.

```bash
$ hush run -- npm start           # Development
$ hush run -e prod -- npm build   # Production
$ hush run -t api -- wrangler dev # Filter for specific target
```

### `hush set <KEY>` - Add Secrets Safely

AI invokes this command, user enters the value. The secret is never visible to the AI.

```bash
$ hush set DATABASE_URL
Enter value for DATABASE_URL: ••••••••••••••••
✓ DATABASE_URL set (45 chars, encrypted)
```

### `hush inspect` - See What's Configured

Shows all secrets with **masked values**. AI can see what exists without seeing actual secrets.

```bash
$ hush inspect

Secrets for development:

  DATABASE_URL      = post****************... (45 chars)
  STRIPE_SECRET_KEY = sk_t****************... (32 chars)
  API_KEY           = (not set)

Total: 3 variables
```

### `hush has <KEY>` - Check Specific Secrets

```bash
$ hush has DATABASE_URL
DATABASE_URL is set (45 chars)

$ hush has MISSING_KEY
MISSING_KEY not found
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

When running with `hush run -t web -- npm start`:
- Web app receives only `NEXT_PUBLIC_*` variables in memory
- API receives `DATABASE_URL`, `STRIPE_SECRET_KEY` (no public vars)

## How It Works

### Source File Merging

When you run `hush run`:

1. **Shared** (`.env.encrypted`) - Base variables
2. **Environment** (`.env.development.encrypted` or `.env.production.encrypted`) - Overrides
3. **Local** (`.env.local.encrypted`) - Personal overrides (not committed)

Later files override earlier ones for the same key. All decryption happens in memory.

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
| `.env.local.encrypted` | No | Encrypted personal overrides |

**Note:** With the new `hush run` command, plaintext `.env` files are no longer generated. Secrets only exist in memory when running programs.

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

## Team Setup

### New team member onboarding

**With 1Password (recommended):**
```bash
npx hush keys setup   # Pulls key from 1Password automatically
```

**Without 1Password:**
1. Get the private key from a team member (via secure channel)
2. Save to `~/.config/sops/age/keys/{project}.txt`
3. Run `npx hush status` to verify

### Key management commands

```bash
hush keys setup      # Pull from 1Password or verify local key
hush keys generate   # Generate new key + backup to 1Password
hush keys pull       # Pull key from 1Password
hush keys push       # Push local key to 1Password
hush keys list       # List all keys (local + 1Password)
```

## Troubleshooting

### "SOPS is not installed" or "age not found"
```bash
brew install sops age
```

### "No identity matched"
Your age key doesn't match the one used to encrypt. Options:
1. **With 1Password:** Run `hush keys setup` to pull the correct key
2. **Without 1Password:** Get the private key from a team member

### "1Password CLI not available"
Hush works without 1Password - keys are stored locally. For backup:
```bash
brew install --cask 1password
brew install 1password-cli
# Enable "Integrate with 1Password CLI" in 1Password settings
```

### Target not receiving expected variables
Check your `include`/`exclude` patterns in `hush.yaml`. Run `hush status` to see target configuration.

### AI assistant reading .env files directly
Install the Claude Code skill: `npx hush skill --global`

## License

MIT
