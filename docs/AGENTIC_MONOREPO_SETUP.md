# Agentic Monorepo Setup Guide

> A complete guide to setting up a repository optimized for AI agent collaboration, with automatic releases, encrypted secrets, and comprehensive documentation.

This document captures the full setup of an "agentic monorepo" - a repository designed to be maintained primarily by AI agents with minimal human intervention. Use this guide to replicate this infrastructure in any project.

## Overview

### What You Get

| Feature | Description |
|---------|-------------|
| **Hush Secrets** | Encrypted secrets at rest, AI-safe commands |
| **Auto-Release** | Every push to main → version bump → npm publish → GitHub release |
| **AGENTS.md** | Operational contract for AI agents |
| **1Password Backup** | Encryption keys backed up automatically |
| **Docs Site** | Astro Starlight on Cloudflare Pages |
| **Conventional Commits** | Structured commit messages drive versioning |

### Architecture

```
your-project/
├── packages/           # Or your package structure
│   └── cli/            # Main package (published to npm)
│       ├── src/
│       ├── package.json
│       └── README.md   # Real file here (npm needs it)
├── docs/               # Astro Starlight docs
├── .github/workflows/
│   └── release.yml     # Unified CI/CD workflow
├── AGENTS.md           # AI agent instructions
├── hush.yaml           # Hush configuration
├── .sops.yaml          # SOPS encryption config
├── .env.encrypted      # Encrypted secrets
└── README.md           # Symlink to packages/cli/README.md
```

---

## Step 1: Initialize Project Structure

### Create the monorepo structure

```bash
mkdir my-project && cd my-project
git init

# Create package structure
mkdir -p packages/cli/src
mkdir -p docs
mkdir -p .github/workflows

# Initialize root package.json for pnpm workspaces
cat > package.json << 'PKGJSON'
{
  "name": "my-project-monorepo",
  "private": true,
  "packageManager": "pnpm@9.15.4",
  "scripts": {
    "build": "pnpm -r run build",
    "test": "pnpm -r run test",
    "dev": "pnpm -r run dev",
    "type-check": "pnpm -r run type-check"
  }
}
PKGJSON

# Create pnpm workspace config
cat > pnpm-workspace.yaml << 'WORKSPACE'
packages:
  - 'packages/*'
  - 'docs'
WORKSPACE
```

### Create the main package

```bash
cd packages/cli

cat > package.json << 'CLIPKG'
{
  "name": "@yourscope/your-package",
  "version": "0.0.1",
  "description": "Your package description",
  "type": "module",
  "bin": {
    "your-cli": "./bin/cli.js"
  },
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "type-check": "tsc --noEmit"
  },
  "keywords": [],
  "author": "Your Name",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/yourusername/your-project.git"
  },
  "engines": {
    "node": ">=18"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "typescript": "^5.8.3",
    "vitest": "^2.0.0"
  },
  "files": [
    "dist",
    "bin"
  ],
  "publishConfig": {
    "access": "public"
  }
}
CLIPKG

cd ../..
```

---

## Step 2: Set Up Hush for Secrets Management

### Install prerequisites

```bash
# macOS
brew install sops age
brew install --cask 1password
brew install 1password-cli
```

### Initialize Hush

```bash
# Install hush
pnpm add -D @chriscode/hush

# Initialize (generates key, backs up to 1Password)
npx hush init
```

This creates:
- `hush.yaml` - Configuration
- `.sops.yaml` - SOPS config with public key
- `~/.config/sops/age/keys/{project}.txt` - Local private key
- 1Password item `SOPS Key - {project}` - Key backup

### Configure hush.yaml

```yaml
# hush.yaml
project: your-project-name

sources:
  shared: .env
  development: .env.development
  production: .env.production
```

### Add secrets

```bash
# Add CI secrets (opens GUI dialog - AI never sees values)
npx hush set CLOUDFLARE_API_TOKEN
npx hush set CLOUDFLARE_ACCOUNT_ID

# Or for non-interactive environments
npx hush set SECRET_NAME --gui

# Encrypt
npx hush encrypt
```

### Git configuration

Add to `.gitignore`:
```gitignore
# Secrets - plaintext
.env
.env.*
!.env.encrypted
!.env.*.encrypted

# Local overrides
.env.local.encrypted
```

---

## Step 3: Set Up GitHub Actions CI/CD

### Create the unified workflow

Create `.github/workflows/release.yml`:

```yaml
name: CI & Release

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for version calculation
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Build
        run: pnpm build
      
      - name: Type check
        run: pnpm type-check
      
      - name: Run tests
        run: pnpm test

  release:
    needs: ci
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
          registry-url: 'https://registry.npmjs.org'
      
      - name: Upgrade npm for trusted publishing
        run: npm install -g npm@latest
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Build
        run: pnpm build
      
      - name: Calculate version bump
        id: version
        run: |
          # Get current npm version (use 0.0.0 if package doesn't exist yet)
          CURRENT_NPM_VERSION=$(npm view @yourscope/your-package version 2>/dev/null || echo "0.0.0")
          echo "current_npm_version=$CURRENT_NPM_VERSION" >> $GITHUB_OUTPUT
          
          PACKAGE_VERSION=$(node -p "require('./packages/cli/package.json').version")
          echo "package_version=$PACKAGE_VERSION" >> $GITHUB_OUTPUT
          
          LAST_TAG="v$CURRENT_NPM_VERSION"
          
          if git rev-parse "$LAST_TAG" >/dev/null 2>&1; then
            COMMITS=$(git log "$LAST_TAG"..HEAD --pretty=format:"%s" 2>/dev/null || echo "")
          else
            echo "No previous tag found, analyzing recent commits"
            COMMITS=$(git log --pretty=format:"%s" -50)
          fi
          
          echo "Commits since $LAST_TAG:"
          echo "$COMMITS"
          
          BUMP="none"
          
          # Check for breaking changes (!)
          if echo "$COMMITS" | grep -qE "^[a-z]+(\(.+\))?!:"; then
            BUMP="major"
          # Check for features
          elif echo "$COMMITS" | grep -qE "^feat(\(.+\))?:"; then
            BUMP="minor"
          # Check for fixes, docs, etc.
          elif echo "$COMMITS" | grep -qE "^(fix|docs|refactor|test|chore|style|ci|build)(\(.+\))?:"; then
            BUMP="patch"
          fi
          
          echo "bump=$BUMP" >> $GITHUB_OUTPUT
          
          if [ "$BUMP" = "none" ]; then
            echo "No conventional commits found, skipping release"
            echo "new_version=$CURRENT_NPM_VERSION" >> $GITHUB_OUTPUT
            echo "should_release=false" >> $GITHUB_OUTPUT
          else
            IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_NPM_VERSION"
            
            case "$BUMP" in
              major) NEW_VERSION="$((MAJOR + 1)).0.0" ;;
              minor) NEW_VERSION="$MAJOR.$((MINOR + 1)).0" ;;
              patch) NEW_VERSION="$MAJOR.$MINOR.$((PATCH + 1))" ;;
            esac
            
            echo "new_version=$NEW_VERSION" >> $GITHUB_OUTPUT
            echo "should_release=true" >> $GITHUB_OUTPUT
            echo "Calculated new version: $NEW_VERSION ($BUMP bump)"
          fi
      
      - name: Check if version already published
        id: check_published
        run: |
          NEW_VERSION="${{ steps.version.outputs.new_version }}"
          if npm view "@yourscope/your-package@$NEW_VERSION" version >/dev/null 2>&1; then
            echo "Version $NEW_VERSION already published, skipping"
            echo "already_published=true" >> $GITHUB_OUTPUT
          else
            echo "Version $NEW_VERSION not yet published"
            echo "already_published=false" >> $GITHUB_OUTPUT
          fi
      
      - name: Update package.json version
        if: steps.version.outputs.should_release == 'true' && steps.check_published.outputs.already_published == 'false'
        run: |
          NEW_VERSION="${{ steps.version.outputs.new_version }}"
          CURRENT_VERSION=$(node -p "require('./packages/cli/package.json').version")
          
          if [ "$CURRENT_VERSION" = "$NEW_VERSION" ]; then
            echo "package.json already at version $NEW_VERSION"
          else
            cd packages/cli
            npm version "$NEW_VERSION" --no-git-tag-version --allow-same-version
            echo "Updated package.json to version $NEW_VERSION"
          fi
      
      - name: Publish to npm (trusted publishing)
        if: steps.version.outputs.should_release == 'true' && steps.check_published.outputs.already_published == 'false'
        run: npm publish --access public --provenance
        working-directory: packages/cli
      
      - name: Create git tag
        if: steps.version.outputs.should_release == 'true' && steps.check_published.outputs.already_published == 'false'
        run: |
          NEW_VERSION="${{ steps.version.outputs.new_version }}"
          TAG="v$NEW_VERSION"
          
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          
          git add packages/cli/package.json
          git commit -m "chore(release): $NEW_VERSION [skip ci]" || echo "No changes to commit"
          
          git tag "$TAG" || echo "Tag already exists"
          
          git push origin main || echo "No commits to push"
          git push origin "$TAG"
          
          echo "Created and pushed tag $TAG"
      
      - name: Create GitHub Release
        if: steps.version.outputs.should_release == 'true' && steps.check_published.outputs.already_published == 'false'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          NEW_VERSION="${{ steps.version.outputs.new_version }}"
          TAG="v$NEW_VERSION"
          
          LAST_TAG="v${{ steps.version.outputs.current_npm_version }}"
          
          if git rev-parse "$LAST_TAG" >/dev/null 2>&1; then
            NOTES=$(git log "$LAST_TAG"..HEAD~1 --pretty=format:"- %s" 2>/dev/null || echo "- Initial release")
          else
            NOTES="- Initial release"
          fi
          
          gh release create "$TAG" \
            --title "$TAG" \
            --notes "$NOTES" \
            --latest

  deploy-docs:
    needs: ci
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Install sops and age
        run: |
          curl -LO https://github.com/getsops/sops/releases/download/v3.9.4/sops-v3.9.4.linux.amd64
          sudo mv sops-v3.9.4.linux.amd64 /usr/local/bin/sops
          sudo chmod +x /usr/local/bin/sops
          
          curl -LO https://github.com/FiloSottile/age/releases/download/v1.2.0/age-v1.2.0-linux-amd64.tar.gz
          tar -xzf age-v1.2.0-linux-amd64.tar.gz
          sudo mv age/age /usr/local/bin/
          sudo mv age/age-keygen /usr/local/bin/
          sudo chmod +x /usr/local/bin/age /usr/local/bin/age-keygen
      
      - name: Setup age key
        run: |
          mkdir -p ~/.config/sops/age
          echo "${{ secrets.SOPS_AGE_KEY }}" > ~/.config/sops/age/key.txt
          chmod 600 ~/.config/sops/age/key.txt
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Build
        run: pnpm build
      
      - name: Deploy docs with Hush secrets
        run: |
          export SOPS_AGE_KEY_FILE=~/.config/sops/age/key.txt
          npx hush run -- pnpm --filter docs exec wrangler pages deploy ./dist --project-name=your-docs
```

### Configure npm trusted publishing

1. Go to https://www.npmjs.com/package/@yourscope/your-package/access
2. Click "Add trusted publisher"
3. Configure:
   - **Repository owner**: `yourusername`
   - **Repository name**: `your-project`
   - **Workflow filename**: `release.yml`
   - **Environment**: (leave blank)

### Add GitHub secrets

```bash
# Get your SOPS key
cat ~/.config/sops/age/key.txt

# Add to GitHub (or use gh cli)
gh secret set SOPS_AGE_KEY
# Paste the entire key file content including comments
```

---

## Step 4: Create AGENTS.md

Create `AGENTS.md` at the root of your repository:

```markdown
# AGENTS.md

> This repository is designed to be modified by AI agents. This document is the operational contract.

## Mission

[Describe what this project does and the role of AI agents]

## Repository Structure

\`\`\`
your-project/
├── packages/cli/       # Main package
│   ├── src/
│   └── tests/
├── docs/               # Documentation site
└── .github/workflows/  # CI/CD automation
\`\`\`

## Non-Negotiables

1. **No interactive prompts** - All scripts must work non-interactively
2. **No secrets in commits** - Never commit `.env` files, API keys, tokens
3. **No type errors** - Never use `as any`, `@ts-ignore`, `@ts-expect-error`
4. **Tests must pass** - Run `pnpm test` before any commit
5. **Build must succeed** - Run `pnpm build` before releases

---

## Key Management

This project uses Hush for secrets management with per-project age keys backed up to 1Password.

### Key Storage

| Location | Purpose |
|----------|---------|
| `~/.config/sops/age/keys/{project}.txt` | Local private key |
| 1Password: `SOPS Key - {project}` | Backup of private key |
| `.sops.yaml` | Public key (committed) |

### Commands

\`\`\`bash
hush keys setup     # Pull from 1Password or check local
hush keys generate  # Generate new key, backup to 1Password
hush set SECRET     # Add secret (opens GUI dialog)
hush inspect        # View secrets (masked values)
hush run -- <cmd>   # Run command with secrets in memory
\`\`\`

---

## Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/) strictly.

### Types

| Type | When to use | Version bump |
|------|-------------|--------------|
| `feat` | New feature | minor |
| `fix` | Bug fix | patch |
| `docs` | Documentation only | patch |
| `refactor` | Code change, no bug fix or feature | patch |
| `test` | Adding/updating tests | patch |
| `chore` | Maintenance, dependencies | patch |

### Breaking Changes

Add `!` after the scope for breaking changes:

\`\`\`
feat(api)!: remove deprecated endpoint

BREAKING CHANGE: The `/v1/old` endpoint has been removed.
\`\`\`

---

## Release Process

### Fully Automatic Releases

**Every push to main triggers a release.** No manual steps required.

The CI workflow:
1. Runs build + tests
2. Analyzes commits since last npm version
3. Determines version bump from conventional commits
4. Updates `package.json` version
5. Publishes to npm (OIDC trusted publishing)
6. Creates git tag and GitHub release
7. Deploys docs

### Version Bump Logic

| Commits since last release | Bump | Example |
|---------------------------|------|---------|
| Any with `!` (breaking) | major | 1.2.3 → 2.0.0 |
| Any `feat:` | minor | 1.2.3 → 1.3.0 |
| Only `fix:`, `docs:`, etc. | patch | 1.2.3 → 1.2.4 |
| No conventional commits | skip | No release |

---

## Required Secrets (GitHub)

| Secret | Purpose |
|--------|---------|
| `SOPS_AGE_KEY` | Private age key for decrypting `.env.encrypted` |

All other secrets are stored in `.env.encrypted` and decrypted at runtime using `hush run`.

---

## Quick Reference

### Common commands

\`\`\`bash
pnpm install          # Install deps
pnpm build            # Build all
pnpm test             # Run tests
pnpm dev              # Watch mode

# Secrets
hush set SECRET_NAME  # Add secret
hush inspect          # View secrets (masked)
hush run -- npm start # Run with secrets
\`\`\`
```

---

## Step 5: Set Up Documentation Site (Optional)

### Initialize Astro Starlight

```bash
cd docs

pnpm create astro@latest --template starlight .

# Configure package.json
cat > package.json << 'DOCSPKG'
{
  "name": "docs",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview"
  },
  "dependencies": {
    "@astrojs/starlight": "^0.31.1",
    "astro": "^5.0.0",
    "sharp": "^0.33.0"
  },
  "devDependencies": {
    "wrangler": "^3.0.0"
  }
}
DOCSPKG
```

### Create Cloudflare Pages project

1. Go to https://dash.cloudflare.com/ → Pages → Create project
2. Create empty project named `your-docs`
3. Add credentials to Hush:

```bash
hush set CLOUDFLARE_API_TOKEN
hush set CLOUDFLARE_ACCOUNT_ID
hush encrypt
```

---

## Step 6: README Setup

npm requires the actual README.md file in the package directory (it doesn't follow symlinks).

```bash
# Move README to package directory
mv README.md packages/cli/README.md

# Symlink from root for GitHub display
ln -s packages/cli/README.md README.md
```

---

## Step 7: First Release

### Initial commit

```bash
git add -A
git commit -m "feat: initial project setup"
```

### Create GitHub repository

```bash
gh repo create yourusername/your-project --public --source=. --push
```

### Verify the release

1. Check GitHub Actions: https://github.com/yourusername/your-project/actions
2. Check npm: https://www.npmjs.com/package/@yourscope/your-package
3. Check releases: https://github.com/yourusername/your-project/releases

---

## Maintenance Checklist

### Adding new secrets

```bash
hush set NEW_SECRET_NAME    # Opens GUI dialog
hush encrypt                # Re-encrypt
git add .env.encrypted
git commit -m "chore: add NEW_SECRET_NAME"
git push
```

### New team member onboarding

```bash
# They run:
hush keys setup    # Pulls key from 1Password
```

### Updating dependencies

```bash
pnpm update
git add pnpm-lock.yaml
git commit -m "chore: update dependencies"
git push
# Auto-releases as patch version
```

---

## Troubleshooting

### "No identity matched any of the recipients"
Your age key doesn't match. Run `hush keys setup` to pull from 1Password.

### npm publish 404
Trusted publisher not configured. Go to npm package settings → Add trusted publisher with blank environment.

### GitHub release fails with "tag exists locally"
The `--follow-tags` flag doesn't push tags without new commits. The workflow handles this by pushing tags explicitly.

### README not showing on npm
npm doesn't follow symlinks. The real README.md must be in the package directory.

---

## Quick Setup Checklist

- [ ] Create monorepo structure
- [ ] Initialize pnpm workspaces
- [ ] Install and configure Hush (`hush init`)
- [ ] Add secrets (`hush set`, `hush encrypt`)
- [ ] Create `.github/workflows/release.yml`
- [ ] Configure npm trusted publishing
- [ ] Add `SOPS_AGE_KEY` to GitHub secrets
- [ ] Create `AGENTS.md`
- [ ] Set up README symlink (real file in package dir)
- [ ] Push and verify first release
- [ ] (Optional) Set up docs site with Cloudflare Pages
