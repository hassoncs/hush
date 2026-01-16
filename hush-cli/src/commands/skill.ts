import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import { join } from 'node:path';
import pc from 'picocolors';
import type { SkillOptions } from '../types.js';

const SKILL_FILES = {
  'SKILL.md': `---
name: hush-secrets
description: Manage secrets safely using Hush CLI. Use when working with .env files, environment variables, secrets, API keys, database URLs, credentials, or configuration. NEVER read .env files directly - always use hush commands instead to prevent exposing secrets to the LLM.
allowed-tools: Bash(hush:*), Bash(npx hush:*), Bash(brew:*), Bash(npm:*), Bash(pnpm:*), Bash(age-keygen:*), Read, Grep, Glob, Write, Bash(cat:*), Bash(grep:*)
---

# Hush - AI-Native Secrets Management

**CRITICAL: NEVER read .env files directly.** Always use \`npx hush status\`, \`npx hush inspect\`, or \`npx hush has\` to check secrets.

Hush keeps secrets **encrypted at rest**. When properly set up, all secrets are stored in \`.env.encrypted\` files and plaintext \`.env\` files should NOT exist.

## First Step: Investigate Current State

**ALWAYS run this first when working with a new repo:**

\`\`\`bash
npx hush status
\`\`\`

This tells you:
- Whether Hush is configured (\`hush.yaml\` exists)
- If SOPS/age are installed
- If encryption keys are set up
- **CRITICAL: If unencrypted .env files exist (security risk!)**
- What source files are configured

### Interpreting Status Output

| You See | What It Means | Action |
|---------|---------------|--------|
| \`SECURITY WARNING: Unencrypted .env files\` | Plaintext secrets exist! | Run \`npx hush encrypt\` immediately |
| \`No hush.yaml found\` | Hush not initialized | Run \`npx hush init\` |
| \`SOPS not installed\` | Missing prerequisite | \`brew install sops\` |
| \`age key not found\` | Missing encryption key | \`npx hush keys setup\` |
| \`Project: not set\` | Key management limited | Add \`project:\` to hush.yaml |
| \`1Password backup: not synced\` | Key not backed up | \`npx hush keys push\` |

## Decision Tree: What Do I Do?

### Scenario 1: Fresh Repo (No Hush Setup)

\`\`\`bash
npx hush init          # Creates hush.yaml and .sops.yaml
npx hush encrypt       # Encrypts any existing .env files, deletes plaintext
npx hush inspect       # Verify setup
\`\`\`

### Scenario 2: Existing .env Files Found

\`\`\`bash
npx hush status        # Check what's there
npx hush encrypt       # Encrypt them (auto-deletes plaintext after verification)
npx hush inspect       # Confirm everything is encrypted
\`\`\`

### Scenario 3: Hush Already Set Up (Team Member Joining)

\`\`\`bash
npx hush keys setup    # Pull key from 1Password or prompt for setup
npx hush status        # Verify everything works
npx hush inspect       # See what secrets exist
\`\`\`

### Scenario 4: Need to Add/Modify Secrets

\`\`\`bash
npx hush set <KEY>         # Add interactively (you invoke, user types value)
npx hush edit              # Edit all secrets in $EDITOR
npx hush inspect           # Verify changes
\`\`\`

### Scenario 5: Run Application with Secrets

\`\`\`bash
npx hush run -- npm start              # Development
npx hush run -e production -- npm build   # Production
\`\`\`

---

## Commands Quick Reference

| Command | Purpose | When to Use |
|---------|---------|-------------|
| \`npx hush status\` | **Full diagnostic** | First step, always |
| \`npx hush inspect\` | See variables (masked) | Check what's configured |
| \`npx hush has <KEY>\` | Check specific variable | Verify a secret exists |
| \`npx hush set <KEY>\` | Add secret interactively | User needs to enter a value |
| \`npx hush edit\` | Edit all secrets | Bulk editing |
| \`npx hush run -- <cmd>\` | Run with secrets in memory | Actually use the secrets |
| \`npx hush init\` | Initialize Hush | First-time setup |
| \`npx hush encrypt\` | Encrypt .env files | After creating/modifying plaintext |
| \`npx hush keys setup\` | Set up encryption keys | New team member |

### Commands to AVOID:
- \`hush decrypt\` - Writes plaintext to disk (security risk!)
- \`cat .env\` - Never read plaintext .env files directly

---

## Running Programs with Secrets

**This is the primary way to use secrets - they never touch disk!**

\`\`\`bash
npx hush run -- npm start              # Run with development secrets
npx hush run -e production -- npm build   # Run with production secrets
npx hush run -t api -- wrangler dev       # Run filtered for 'api' target
\`\`\`

---

## Checking Secrets

### See what variables exist

\`\`\`bash
npx hush inspect                    # Development
npx hush inspect -e production      # Production
\`\`\`

Output shows **masked values**:

\`\`\`
Secrets for development:

  DATABASE_URL      = post****************... (45 chars)
  STRIPE_SECRET_KEY = sk_t****************... (32 chars)
  API_KEY           = (not set)

Total: 3 variables
\`\`\`

### Check if a specific variable exists

\`\`\`bash
npx hush has DATABASE_URL           # Verbose output
npx hush has API_KEY -q             # Quiet: exit code only (0=set, 1=missing)
\`\`\`

---

## Adding/Modifying Secrets

### Add a single secret interactively

\`\`\`bash
npx hush set DATABASE_URL           # You invoke this, user types value
npx hush set API_KEY -e production  # Set in production secrets
npx hush set DEBUG --local          # Set personal local override
\`\`\`

The user will be prompted to enter the value (hidden input).
**You never see the actual secret - just invoke the command!**

---

## Additional Resources

- **First-time setup**: [SETUP.md](SETUP.md)
- **Command reference**: [REFERENCE.md](REFERENCE.md)
- **Workflow examples**: [examples/workflows.md](examples/workflows.md)
`,

  'SETUP.md': `# Hush First-Time Setup

This guide walks through setting up Hush from scratch. Follow these steps in order.

## Prerequisites Check

### 1. Check if SOPS and age are installed

\`\`\`bash
which sops && which age-keygen && echo "Prerequisites installed" || echo "Need to install prerequisites"
\`\`\`

If not installed:

**macOS:**
\`\`\`bash
brew install sops age
\`\`\`

**Linux (Debian/Ubuntu):**
\`\`\`bash
sudo apt install age
# SOPS: Download from https://github.com/getsops/sops/releases
wget https://github.com/getsops/sops/releases/download/v3.8.1/sops-v3.8.1.linux.amd64 -O /usr/local/bin/sops
chmod +x /usr/local/bin/sops
\`\`\`

**Windows (Chocolatey):**
\`\`\`powershell
choco install sops age
\`\`\`

### 2. Check for age encryption key

\`\`\`bash
test -f ~/.config/sops/age/key.txt && echo "Key exists" || echo "Need to create key"
\`\`\`

If no key exists, create one:

\`\`\`bash
mkdir -p ~/.config/sops/age
age-keygen -o ~/.config/sops/age/key.txt
\`\`\`

### 3. Get your public key

\`\`\`bash
grep "public key:" ~/.config/sops/age/key.txt
\`\`\`

Save this \`age1...\` value - you'll need it for the next step.

---

## Project Setup

### Step 1: Install Hush

\`\`\`bash
npm install -D @chriscode/hush
# or
pnpm add -D @chriscode/hush
\`\`\`

### Step 2: Create \`.sops.yaml\`

Create \`.sops.yaml\` in your repo root with your public key:

\`\`\`yaml
creation_rules:
  - encrypted_regex: '.*'
    age: age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
\`\`\`

Replace \`age1xxx...\` with your actual public key from the prerequisites step.

### Step 3: Initialize Hush

\`\`\`bash
npx hush init
\`\`\`

This creates \`hush.yaml\` with auto-detected targets based on your project structure.

### Step 4: Review \`hush.yaml\`

The generated config looks like:

\`\`\`yaml
sources:
  shared: .env
  development: .env.development
  production: .env.production

targets:
  - name: root
    path: .
    format: dotenv
\`\`\`

Customize targets for your monorepo. Common patterns:

**Next.js app (client vars only):**
\`\`\`yaml
- name: web
  path: ./apps/web
  format: dotenv
  include:
    - NEXT_PUBLIC_*
\`\`\`

**API server (exclude client vars):**
\`\`\`yaml
- name: api
  path: ./apps/api
  format: wrangler  # or dotenv
  exclude:
    - NEXT_PUBLIC_*
    - VITE_*
\`\`\`

**Kubernetes:**
\`\`\`yaml
- name: k8s
  path: ./k8s
  format: yaml
\`\`\`

### Step 5: Create initial \`.env\` files

Create \`.env\` with shared secrets:

\`\`\`bash
# .env
DATABASE_URL=postgres://localhost/mydb
API_KEY=your_api_key_here
NEXT_PUBLIC_API_URL=http://localhost:3000
\`\`\`

Create \`.env.development\` for dev-specific values:

\`\`\`bash
# .env.development  
DEBUG=true
LOG_LEVEL=debug
\`\`\`

Create \`.env.production\` for production values:

\`\`\`bash
# .env.production
DEBUG=false
LOG_LEVEL=error
\`\`\`

### Step 6: Encrypt secrets

\`\`\`bash
npx hush encrypt
\`\`\`

This creates:
- \`.env.encrypted\`
- \`.env.development.encrypted\`
- \`.env.production.encrypted\`

### Step 7: Verify setup

\`\`\`bash
npx hush status
npx hush inspect
\`\`\`

### Step 8: Update \`.gitignore\`

Add these lines to \`.gitignore\`:

\`\`\`gitignore
# Hush - plaintext env files (generated, not committed)
.env
.env.local
.env.development
.env.production
.dev.vars

# Keep encrypted files (these ARE committed)
!.env.encrypted
!.env.*.encrypted
\`\`\`

### Step 9: Commit encrypted files

\`\`\`bash
git add .sops.yaml hush.yaml .env*.encrypted .gitignore
git commit -m "chore: add Hush secrets management"
\`\`\`

---

## Team Member Setup

When a new team member joins:

1. **Get the age private key** from an existing team member
2. **Save it** to \`~/.config/sops/age/key.txt\`
3. **Run** \`npx hush run -- npm install\` to verify decryption works
4. **Start developing** with \`npx hush run -- npm run dev\`

The private key should be shared securely (password manager, encrypted channel, etc.)

---

## Verification Checklist

After setup, verify everything works:

- [ ] \`npx hush status\` shows configuration
- [ ] \`npx hush inspect\` shows masked variables
- [ ] \`npx hush run -- env\` can decrypt and run (secrets stay in memory!)
- [ ] \`.env.encrypted\` files are committed to git
- [ ] Plaintext \`.env\` files are in \`.gitignore\`

---

## Troubleshooting Setup

### "age: command not found"
\`\`\`bash
brew install age  # macOS
\`\`\`

### "sops: command not found"  
\`\`\`bash
brew install sops  # macOS
\`\`\`

### "Error: no matching keys found"
Your age key doesn't match. Get the correct private key from a team member.

### "hush.yaml not found"
Run \`npx hush init\` to generate configuration.

### "No sources defined in hush.yaml"
Edit \`hush.yaml\` and add your source files under \`sources:\`.
`,

  'REFERENCE.md': `# Hush Command Reference

Complete reference for all Hush CLI commands with flags, options, and examples.

## Security Model: Encrypted at Rest

All secrets are stored encrypted on disk. You can safely read any \`.env\` file—they contain only encrypted data. No special precautions needed for file reading.

## Global Options

| Option | Description |
|--------|-------------|
| \`-e, --env <env>\` | Environment: \`development\` / \`production\`. Default: \`development\` |
| \`-r, --root <dir>\` | Root directory containing \`hush.yaml\`. Default: current directory |
| \`-t, --target <name>\` | Target name from hush.yaml (for \`run\` command) |
| \`--local\` | Use local overrides (for \`set\` command) |
| \`-h, --help\` | Show help message |
| \`-v, --version\` | Show version number |

---

## Primary Commands

### hush run -- <command> ⭐

**The recommended way to run programs with secrets!**

Decrypts secrets to memory and runs a command with them as environment variables.
Secrets never touch the disk as plaintext.

\`\`\`bash
hush run -- npm start              # Run with development secrets
hush run -e production -- npm build   # Run with production secrets
hush run -t api -- wrangler dev       # Run filtered for 'api' target
\`\`\`

**Options:**
| Option | Description |
|--------|-------------|
| \`-e, --env\` | Environment (development/production) |
| \`-t, --target\` | Filter secrets for a specific target from hush.yaml |

---

### hush set <KEY> ⭐

Add or update a single secret interactively. You invoke this, user enters the value.

\`\`\`bash
hush set DATABASE_URL              # Set in shared secrets
hush set API_KEY -e production     # Set in production secrets
hush set DEBUG --local             # Set personal local override
\`\`\`

User will be prompted with hidden input - the value is never visible.

---

### hush edit [file]

Open all secrets in \`$EDITOR\` for bulk editing.

\`\`\`bash
hush edit                          # Edit shared secrets
hush edit development              # Edit development secrets
hush edit production               # Edit production secrets
hush edit local                    # Edit personal local overrides
\`\`\`

---

### hush inspect

List all variables with **masked values** (human-readable format).

\`\`\`bash
hush inspect                       # Development
hush inspect -e production         # Production
\`\`\`

---

### hush has <KEY>

Check if a specific secret exists.

\`\`\`bash
hush has DATABASE_URL              # Verbose output
hush has API_KEY -q                # Quiet: exit code only (0=set, 1=missing)
\`\`\`

---

## Setup Commands

### hush init

Generate \`hush.yaml\` configuration with auto-detected targets.

\`\`\`bash
hush init
\`\`\`

---

### hush encrypt

Encrypt source \`.env\` files to \`.env.encrypted\` files.

\`\`\`bash
hush encrypt
\`\`\`

---

### hush status

Show configuration and file status.

\`\`\`bash
hush status
\`\`\`

---

## Deployment Commands

### hush push

Push production secrets to Cloudflare Workers.

\`\`\`bash
hush push                          # Push secrets
hush push --dry-run                # Preview without pushing
\`\`\`

---

## Deprecated Commands (Avoid)

### hush decrypt / hush unsafe:decrypt ⚠️

**DEPRECATED:** Writes unencrypted secrets to disk, defeating the "encrypted at rest" model.

\`\`\`bash
hush decrypt                       # Writes plaintext .env files (avoid!)
hush unsafe:decrypt                # Same, explicit unsafe mode
\`\`\`

Use \`hush run -- <command>\` instead.

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| \`hush run -- <cmd>\` | Run with secrets (memory only) |
| \`hush set <KEY>\` | Add secret interactively |
| \`hush edit\` | Edit secrets in $EDITOR |
| \`hush inspect\` | See variables (masked) |
| \`hush has <KEY>\` | Check if variable exists |
| \`hush status\` | View configuration |
| \`cat .env.encrypted\` | Read encrypted file (safe!) |

---

### hush inspect (AI-Safe)

List all variables with **masked values**. Safe for AI agents.

\`\`\`bash
hush inspect                    # Development
hush inspect -e production      # Production
\`\`\`

**Output format:**
\`\`\`
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
\`\`\`

**What's visible:**
- Variable names
- First 4 characters (helps identify type: \`sk_\` = Stripe, \`ghp_\` = GitHub)
- Value length
- Which targets receive which variables

---

### hush has (AI-Safe)

Check if a specific secret exists.

\`\`\`bash
hush has <KEY>                  # Verbose output
hush has <KEY> -q               # Quiet mode (exit code only)
hush has <KEY> --quiet          # Same as -q
\`\`\`

**Exit codes:**
- \`0\` - Variable is set
- \`1\` - Variable not found

**Examples:**
\`\`\`bash
# Check with output
hush has DATABASE_URL
# Output: DATABASE_URL is set (45 chars)

# Check missing variable
hush has MISSING_KEY
# Output: MISSING_KEY not found
# Exit code: 1

# Use in scripts
hush has DATABASE_URL -q && echo "DB ready"

# Check multiple
hush has DB_URL -q && hush has API_KEY -q && echo "All set"
\`\`\`

---

### hush push

Push production secrets to Cloudflare Workers.

\`\`\`bash
hush push                       # Push secrets
hush push --dry-run             # Preview without pushing
\`\`\`

**Options:**

| Option | Description |
|--------|-------------|
| \`--dry-run\` | Preview what would be pushed, don't actually push |

**Requirements:**
- Target must have \`format: wrangler\`
- \`wrangler.toml\` must exist in target path
- \`wrangler\` CLI must be installed and authenticated

---

### hush status

Show configuration and file status.

\`\`\`bash
hush status
\`\`\`

**Output includes:**
- Configuration file location
- Source files and their encryption status
- Target configuration (paths, formats, filters)
- Whether files are in sync

---

### hush check

Verify secrets are encrypted (useful for pre-commit hooks).

\`\`\`bash
hush check                      # Basic check
hush check --warn               # Warn but don't fail
hush check --json               # JSON output for CI
hush check --only-changed       # Only check git-modified files
hush check --require-source     # Fail if source file missing
\`\`\`

**Exit codes:**
- \`0\` - All in sync
- \`1\` - Drift detected (run \`hush encrypt\`)
- \`2\` - Config error
- \`3\` - Runtime error (sops missing, decrypt failed)

**Pre-commit hook (Husky):**
\`\`\`bash
# .husky/pre-commit
npx hush check || exit 1
\`\`\`

Bypass with: \`HUSH_SKIP_CHECK=1 git commit -m "message"\`

---

### hush skill

Install the Claude Code / OpenCode skill for AI-safe secrets management.

\`\`\`bash
hush skill                      # Interactive: choose global or local
hush skill --global             # Install to ~/.claude/skills/
hush skill --local              # Install to ./.claude/skills/
\`\`\`

**Global install:** Works across all your projects. Recommended for personal use.

**Local install:** Bundled with the project. Recommended for teams (skill travels with the repo).

## Configuration File (hush.yaml)

\`\`\`yaml
sources:
  shared: .env
  development: .env.development
  production: .env.production

targets:
  - name: root
    path: .
    format: dotenv

  - name: app
    path: ./packages/app
    format: dotenv
    include:
      - EXPO_PUBLIC_*
      - NEXT_PUBLIC_*

  - name: api
    path: ./packages/api
    format: wrangler
    exclude:
      - EXPO_PUBLIC_*
\`\`\`

### Target Options

| Option | Description |
|--------|-------------|
| \`name\` | Identifier for the target |
| \`path\` | Directory to write output file |
| \`format\` | Output format: \`dotenv\`, \`wrangler\`, \`json\`, \`shell\`, \`yaml\` |
| \`include\` | Glob patterns to include (e.g., \`NEXT_PUBLIC_*\`) |
| \`exclude\` | Glob patterns to exclude |

### Output Formats

| Format | Output File | Use Case |
|--------|-------------|----------|
| \`dotenv\` | \`.env.development\` / \`.env.production\` | Next.js, Vite, Expo, Remix, Node.js |
| \`wrangler\` | \`.dev.vars\` | Cloudflare Workers & Pages |
| \`json\` | \`.env.development.json\` | AWS Lambda, serverless, JSON configs |
| \`shell\` | \`.env.development.sh\` | CI/CD pipelines, Docker builds |
| \`yaml\` | \`.env.development.yaml\` | Kubernetes ConfigMaps, Docker Compose |

### Framework Client Prefixes

| Framework | Client Prefix | Example |
|-----------|--------------|---------|
| Next.js | \`NEXT_PUBLIC_*\` | \`include: [NEXT_PUBLIC_*]\` |
| Vite | \`VITE_*\` | \`include: [VITE_*]\` |
| Create React App | \`REACT_APP_*\` | \`include: [REACT_APP_*]\` |
| Vue CLI | \`VUE_APP_*\` | \`include: [VUE_APP_*]\` |
| Nuxt | \`NUXT_PUBLIC_*\` | \`include: [NUXT_PUBLIC_*]\` |
| Astro | \`PUBLIC_*\` | \`include: [PUBLIC_*]\` |
| SvelteKit | \`PUBLIC_*\` | \`include: [PUBLIC_*]\` |
| Expo | \`EXPO_PUBLIC_*\` | \`include: [EXPO_PUBLIC_*]\` |
| Gatsby | \`GATSBY_*\` | \`include: [GATSBY_*]\` |
`,

  'examples/workflows.md': `# Hush Workflow Examples

Step-by-step examples for common workflows when working with secrets.

**CRITICAL: NEVER read .env files directly. Use hush commands instead.**

---

## First-Time Setup (Most Important!)

### "Help me set up Hush for this project"

**Step 1: Check current state**
\`\`\`bash
npx hush status
\`\`\`

This will show:
- If Hush is already configured
- If there are unencrypted .env files (security risk!)
- What prerequisites are missing

**Step 2: Based on the output, follow the appropriate path:**

#### Path A: "SECURITY WARNING: Unencrypted .env files detected"
\`\`\`bash
npx hush init          # If no hush.yaml exists
npx hush encrypt       # Encrypts files and DELETES plaintext automatically
npx hush status        # Verify the warning is gone
\`\`\`

#### Path B: "No hush.yaml found"
\`\`\`bash
npx hush init          # Creates config and sets up keys
npx hush set <KEY>     # Add secrets (if none exist yet)
\`\`\`

#### Path C: "age key not found"
\`\`\`bash
npx hush keys setup    # Pull from 1Password or generate new key
\`\`\`

#### Path D: Everything looks good
\`\`\`bash
npx hush inspect       # See what secrets are configured
\`\`\`

---

## Running Programs (Most Common)

### "Start the development server"
\`\`\`bash
npx hush run -- npm run dev
\`\`\`

### "Build for production"
\`\`\`bash
npx hush run -e production -- npm run build
\`\`\`

### "Run tests with secrets"
\`\`\`bash
npx hush run -- npm test
\`\`\`

### "Run Wrangler for Cloudflare Worker"
\`\`\`bash
npx hush run -t api -- wrangler dev
\`\`\`

---

## Checking Secrets

### "What environment variables does this project use?"
\`\`\`bash
npx hush inspect       # Shows all variables with masked values
\`\`\`

### "Is the database configured?"
\`\`\`bash
npx hush has DATABASE_URL
\`\`\`

If "not found", help user add it:
\`\`\`bash
npx hush set DATABASE_URL
\`\`\`
Tell user: "Enter your database URL when prompted"

### "Check all required secrets"
\`\`\`bash
npx hush has DATABASE_URL -q && \\
npx hush has API_KEY -q && \\
echo "All configured" || \\
echo "Some missing"
\`\`\`

---

## Adding Secrets

### "Help me add DATABASE_URL"
\`\`\`bash
npx hush set DATABASE_URL
\`\`\`
Tell user: "Enter your database URL when prompted (input will be hidden)"

### "Add a production-only secret"
\`\`\`bash
npx hush set STRIPE_SECRET_KEY -e production
\`\`\`

### "Add a personal local override"
\`\`\`bash
npx hush set DEBUG --local
\`\`\`

### "Edit multiple secrets at once"
\`\`\`bash
npx hush edit
\`\`\`
Tell user: "Your editor will open. Add or modify secrets, then save and close."

---

## Debugging

### "My app can't find DATABASE_URL"

1. Check if it exists:
   \`\`\`bash
   npx hush has DATABASE_URL
   \`\`\`

2. Check target distribution:
   \`\`\`bash
   npx hush inspect
   \`\`\`

3. Check hush.yaml for filtering:
   \`\`\`bash
   cat hush.yaml        # Safe - this is config, not secrets
   \`\`\`

4. Try running directly:
   \`\`\`bash
   npx hush run -- env | grep DATABASE
   \`\`\`

---

## Team Workflows

### "New team member setup"

Guide them through these steps:
\`\`\`bash
# 1. Pull key from 1Password (or get from team member)
npx hush keys setup

# 2. Verify setup
npx hush status

# 3. Check secrets are accessible
npx hush inspect

# 4. Start developing
npx hush run -- npm run dev
\`\`\`

### "Someone added new secrets"
\`\`\`bash
git pull
npx hush inspect   # See what's new
\`\`\`

---

## Deployment

### "Push to Cloudflare Workers"
\`\`\`bash
npx hush push --dry-run   # Preview first
npx hush push             # Actually push
\`\`\`

### "Build and deploy"
\`\`\`bash
npx hush run -e production -- npm run build
npx hush push
\`\`\`

---

## Understanding the Output

### npx hush status output explained

\`\`\`
SECURITY WARNING
Unencrypted .env files detected!
  .env
  .env.development

Config:
  hush.yaml
  Project: my-org/my-repo

Prerequisites:
  SOPS installed
  age key configured

Key Status:
  Local key: ~/.config/sops/age/keys/my-org-my-repo.txt
  1Password backup: synced
\`\`\`

**Reading this:**
- There's a security issue - plaintext files exist
- The project is configured with key management
- Keys are properly set up and backed up

**To fix:** Run \`npx hush encrypt\`

### npx hush inspect output explained

\`\`\`
Secrets for development:

  DATABASE_URL      = post****************... (45 chars)
  STRIPE_SECRET_KEY = sk_t****************... (32 chars)
  API_KEY           = (not set)

Total: 3 variables
\`\`\`

**Reading this:**
- \`DATABASE_URL\` is set, starts with "post", is 45 characters (likely a postgres:// URL)
- \`STRIPE_SECRET_KEY\` starts with "sk_t" (Stripe test key format)
- \`API_KEY\` is not set - user needs to add it
`,
};

type InstallLocation = 'global' | 'local';

function getSkillPath(location: InstallLocation, root: string): string {
  if (location === 'global') {
    return join(homedir(), '.claude', 'skills', 'hush-secrets');
  }
  return join(root, '.claude', 'skills', 'hush-secrets');
}

async function promptForLocation(): Promise<InstallLocation> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log(pc.bold('\nWhere would you like to install the Claude skill?\n'));
    console.log(`  ${pc.cyan('1)')} ${pc.bold('Global')} ${pc.dim('(~/.claude/skills/)')}`);
    console.log(`     Works across all your projects. Recommended for personal use.\n`);
    console.log(`  ${pc.cyan('2)')} ${pc.bold('Local')} ${pc.dim('(.claude/skills/)')}`);
    console.log(`     Bundled with this project. Recommended for teams.\n`);

    rl.question(`${pc.bold('Choice')} ${pc.dim('[1/2]')}: `, (answer) => {
      rl.close();
      const choice = answer.trim();
      if (choice === '2' || choice.toLowerCase() === 'local') {
        resolve('local');
      } else {
        resolve('global');
      }
    });
  });
}

function writeSkillFiles(skillPath: string): void {
  mkdirSync(skillPath, { recursive: true });
  mkdirSync(join(skillPath, 'examples'), { recursive: true });

  for (const [filename, content] of Object.entries(SKILL_FILES)) {
    const filePath = join(skillPath, filename);
    writeFileSync(filePath, content, 'utf-8');
  }
}

export async function skillCommand(options: SkillOptions): Promise<void> {
  const { root, global: isGlobal, local: isLocal } = options;

  let location: InstallLocation;

  if (isGlobal) {
    location = 'global';
  } else if (isLocal) {
    location = 'local';
  } else {
    location = await promptForLocation();
  }

  const skillPath = getSkillPath(location, root);

  const alreadyInstalled = existsSync(join(skillPath, 'SKILL.md'));
  if (alreadyInstalled) {
    console.log(pc.yellow(`\nSkill already installed at: ${skillPath}`));
    console.log(pc.dim('To reinstall, delete the directory first.\n'));
    return;
  }

  console.log(pc.blue(`\nInstalling Claude skill to: ${skillPath}`));

  writeSkillFiles(skillPath);

  console.log(pc.green('\n✓ Skill installed successfully!\n'));

  if (location === 'global') {
    console.log(pc.dim('The skill is now active for all projects using Claude Code.\n'));
  } else {
    console.log(pc.dim('The skill is now bundled with this project.'));
    console.log(pc.dim('Commit the .claude/ directory to share with your team.\n'));
    console.log(pc.bold('Suggested:'));
    console.log(`  git add .claude/`);
    console.log(`  git commit -m "chore: add Hush Claude skill"\n`);
  }

  console.log(pc.bold('What the skill does:'));
  console.log(`  • Teaches AI to use ${pc.cyan('hush inspect')} instead of reading .env files`);
  console.log(`  • Prevents accidental exposure of secrets to LLMs`);
  console.log(`  • Guides AI through adding/modifying secrets safely\n`);
}
