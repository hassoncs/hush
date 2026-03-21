import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import pc from 'picocolors';
import type { HushContext, SkillOptions } from '../types.js';

const SKILL_FILES = {
  'SKILL.md': `---
name: hush-secrets
description: Manage secrets safely using Hush CLI. Use when working with .hush files, environment variables, secrets, API keys, database URLs, credentials, or configuration. NEVER read .hush files directly - always use hush commands instead to prevent exposing secrets to the LLM.
allowed-tools: Bash(hush:*), Bash(npx hush:*), Bash(brew:*), Bash(npm:*), Bash(pnpm:*), Bash(age-keygen:*), Read, Grep, Glob, Write, Bash(cat:*), Bash(grep:*)
---

# Hush - AI-Native Secrets Management

**CRITICAL: NEVER read .hush files directly.** Always use \`npx hush status\`, \`npx hush inspect\`, or \`npx hush has\` to check secrets.

Hush keeps secrets **encrypted at rest** at the project root using \`.hush.encrypted\` files. Subdirectory \`.hush\` files are **templates** (safe to commit) that reference root secrets via \`\${VAR}\` syntax.

## First Step: Investigate Current State

**ALWAYS run this first when working with a new repo:**

\`\`\`bash
npx hush status
\`\`\`

This tells you:
- Whether Hush is configured (\`hush.yaml\` exists)
- **Note: Hush uses \`hush.yaml\` in the root directory. There is NO \`.hush\` directory.**
- If SOPS/age are installed
- If encryption keys are set up
- **CRITICAL: If unencrypted .env files exist (security risk!)**
- What source files are configured

### Interpreting Status Output

| You See | What It Means | Action |
|---------|---------------|--------|
| \`SECURITY WARNING: Unencrypted .env files\` | Plaintext .env files found (legacy or output) | Run \`npx hush migrate\` or delete them |
| \`No hush.yaml found\` | Hush not initialized | Run \`npx hush init\` |
| \`SOPS not installed\` | Missing prerequisite | \`brew install sops\` |
| \`age key not found\` | Missing encryption key | \`npx hush keys setup\` |
| \`age key configured\` but decrypt fails | direnv not loaded | Run \`direnv allow\` in project directory |
| \`Project: not set\` | Key management limited | Add \`project:\` to hush.yaml |

**Note:** Any \`.env\` file is suspect - Hush uses \`.hush\` files everywhere. Subdirectory \`.hush\` files are templates (safe to commit).

## Decision Tree: What Do I Do?

### Scenario 1: Fresh Repo (No Hush Setup)

\`\`\`bash
npx hush init          # Creates hush.yaml and .sops.yaml
npx hush encrypt       # Encrypts any existing .env files, deletes plaintext
npx hush inspect       # Verify setup
\`\`\`

### Scenario 2: Existing .env Files Found (Migration from v4)

\`\`\`bash
npx hush status        # Check what's there
npx hush migrate       # Migrate .env.encrypted to .hush.encrypted
npx hush inspect       # Confirm everything is migrated
\`\`\`

### Scenario 3: Hush Already Set Up (Team Member Joining)

\`\`\`bash
npx hush keys setup    # Pull key from 1Password or prompt for setup
npx hush status        # Verify everything works
npx hush inspect       # See what secrets exist
\`\`\`

### Scenario 4: Need to Add/Modify Secrets

\`\`\`bash
npx hush set <KEY> <VALUE> # Add inline (key and value provided)
npx hush set <KEY>         # Add interactively (prompts for value)
npx hush edit              # Edit all secrets in $EDITOR
npx hush inspect           # Verify changes
\`\`\`

### Scenario 5: Run Application with Secrets

\`\`\`bash
npx hush run -- npm start              # Development
npx hush run -e production -- npm build   # Production
\`\`\`

---

## Monorepo Architecture: Push vs Pull

Hush supports two ways to distribute secrets in monorepos. **Choose based on the use case:**

| Need | Use | Example |
|------|-----|---------|
| Pattern-based filtering | **Push** | "All \`NEXT_PUBLIC_*\` vars → web app" |
| Auto-flow new vars | **Push** | Add var at root, it flows automatically |
| Rename variables | **Pull** | \`API_URL\` → \`EXPO_PUBLIC_API_URL\` |
| Default values | **Pull** | \`PORT=\${PORT:-3000}\` |
| Combine variables | **Pull** | \`URL=\${HOST}:\${PORT}\` |

### Push (include/exclude in hush.yaml)

Best for simple filtering where new vars should auto-flow:

\`\`\`yaml
# hush.yaml
targets:
  - name: web
    path: ./apps/web
    include: [NEXT_PUBLIC_*]  # All matching vars auto-flow
\`\`\`

### Pull (subdirectory .hush templates)

Best for transformation, renaming, or explicit dependencies:

\`\`\`bash
# apps/mobile/.hush (committed - it's just a template)
EXPO_PUBLIC_API_URL=\${API_URL}     # Rename from root
PORT=\${PORT:-8081}                  # Default value
\`\`\`

**Decision rule:** Use push for "all X goes to Y" patterns. Use pull when you need to rename, transform, or add defaults.

---

## Subdirectory Templates (Pull-Based)

When a subdirectory needs to rename, transform, or add defaults to root secrets, create a \`.hush\` template file in that subdirectory.

### Step-by-Step Setup

**1. Ensure root secrets exist:**
\`\`\`bash
npx hush inspect   # From repo root - verify secrets are configured
\`\`\`

**2. Create subdirectory template (this file is committed to git):**
\`\`\`bash
# apps/mobile/.hush
EXPO_PUBLIC_API_URL=\${API_URL}           # Pull API_URL from root, rename it
EXPO_PUBLIC_STRIPE_KEY=\${STRIPE_KEY}     # Pull and rename
PORT=\${PORT:-8081}                        # Use root PORT, or default to 8081
DEBUG=\${DEBUG:-false}                     # Use root DEBUG, or default to false
\`\`\`

**3. Run from the subdirectory:**
\`\`\`bash
cd apps/mobile
npx hush run -- npm start
\`\`\`

Hush automatically:
1. Finds the project root (where \`hush.yaml\` is)
2. Decrypts root secrets
3. Loads the local \`.hush\` template
4. Resolves \`\${VAR}\` references against root secrets
5. **Filters root secrets based on target config (include/exclude)**
6. **Merges them (Template overrides Target)**
7. Injects the result into your command

### Variable Expansion Syntax

| Syntax | Meaning | Example |
|--------|---------|---------|
| \`\${VAR}\` | Pull VAR from root secrets | \`API_URL=\${API_URL}\` |
| \`\${VAR:-default}\` | Pull VAR, use default if missing/empty | \`PORT=\${PORT:-3000}\` |
| \`\${env:VAR}\` | Read from system environment (CI, etc.) | \`CI=\${env:CI}\` |

### Common Patterns

**Expo/React Native app:**
\`\`\`bash
# apps/mobile/.hush
EXPO_PUBLIC_API_URL=\${API_URL}
EXPO_PUBLIC_STRIPE_KEY=\${STRIPE_PUBLISHABLE_KEY}
EXPO_PUBLIC_ENV=\${ENV:-development}
\`\`\`

**Next.js app:**
\`\`\`bash
# apps/web/.hush
NEXT_PUBLIC_API_URL=\${API_URL}
NEXT_PUBLIC_STRIPE_KEY=\${STRIPE_PUBLISHABLE_KEY}
DATABASE_URL=\${DATABASE_URL}
\`\`\`

**API server with defaults:**
\`\`\`bash
# apps/api/.hush
DATABASE_URL=\${DATABASE_URL}
PORT=\${PORT:-8787}
LOG_LEVEL=\${LOG_LEVEL:-info}
\`\`\`

### Important Notes: File Conventions

**All Hush files use \`.hush\` extension - never \`.env\`:**

| Location | File Type | Contains | Committed? |
|----------|-----------|----------|------------|
| **Root** | \`.hush\` | Actual secrets | NO (gitignored) |
| **Root** | \`.hush.encrypted\` | Encrypted secrets | YES |
| **Subdirectory** | \`.hush\` | Templates with \`\${VAR}\` | YES (safe) |
| **Subdirectory** | \`.hush.development\` | Dev-specific templates | YES (safe) |
| **Anywhere** | \`.env\` | ⚠️ LEGACY - delete! | NO |

**Key rules:**
- **Everything is \`.hush\`** - consistent naming throughout
- **Any \`.env\` file is wrong** - legacy file that should be deleted
- Subdirectory \`.hush\` templates are safe to commit (no actual secrets)
- **Run from the subdirectory** - \`hush run\` auto-detects the project root
- **Self-reference works** - \`PORT=\${PORT:-3000}\` uses root PORT if set, else 3000

---

## Commands Quick Reference

| Command | Purpose | When to Use |
|---------|---------|-------------|
| \`npx hush status\` | **Full diagnostic** | First step, always |
| \`npx hush inspect\` | See variables (masked) | Check what's configured |
| \`npx hush has <KEY>\` | Check specific variable | Verify a secret exists |
| \`npx hush set <KEY> [VALUE]\` | Add secret (prompts if no value) | User needs to set a value |
| \`npx hush edit\` | Edit all secrets | Bulk editing |
| \`npx hush run -- <cmd>\` | Run with secrets in memory | Actually use the secrets |
| \`npx hush init\` | Initialize Hush | First-time setup |
| \`npx hush encrypt\` | Encrypt .env files | After creating/modifying plaintext |
| \`npx hush keys setup\` | Set up encryption keys | New team member |

### Commands to AVOID:
- \`cat .env\` - Never read plaintext .env files directly
- \`hush list\` - Shows actual secret values (use \`hush inspect\` instead)
- \`hush decrypt --force\` - Writes plaintext to disk (use \`hush run\` instead)

---

## Debugging Secret Issues

When a variable is missing or not appearing where expected, use these commands:

### Why is my variable missing from a target?

\`\`\`bash
npx hush resolve <target>           # See what variables a target receives
npx hush resolve api-workers        # Example: check api-workers target
npx hush resolve api-workers -e prod   # Check with production env
\`\`\`

This shows:
- ✅ **Included variables** - what the target will receive
- 🚫 **Excluded variables** - what was filtered out and WHY (which pattern matched)

### Where does a specific variable go?

\`\`\`bash
npx hush trace <KEY>                # Trace a variable through all targets
npx hush trace DATABASE_URL         # Example: trace DATABASE_URL
\`\`\`

This shows:
- Which source files contain the variable
- Which targets include/exclude it and why

### Preview what would be pushed

\`\`\`bash
npx hush push --dry-run --verbose   # See exactly what would be pushed
\`\`\`

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

### Add a single secret (three methods)

**Method 1: Inline value (recommended for AI agents)**
\`\`\`bash
npx hush set DATABASE_URL "postgres://user:pass@host/db"
npx hush set STRIPE_KEY "sk_live_xxx" -e production
\`\`\`

**Method 2: Interactive prompt (for users)**
\`\`\`bash
npx hush set DATABASE_URL           # Prompts user for value
npx hush set API_KEY -e production  # Set in production secrets
npx hush set DEBUG --local          # Set personal local override
\`\`\`

**Method 3: Pipe (for scripts/automation)**
\`\`\`bash
echo "my-secret-value" | npx hush set MY_KEY
cat secret.txt | npx hush set CERT_CONTENT
\`\`\`

### GUI dialog for AI agents

When running in a non-TTY environment (like AI agents), use \`--gui\`:
\`\`\`bash
npx hush set API_KEY --gui          # Opens visible dialog
\`\`\`
The dialog shows the pasted value for easy verification.

---

## Troubleshooting

### Decrypt fails with "no identity matched any of the recipients"

This is the most common issue - SOPS can't find the decryption key.

**Cause:** Hush uses per-project keys at \`~/.config/sops/age/keys/{project}.txt\`, but SOPS needs the \`SOPS_AGE_KEY_FILE\` env var to find them.

**Fix:**
\`\`\`bash
# 1. Verify the key exists
npx hush keys list

# 2. Ensure direnv is set up
brew install direnv
echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc  # or bash

# 3. Allow direnv in the project (loads .envrc)
cd /path/to/project
direnv allow

# 4. Verify
npx hush status   # Should show "age key configured"
npx hush inspect  # Should now work
\`\`\`

### Key listed but wrong project

If \`npx hush keys list\` shows a key but for the wrong project:
\`\`\`bash
npx hush keys setup   # Will pull correct key from 1Password or prompt
\`\`\`

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
  shared: .hush
  development: .hush.development
  production: .hush.production

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

### Step 5: Create initial \`.hush\` files

Create \`.hush\` with shared secrets at the **repository root**:

\`\`\`bash
# .hush (root level - contains actual secrets)
DATABASE_URL=postgres://localhost/mydb
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
STRIPE_SECRET_KEY=sk_test_xxx
API_KEY=your_api_key_here
\`\`\`

Create \`.hush.development\` for dev-specific values:

\`\`\`bash
# .hush.development  
DEBUG=true
LOG_LEVEL=debug
\`\`\`

Create \`.hush.production\` for production values:

\`\`\`bash
# .hush.production
DEBUG=false
LOG_LEVEL=error
\`\`\`

### Step 5b: Set up subdirectory templates (for monorepos)

For packages that need secrets with different prefixes, create a **template** \`.hush\` file in the subdirectory.

**Example: Expo app needs Supabase with EXPO_PUBLIC_ prefix**

\`\`\`bash
# apps/mobile/.hush (committed to git - template with variable references)
EXPO_PUBLIC_SUPABASE_URL=\${SUPABASE_URL}
EXPO_PUBLIC_SUPABASE_ANON_KEY=\${SUPABASE_ANON_KEY}
EXPO_PUBLIC_API_URL=\${API_URL:-http://localhost:3000}
\`\`\`

**Example: Next.js app needs different prefixes**

\`\`\`bash
# apps/web/.hush (committed to git - template)
NEXT_PUBLIC_SUPABASE_URL=\${SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=\${SUPABASE_ANON_KEY}
DATABASE_URL=\${DATABASE_URL}
\`\`\`

**File structure:**
\`\`\`
repo-root/
├── .hush                    # Actual secrets (gitignored)
├── .hush.encrypted          # Encrypted secrets (committed)
├── apps/
│   ├── mobile/
│   │   └── .hush            # Template with \${VAR} refs (committed)
│   └── web/
│       └── .hush            # Template with \${VAR} refs (committed)
\`\`\`

**How it works:**
1. Root \`.hush\` contains actual secrets → encrypted to \`.hush.encrypted\`
2. Subdirectory \`.hush\` templates reference root secrets via \`\${VAR}\`
3. Run \`hush run\` from subdirectory - it resolves templates automatically

\`\`\`bash
cd apps/mobile
npx hush run -- expo start   # Template vars resolved from root secrets
\`\`\`

### Step 6: Encrypt secrets

\`\`\`bash
npx hush encrypt
\`\`\`

This creates:
- \`.hush.encrypted\`
- \`.hush.development.encrypted\`
- \`.hush.production.encrypted\`

### Step 7: Verify setup

\`\`\`bash
npx hush status
npx hush inspect
\`\`\`

### Step 8: Update \`.gitignore\`

Add these lines to \`.gitignore\`:

\`\`\`gitignore
# Hush - plaintext source files (encrypted versions are committed)
.hush
.hush.local
.hush.development
.hush.production

# Output files (generated by hush decrypt, not committed)
.env
.env.*
.dev.vars

# Keep encrypted files (these ARE committed)
!.hush.encrypted
!.hush.*.encrypted
\`\`\`

### Step 9: Commit encrypted files

\`\`\`bash
git add .sops.yaml hush.yaml .hush*.encrypted .gitignore
git commit -m "chore: add Hush secrets management"
\`\`\`

---

## Team Member Setup

When a new team member joins:

### With 1Password (Recommended)

\`\`\`bash
npx hush keys setup   # Auto-pulls key from 1Password
\`\`\`

### Without 1Password

1. **Get the age private key** from an existing team member
2. **Save it** to \`~/.config/sops/age/keys/{project}.txt\` (check \`npx hush status\` for exact path)
3. **Set up direnv** to load the key (see below)
4. **Verify** with \`npx hush status\` and \`npx hush inspect\`

### Critical: Set Up direnv

Hush uses per-project keys. SOPS needs to know where to find them via \`SOPS_AGE_KEY_FILE\`.

**1. Install direnv:**
\`\`\`bash
brew install direnv                    # macOS
# Add to ~/.zshrc or ~/.bashrc:
eval "$(direnv hook zsh)"              # or bash
\`\`\`

**2. Create/verify .envrc in the project:**
\`\`\`bash
# .envrc (should already exist if project is set up)
export SOPS_AGE_KEY_FILE="$HOME/.config/sops/age/keys/{project-slug}.txt"
\`\`\`

**3. Allow direnv:**
\`\`\`bash
cd /path/to/project
direnv allow
\`\`\`

**4. Verify setup:**
\`\`\`bash
npx hush status    # Should show "age key configured"
npx hush inspect   # Should decrypt and show masked secrets
\`\`\`

The private key should be shared securely (1Password is ideal, or password manager, encrypted channel)

---

## Verification Checklist

After setup, verify everything works:

- [ ] \`npx hush status\` shows configuration
- [ ] \`npx hush inspect\` shows masked variables
- [ ] \`npx hush run -- env\` can decrypt and run (secrets stay in memory!)
- [ ] \`.hush.encrypted\` files are committed to git
- [ ] Plaintext \`.hush\` and \`.env\` files are in \`.gitignore\`

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

### "no identity matched any of the recipients" or "Error: no matching keys found"

This error means SOPS can't find the decryption key. **Most common cause: direnv not loaded.**

**Step 1: Check if the key file exists**
\`\`\`bash
npx hush keys list   # Shows local and 1Password keys
\`\`\`

If the key is listed but decryption fails, the issue is that SOPS doesn't know where to find it.

**Step 2: Set up direnv (CRITICAL for per-project keys)**

Hush uses per-project keys at \`~/.config/sops/age/keys/{project}.txt\`. SOPS needs the \`SOPS_AGE_KEY_FILE\` environment variable set to find it.

\`\`\`bash
# Install direnv (if not already installed)
brew install direnv

# Add to your shell (add to ~/.zshrc or ~/.bashrc)
eval "$(direnv hook zsh)"   # or bash
\`\`\`

**Step 3: Create .envrc in the project root**
\`\`\`bash
# .envrc
export SOPS_AGE_KEY_FILE="$HOME/.config/sops/age/keys/{project-slug}.txt"
\`\`\`

Replace \`{project-slug}\` with your project identifier (e.g., \`myorg-myrepo\`). Check \`npx hush status\` to see the expected filename.

**Step 4: Allow direnv**
\`\`\`bash
direnv allow
\`\`\`

**Step 5: Verify**
\`\`\`bash
npx hush status   # Should show "age key configured"
npx hush inspect  # Should decrypt and show masked secrets
\`\`\`

### "hush.yaml not found"
Run \`npx hush init\` to generate configuration.

### "No sources defined in hush.yaml"
Edit \`hush.yaml\` and add your source files under \`sources:\`.

### "npm warn Unknown project config node-linker"
This warning appears when running \`npx hush\` in a pnpm workspace because npm doesn't recognize pnpm-specific config in \`.npmrc\`.

**Fix:** Add \`loglevel=error\` to the project's \`.npmrc\`:
\`\`\`bash
echo "loglevel=error" >> .npmrc
\`\`\`

This suppresses npm warnings while still showing errors. This is a per-project fix for any project using pnpm.
`,

  'REFERENCE.md': `# Hush Command Reference

Complete reference for all Hush CLI commands with flags, options, and examples.

## Security Model: Encrypted at Rest

All secrets are stored encrypted in \`.hush.encrypted\` files. Never read \`.env\` files directly - they indicate legacy/misconfigured setup. Use \`hush inspect\` or \`hush has\` to check secrets safely.

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

### hush set <KEY> [VALUE] ⭐

Add or update a single secret. Prompts for value if not provided inline.

\`\`\`bash
hush set DATABASE_URL              # Prompts for value interactively
hush set DATABASE_URL "postgres://..."  # Inline value (no prompt)
hush set API_KEY -e production     # Set in production secrets
hush set DEBUG --local             # Set personal local override
\`\`\`

**Input methods (in priority order):**
1. **Inline value**: \`hush set KEY "myvalue"\` - value provided directly
2. **Piped input**: \`echo "myvalue" | hush set KEY\` - reads from stdin
3. **Interactive prompt**: Opens dialog/prompt for user input

**GUI dialog (--gui flag):**
\`\`\`bash
hush set API_KEY --gui             # Opens visible dialog (for AI agents)
\`\`\`
The GUI dialog shows the value as you type/paste for easier verification.

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

Encrypt source \`.hush\` files to \`.hush.encrypted\` files.

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

Push production secrets to Cloudflare (Workers and Pages).

\`\`\`bash
hush push                          # Push all targets
hush push -t api                   # Push specific target
hush push --dry-run                # Preview without pushing
hush push --dry-run --verbose      # Detailed preview of what would be pushed
\`\`\`

**For Cloudflare Pages:** Add \`push_to\` configuration to your target:
\`\`\`yaml
targets:
  - name: app
    format: dotenv
    push_to:
      type: cloudflare-pages
      project: my-pages-project
\`\`\`

---

## Debugging Commands

### hush resolve <target>

Show what variables a specific target will receive, with filtering details.

\`\`\`bash
hush resolve api-workers           # Check api-workers target
hush resolve api-workers -e prod   # Check with production environment
\`\`\`

**Output shows:**
- ✅ Included variables (with source file)
- 🚫 Excluded variables (with matching pattern)

**Use when:** A target is missing expected variables

---

### hush trace <KEY>

Trace a specific variable through all sources and targets.

\`\`\`bash
hush trace DATABASE_URL            # Trace DATABASE_URL
hush trace STRIPE_SECRET_KEY       # Trace another variable
\`\`\`

**Output shows:**
- Which source files contain the variable
- Which targets include/exclude it (and why)

**Use when:** You need to understand why a variable appears in some places but not others

---

### hush template

Show the resolved template for the current directory's \`.hush\` file.

\`\`\`bash
cd apps/mobile
hush template                      # Show resolved expansions
hush template -e production        # Show for production
\`\`\`

**Output shows:**
- Original template values (e.g., \`\${API_URL}\`)
- Resolved values from root secrets (masked)
- Any unresolved references

**Use when:** Debugging why a subdirectory template isn't resolving correctly

---

### hush expansions

Show the expansion graph across all subdirectories that have \`.hush\` templates.

\`\`\`bash
hush expansions                    # Scan all subdirectories
hush expansions -e production      # Show for production
\`\`\`

**Output shows:**
- Which subdirectories have \`.hush\` templates
- What variables each template references from root
- Resolution status for each reference

**Use when:** Getting an overview of pull-based templates across a monorepo

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
| \`hush resolve <target>\` | See what a target receives |
| \`hush trace <KEY>\` | Trace variable through targets |
| \`hush template\` | Show resolved subdirectory template |
| \`hush expansions\` | Show all subdirectory templates |

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

Push production secrets to Cloudflare (Workers and Pages).

\`\`\`bash
hush push                       # Push all targets
hush push -t api                # Push specific target
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
  shared: .hush
  development: .hush.development
  production: .hush.production

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

### Variable Interpolation (v5+)

Reference other variables using \`\${VAR}\` syntax:

\`\`\`bash
# Basic interpolation
API_URL=\${BASE_URL}/api

# Default values (if VAR is unset or empty)
DEBUG=\${DEBUG:-false}
PORT=\${PORT:-3000}

# System environment (explicit opt-in)
CI=\${env:CI}

# Pull from root (subdirectory .hush can reference root secrets)
# apps/mobile/.hush:
EXPO_PUBLIC_API_URL=\${API_URL}  # Renamed from root
\`\`\`

**Resolution order:** Local value → Root secrets → System env (only with \`env:\` prefix)

### Push vs Pull Architecture

**Push (hush.yaml targets):** Pattern-based filtering, auto-flow
\`\`\`yaml
targets:
  - name: web
    include: [NEXT_PUBLIC_*]  # All matching vars flow automatically
\`\`\`

**Pull (subdirectory templates):** Transformation, renaming, defaults
\`\`\`bash
# packages/mobile/.hush
EXPO_PUBLIC_API_URL=\${API_URL}     # Rename from root
EXPO_PUBLIC_DEBUG=\${DEBUG:-false}  # With default
PORT=\${PORT:-8081}                  # Local default
\`\`\`

**Benefits:** Full control over naming and defaults. Explicit dependencies.

### "When do I update templates vs hush.yaml?"

| Scenario | Update |
|----------|--------|
| New \`NEXT_PUBLIC_*\` var, web uses push | Nothing! Auto-flows |
| New var mobile needs, mobile uses pull | \`packages/mobile/.hush\` template |
| New package needs secrets | \`hush.yaml\` (push) or new template (pull) |
| Change var routing | \`hush.yaml\` include/exclude patterns |

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
- There are .env files present (legacy or output from decrypt)
- The project is configured with key management
- Keys are properly set up and backed up

**To fix:** Run \`npx hush migrate\` (if v4) or delete/gitignore these .env files

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

function getSkillPath(ctx: HushContext, location: InstallLocation, root: string): string {
  if (location === 'global') {
    return ctx.path.join(homedir(), '.claude', 'skills', 'hush-secrets');
  }
  return ctx.path.join(root, '.claude', 'skills', 'hush-secrets');
}

async function promptForLocation(ctx: HushContext): Promise<InstallLocation> {
  const rl = createInterface({
    input: ctx.process.stdin,
    output: ctx.process.stdout,
  });

  return new Promise((resolve) => {
    ctx.logger.log(pc.bold('\nWhere would you like to install the Claude skill?\n'));
    ctx.logger.log(`  ${pc.cyan('1)')} ${pc.bold('Global')} ${pc.dim('(~/.claude/skills/)')}`);
    ctx.logger.log(`     Works across all your projects. Recommended for personal use.\n`);
    ctx.logger.log(`  ${pc.cyan('2)')} ${pc.bold('Local')} ${pc.dim('(.claude/skills/)')}`);
    ctx.logger.log(`     Bundled with this project. Recommended for teams.\n`);

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

function writeSkillFiles(ctx: HushContext, skillPath: string): void {
  ctx.fs.mkdirSync(skillPath, { recursive: true });
  ctx.fs.mkdirSync(ctx.path.join(skillPath, 'examples'), { recursive: true });

  for (const [filename, content] of Object.entries(SKILL_FILES)) {
    const filePath = ctx.path.join(skillPath, filename);
    ctx.fs.writeFileSync(filePath, content, 'utf-8');
  }
}

export async function skillCommand(ctx: HushContext, options: SkillOptions): Promise<void> {
  const { global: isGlobal, local: isLocal } = options;

  let location: InstallLocation;

  if (isGlobal) {
    location = 'global';
  } else if (isLocal) {
    location = 'local';
  } else {
    location = await promptForLocation(ctx);
  }

  const skillPath = getSkillPath(ctx, location, ctx.process.cwd());

  const alreadyInstalled = ctx.fs.existsSync(ctx.path.join(skillPath, 'SKILL.md'));
  if (alreadyInstalled) {
    ctx.logger.log(pc.yellow(`\nSkill already installed at: ${skillPath}`));
    ctx.logger.log(pc.dim('To reinstall, delete the directory first.\n'));
    return;
  }

  ctx.logger.log(pc.blue(`\nInstalling Claude skill to: ${skillPath}`));

  writeSkillFiles(ctx, skillPath);

  ctx.logger.log(pc.green('\n✓ Skill installed successfully!\n'));

  if (location === 'global') {
    ctx.logger.log(pc.dim('The skill is now active for all projects using Claude Code.\n'));
  } else {
    ctx.logger.log(pc.dim('The skill is now bundled with this project.'));
    ctx.logger.log(pc.dim('Commit the .claude/ directory to share with your team.\n'));
    ctx.logger.log(pc.bold('Suggested:'));
    ctx.logger.log(`  git add .claude/`);
    ctx.logger.log(`  git commit -m "chore: add Hush Claude skill"\n`);
  }

  ctx.logger.log(pc.bold('What the skill does:'));
  ctx.logger.log(`  • Teaches AI to use ${pc.cyan('hush inspect')} instead of reading .env files`);
  ctx.logger.log(`  • Prevents accidental exposure of secrets to LLMs`);
  ctx.logger.log(`  • Guides AI through adding/modifying secrets safely\n`);
}
