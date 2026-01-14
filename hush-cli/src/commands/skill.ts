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
allowed-tools: Bash(hush:*), Bash(npx hush:*), Bash(brew:*), Bash(npm:*), Bash(pnpm:*), Bash(age-keygen:*), Read, Grep, Glob, Write
---

# Hush - AI-Native Secrets Management

Hush encrypts secrets so they can be committed to git, and provides AI-safe commands that let you work with secrets without exposing values to LLMs.

## CRITICAL RULES

### NEVER do these things:
- Read \`.env\`, \`.env.*\`, \`.env.local\`, or \`.dev.vars\` files directly
- Use \`cat\`, \`grep\`, \`head\`, \`tail\`, \`less\`, \`more\` on env files
- Echo or print environment variable values like \`echo $SECRET\`
- Include actual secret values in your responses
- Write secrets directly to \`.env\` files

### ALWAYS use Hush commands instead:
- \`npx hush inspect\` to see what variables exist (values are masked)
- \`npx hush has <KEY>\` to check if a specific variable is set
- \`npx hush set\` to add or modify secrets (opens secure editor)
- \`npx hush status\` to view configuration

## Quick Check: Is Hush Set Up?

Run this first to check if Hush is configured:

\`\`\`bash
npx hush status
\`\`\`

**If this fails or shows errors**, see [SETUP.md](SETUP.md) for first-time setup instructions.

---

## Daily Usage (AI-Safe Commands)

### See what variables exist

\`\`\`bash
npx hush inspect                    # Development
npx hush inspect -e production      # Production
\`\`\`

Output shows **masked values** - safe for AI to read:

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

### View configuration

\`\`\`bash
npx hush status
\`\`\`

### Set/modify secrets (requires user interaction)

\`\`\`bash
npx hush set                        # Set shared secrets
npx hush set development            # Set dev secrets  
npx hush set production             # Set prod secrets
\`\`\`

After setting, encrypt:

\`\`\`bash
npx hush encrypt
\`\`\`

### Decrypt to targets

\`\`\`bash
npx hush decrypt                    # Development
npx hush decrypt -e production      # Production
\`\`\`

---

## Common Workflows

### "What secrets are configured?"
\`\`\`bash
npx hush inspect
\`\`\`

### "Is DATABASE_URL set?"
\`\`\`bash
npx hush has DATABASE_URL
\`\`\`

### "Help user add a new secret"
1. Tell user to run: \`npx hush set\`
2. They add the variable in their editor
3. They save and close
4. Tell them to run: \`npx hush encrypt\`
5. Verify: \`npx hush inspect\`

### "Check all required secrets"
\`\`\`bash
npx hush has DATABASE_URL -q && npx hush has API_KEY -q && echo "All configured" || echo "Some missing"
\`\`\`

---

## Files You Must NOT Read

These contain plaintext secrets - NEVER read them:
- \`.env\`, \`.env.local\`, \`.env.development\`, \`.env.production\`
- \`.dev.vars\`
- Any \`*/.env\` or \`*/.env.*\` files

## Files That Are Safe to Read

- \`hush.yaml\` - Configuration (no secrets)
- \`.sops.yaml\` - SOPS config (public key only)
- \`.env.encrypted\`, \`.env.*.encrypted\` - Encrypted files

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
3. **Run** \`npx hush decrypt\` to generate local env files
4. **Start developing**

The private key should be shared securely (password manager, encrypted channel, etc.)

---

## Verification Checklist

After setup, verify everything works:

- [ ] \`npx hush status\` shows configuration
- [ ] \`npx hush inspect\` shows masked variables
- [ ] \`npx hush decrypt\` creates local env files
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

## Global Options

These options work with most commands:

| Option | Description |
|--------|-------------|
| \`-e, --env <env>\` | Environment: \`development\` (or \`dev\`) / \`production\` (or \`prod\`). Default: \`development\` |
| \`-r, --root <dir>\` | Root directory containing \`hush.yaml\`. Default: current directory |
| \`-h, --help\` | Show help message |
| \`-v, --version\` | Show version number |

## Commands

### hush init

Generate a \`hush.yaml\` configuration file with auto-detected targets.

\`\`\`bash
hush init
\`\`\`

Scans for \`package.json\` and \`wrangler.toml\` files to auto-detect targets.

---

### hush encrypt

Encrypt source \`.env\` files to \`.env.encrypted\` files.

\`\`\`bash
hush encrypt
\`\`\`

**What gets encrypted** (based on \`hush.yaml\` sources):
- \`.env\` -> \`.env.encrypted\`
- \`.env.development\` -> \`.env.development.encrypted\`
- \`.env.production\` -> \`.env.production.encrypted\`

---

### hush decrypt

Decrypt and distribute secrets to all configured targets.

\`\`\`bash
hush decrypt                    # Development (default)
hush decrypt -e production      # Production
hush decrypt -e prod            # Short form
\`\`\`

**Process:**
1. Decrypts encrypted source files
2. Merges: shared -> environment -> local overrides
3. Interpolates variable references (\`\${VAR}\`)
4. Filters per target using \`include\`/\`exclude\` patterns
5. Writes to each target in configured format

---

### hush set (alias: edit)

Set or modify secrets. Opens encrypted file in your \`$EDITOR\`.

\`\`\`bash
hush set                        # Set shared secrets
hush set development            # Set development secrets
hush set production             # Set production secrets
\`\`\`

Opens a temporary decrypted file, re-encrypts on save.

**Tip:** Set your editor with \`export EDITOR=vim\` or use \`code --wait\` for VS Code.

---

### hush list

List all variables with their **actual values**.

\`\`\`bash
hush list                       # Development
hush list -e production         # Production
\`\`\`

**WARNING:** This shows real secret values. Use \`hush inspect\` for AI-safe output.

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

Step-by-step examples for common AI assistant workflows when working with secrets.

## Checking Configuration

### "What environment variables does this project use?"

\`\`\`bash
hush inspect
\`\`\`

Read the output to see all configured variables, their approximate lengths, and which targets receive them.

### "Is the database configured?"

\`\`\`bash
hush has DATABASE_URL
\`\`\`

If the output says "not found", guide the user to add it.

### "Are all required secrets set?"

\`\`\`bash
# Check each required secret
hush has DATABASE_URL -q || echo "Missing: DATABASE_URL"
hush has API_KEY -q || echo "Missing: API_KEY"
hush has STRIPE_SECRET_KEY -q || echo "Missing: STRIPE_SECRET_KEY"
\`\`\`

Or check all at once:
\`\`\`bash
hush has DATABASE_URL -q && \\
hush has API_KEY -q && \\
hush has STRIPE_SECRET_KEY -q && \\
echo "All secrets configured" || \\
echo "Some secrets missing"
\`\`\`

---

## Helping Users Add Secrets

### "Help me add a new API key"

1. **Check if it already exists:**
   \`\`\`bash
   hush has NEW_API_KEY
   \`\`\`

2. **If not set, guide the user:**
   > To add \`NEW_API_KEY\`, run:
   > \`\`\`bash
   > hush set
   > \`\`\`
   > Add a line like: \`NEW_API_KEY=your_actual_key_here\`
   > Save and close the editor, then run:
   > \`\`\`bash
   > hush encrypt
   > \`\`\`

3. **Verify it was added:**
   \`\`\`bash
   hush has NEW_API_KEY
   \`\`\`

### "I need to add secrets for production"

Guide the user:
> Run \`hush set production\` to set production secrets.
> After saving, run \`hush encrypt\` to encrypt the changes.
> To deploy, run \`hush decrypt -e production\`.

---

## Debugging Issues

### "My app can't find DATABASE_URL"

1. **Check if the variable exists:**
   \`\`\`bash
   hush has DATABASE_URL
   \`\`\`

2. **If it exists, check target distribution:**
   \`\`\`bash
   hush inspect
   \`\`\`
   Look at the "Target distribution" section to see which targets receive it.

3. **Check if it's filtered out:**
   \`\`\`bash
   cat hush.yaml
   \`\`\`
   Look for \`include\`/\`exclude\` patterns that might filter the variable.

4. **Regenerate env files:**
   \`\`\`bash
   hush decrypt
   \`\`\`

### "Secrets aren't reaching my API folder"

1. **Check target configuration:**
   \`\`\`bash
   hush status
   \`\`\`
   Verify the API target path and format are correct.

2. **Check filters:**
   \`\`\`bash
   cat hush.yaml
   \`\`\`
   If there's an \`exclude: EXPO_PUBLIC_*\` pattern, that's intentional.
   If there's an \`include\` pattern, only matching variables are sent.

3. **Run inspect to see distribution:**
   \`\`\`bash
   hush inspect
   \`\`\`

---

## Deployment Workflows

### "Deploy to production"

\`\`\`bash
# Decrypt production secrets to all targets
hush decrypt -e production
\`\`\`

### "Push secrets to Cloudflare Workers"

\`\`\`bash
# Preview what would be pushed
hush push --dry-run

# Actually push (requires wrangler auth)
hush push
\`\`\`

### "Verify before deploying"

\`\`\`bash
# Check all encrypted files are up to date
hush check

# If drift detected, encrypt first
hush encrypt

# Then decrypt for production
hush decrypt -e production
\`\`\`

---

## Team Workflows

### "New team member setup"

Guide them:
> 1. Get the age private key from a team member
> 2. Save it to \`~/.config/sops/age/key.txt\`
> 3. Run \`hush decrypt\` to generate local env files
> 4. Start developing!

### "Someone added new secrets, my app is broken"

\`\`\`bash
# Pull latest changes
git pull

# Regenerate env files
hush decrypt
\`\`\`

### "Check if I forgot to encrypt changes"

\`\`\`bash
hush check
\`\`\`

If drift detected:
\`\`\`bash
hush encrypt
git add .env*.encrypted
git commit -m "chore: encrypt new secrets"
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

### hush has output explained

\`\`\`bash
$ hush has DATABASE_URL
DATABASE_URL is set (45 chars)

$ hush has MISSING_VAR
MISSING_VAR not found
\`\`\`

The character count helps identify if the value looks reasonable (e.g., a 45-char DATABASE_URL is plausible, a 3-char one might be wrong).
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
