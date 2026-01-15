import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import { join } from 'node:path';
import pc from 'picocolors';
import type { SkillOptions } from '../types.js';

const SKILL_FILES = {
  'SKILL.md': `---
name: hush-secrets
description: Manage secrets safely using Hush CLI. Use when working with .env files, environment variables, secrets, API keys, database URLs, credentials, or configuration. Secrets are always encrypted at rest - .env files contain only encrypted data.
allowed-tools: Bash(hush:*), Bash(npx hush:*), Bash(brew:*), Bash(npm:*), Bash(pnpm:*), Bash(age-keygen:*), Read, Grep, Glob, Write, Bash(cat:*), Bash(grep:*)
---

# Hush - AI-Native Secrets Management

Hush keeps secrets **encrypted at rest**. All \`.env\` files contain encrypted data only—you can freely read them with \`cat\` or \`grep\` and you'll only see encrypted gibberish, never actual secrets.

## How It Works

Secrets are stored encrypted on disk. When you need to use them:
- \`hush run -- <command>\` decrypts to memory and runs your command
- \`hush set <KEY>\` adds secrets interactively (you invoke, user enters value)
- \`hush inspect\` shows what exists with masked values
- \`hush edit\` opens encrypted file in editor, re-encrypts on save

## Safe to Read (Always Encrypted)

You CAN freely read these files—they only contain encrypted data:
- \`.env.encrypted\`, \`.env.*.encrypted\` - encrypted secrets
- \`.env\`, \`.env.*\` - if they exist, they're encrypted too (Hush doesn't create plaintext files)

Feel free to use \`cat\`, \`grep\`, \`Read\` on any \`.env\` file. You'll see encrypted content like:
\`\`\`
DATABASE_URL=ENC[AES256_GCM,data:abc123...,type:str]
\`\`\`

## Commands Reference

### Primary Commands:
- \`npx hush run -- <command>\` - Run programs with secrets (decrypts to memory only!)
- \`npx hush set <KEY>\` - Add a secret interactively (you invoke, user enters value)
- \`npx hush edit\` - Let user edit all secrets in $EDITOR
- \`npx hush inspect\` - See what variables exist (values are masked)
- \`npx hush has <KEY>\` - Check if a specific variable is set
- \`npx hush status\` - View configuration

### Avoid These (Deprecated):
- \`hush decrypt\` / \`hush unsafe:decrypt\` - Writes unencrypted secrets to disk (defeats the purpose!)

## Quick Check: Is Hush Set Up?

\`\`\`bash
npx hush status
\`\`\`

**If this fails**, see [SETUP.md](SETUP.md) for first-time setup instructions.

---

## Running Programs with Secrets

**This is the primary way to use secrets - they never touch disk!**

\`\`\`bash
npx hush run -- npm start              # Run with development secrets
npx hush run -e production -- npm build   # Run with production secrets
npx hush run -t api -- wrangler dev       # Run filtered for 'api' target
\`\`\`

The secrets are decrypted to memory and injected as environment variables.
The child process inherits them. No plaintext files are written.

---

## Checking Secrets

### See what variables exist (human-readable)

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

### Read encrypted files directly

You can also just read the encrypted files:
\`\`\`bash
cat .env.encrypted                  # See encrypted content (safe!)
grep DATABASE .env.encrypted        # Search for keys in encrypted file
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
You never see the actual secret - just invoke the command!

### Edit all secrets in editor

\`\`\`bash
npx hush edit                       # Edit shared secrets
npx hush edit development           # Edit development secrets
npx hush edit local                 # Edit personal overrides
\`\`\`

---

## Common Workflows

### "Help user add DATABASE_URL"
\`\`\`bash
npx hush set DATABASE_URL
\`\`\`
Tell user: "Enter your database URL when prompted"

### "Check all required secrets"
\`\`\`bash
npx hush has DATABASE_URL -q && npx hush has API_KEY -q && echo "All configured" || echo "Some missing"
\`\`\`

### "Run the development server"
\`\`\`bash
npx hush run -- npm run dev
\`\`\`

### "Build for production"
\`\`\`bash
npx hush run -e production -- npm run build
\`\`\`

### "See what's in the encrypted file"
\`\`\`bash
cat .env.encrypted                  # Safe! Shows encrypted data only
\`\`\`

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

**Remember:** All \`.env\` files are encrypted at rest. You can freely read them with \`cat\` or \`grep\`—you'll only see encrypted data, never actual secrets.

## Running Programs (Most Common)

### "Start the development server"

\`\`\`bash
hush run -- npm run dev
\`\`\`

### "Build for production"

\`\`\`bash
hush run -e production -- npm run build
\`\`\`

### "Run tests with secrets"

\`\`\`bash
hush run -- npm test
\`\`\`

### "Run Wrangler for Cloudflare Worker"

\`\`\`bash
hush run -t api -- wrangler dev
\`\`\`

---

## Checking Secrets

### "What environment variables does this project use?"

\`\`\`bash
hush inspect                    # Human-readable masked output
# or
cat .env.encrypted              # Raw encrypted file (safe!)
\`\`\`

### "Is the database configured?"

\`\`\`bash
hush has DATABASE_URL
\`\`\`

If "not found", help user add it with \`hush set DATABASE_URL\`.

### "Check all required secrets"

\`\`\`bash
hush has DATABASE_URL -q && \\
hush has API_KEY -q && \\
echo "All configured" || \\
echo "Some missing"
\`\`\`

### "Search for a key in encrypted files"

\`\`\`bash
grep DATABASE .env.encrypted    # Safe! Shows encrypted line
\`\`\`

---

## Adding Secrets

### "Help me add DATABASE_URL"

\`\`\`bash
hush set DATABASE_URL
\`\`\`

Tell user: "Enter your database URL when prompted (input will be hidden)"

### "Add a production-only secret"

\`\`\`bash
hush set STRIPE_SECRET_KEY -e production
\`\`\`

### "Add a personal local override"

\`\`\`bash
hush set DEBUG --local
\`\`\`

### "Edit multiple secrets at once"

\`\`\`bash
hush edit
\`\`\`

Tell user: "Your editor will open. Add or modify secrets, then save and close."

---

## Debugging

### "My app can't find DATABASE_URL"

1. Check if it exists:
   \`\`\`bash
   hush has DATABASE_URL
   \`\`\`

2. Check target distribution:
   \`\`\`bash
   hush inspect
   \`\`\`

3. Check hush.yaml for filtering:
   \`\`\`bash
   cat hush.yaml
   \`\`\`

4. Look at the encrypted file:
   \`\`\`bash
   grep DATABASE .env.encrypted    # Safe to read!
   \`\`\`

5. Try running directly:
   \`\`\`bash
   hush run -- env | grep DATABASE
   \`\`\`

---

## Team Workflows

### "New team member setup"

Guide them:
> 1. Get the age private key from a team member
> 2. Save it to \`~/.config/sops/age/key.txt\`
> 3. Run \`hush run -- npm install\` to verify setup
> 4. Start developing with \`hush run -- npm run dev\`

### "Someone added new secrets"

\`\`\`bash
git pull
hush inspect   # See what's new
\`\`\`

---

## Deployment

### "Push to Cloudflare Workers"

\`\`\`bash
hush push --dry-run   # Preview first
hush push             # Actually push
\`\`\`

### "Build and deploy"

\`\`\`bash
hush run -e production -- npm run build
hush push
\`\`\`

---

## Understanding the Output

### hush inspect output explained

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

**Reading this:**
- \`DATABASE_URL\` is set, starts with "post", is 45 characters (likely a postgres:// URL)
- \`STRIPE_SECRET_KEY\` starts with "sk_t" (Stripe test key format)
- \`API_KEY\` is not set - user needs to add it
- The \`app\` folder only gets \`EXPO_PUBLIC_*\` variables
- The \`api\` folder gets everything except \`EXPO_PUBLIC_*\`

### Reading encrypted files directly

\`\`\`bash
$ cat .env.encrypted
DATABASE_URL=ENC[AES256_GCM,data:7xH2kL9...,iv:abc...,tag:xyz...,type:str]
STRIPE_SECRET_KEY=ENC[AES256_GCM,data:mN3pQ8...,iv:def...,tag:uvw...,type:str]
\`\`\`

This is safe to view—the actual values are encrypted. You can see what keys exist without exposing secrets.
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
