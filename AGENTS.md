# AGENTS.md

> This repository is designed to be modified by AI agents. This document is the operational contract.

## Mission

Hush is an AI-native secrets manager. The codebase, documentation, releases, and migrations are all managed by AI agents following this guide. Human intervention is minimal - mostly approving PRs and providing secrets/credentials when needed.

## Repository Structure

```
hush/
├── hush-cli/           # CLI package (@chriscode/hush)
│   ├── src/
│   │   ├── commands/   # CLI commands (run, set, encrypt, etc.)
│   │   ├── core/       # Core logic (parse, merge, filter, mask)
│   │   ├── formats/    # Output formatters (dotenv, wrangler, json)
│   │   ├── config/     # Configuration loader
│   │   └── cli.ts      # Entry point
│   └── tests/          # Vitest tests
├── docs/               # Astro Starlight documentation site
│   └── src/content/docs/
│       ├── guides/     # How-to guides
│       ├── reference/  # Command/format reference
│       └── migrations/ # Version migration guides
└── .github/workflows/  # CI/CD automation (auto-release on every push)
```

## Non-Negotiables

1. **No interactive prompts** - All scripts must work non-interactively
2. **No secrets in commits** - Never commit `.env` files, API keys, tokens
3. **No type errors** - Never use `as any`, `@ts-ignore`, `@ts-expect-error`
4. **Tests must pass** - Run `pnpm test` before any commit
5. **Build must succeed** - Run `pnpm build` before releases
6. **Keep docs in sync** - Every CLI change must update implementation, skill, AND docs together

---

## CLI Changes: Required Updates

**CRITICAL: When adding or modifying any CLI command, ALL THREE must be updated in the same commit:**

| Location | What to Update |
|----------|----------------|
| `hush-cli/src/commands/*.ts` | Implementation |
| `hush-cli/src/commands/skill.ts` | AI skill documentation (SKILL.md, REFERENCE.md, workflows.md) |
| `docs/src/content/docs/reference/commands.mdx` | User-facing documentation |

### Checklist for New Commands

- [ ] Create command file in `hush-cli/src/commands/`
- [ ] Add types to `hush-cli/src/types.ts` if needed
- [ ] Register in `hush-cli/src/cli.ts` (import, help text, argument parsing, switch case)
- [ ] Update skill in `hush-cli/src/commands/skill.ts`:
  - Add to SKILL.md command table
  - Add to REFERENCE.md with full documentation
  - Add usage examples to workflows.md if applicable
- [ ] Update docs in `docs/src/content/docs/reference/commands.mdx`
- [ ] Run `pnpm build && pnpm test` to verify

### Checklist for Modified Commands

- [ ] Update implementation
- [ ] Update skill documentation if behavior/options changed
- [ ] Update docs if behavior/options changed
- [ ] Run `pnpm build && pnpm test` to verify

**Why this matters:** The skill teaches AI assistants how to use Hush. If the skill is outdated, AI will give users wrong instructions. The docs are the user's reference. All three must stay in sync.

---

## Key Management

Hush uses per-project age keys backed up to 1Password.

### Key Storage

| Location | Purpose |
|----------|---------|
| `~/.config/sops/age/keys/{project}.txt` | Local private key |
| 1Password: `SOPS Key - {project}` | Backup of private key |
| `.sops.yaml` | Public key (committed) |

The project identifier comes from `project` field in `hush.yaml` or auto-detected from `package.json` repository URL.

### Commands

```bash
hush keys setup     # Pull from 1Password or check local
hush keys generate  # Generate new key, save locally, backup to 1Password
hush keys pull      # Pull key from 1Password
hush keys push      # Push local key to 1Password
hush keys list      # List local and 1Password keys
```

### 1Password Integration

Hush integrates with 1Password CLI for secure key backup. When 1Password CLI is available:

1. **Generate** automatically backs up to 1Password
2. **Setup/Pull** retrieves keys from 1Password
3. **Biometric auth** pops up automatically when needed

Prerequisites:
```bash
brew install --cask 1password
brew install 1password-cli
```

Enable "Integrate with 1Password CLI" in 1Password desktop app settings.

### New Developer Setup

```bash
hush keys setup
```

This will:
1. Check for existing local key
2. If not found, pull from 1Password (triggers biometric auth)
3. If still not found, prompt to generate

### CI Setup

For CI, the private key is stored as `SOPS_AGE_KEY` GitHub secret. All other secrets are Hush-managed via `.env.encrypted`.

---

## Branching Strategy

### Default: Branch per task with PRs

```bash
# Create feature branch
git checkout -b agent/2026-01-15/add-yaml-format

# Make changes, commit, push
git add .
git commit -m "feat(formats): add yaml output format"
git push -u origin agent/2026-01-15/add-yaml-format

# Create PR
gh pr create --title "feat(formats): add yaml output format" --body "..."
```

### Exception: Direct to main

The repository owner (hassoncs) may instruct agents to commit directly to main for small fixes. In this case:

```bash
git checkout main
git pull origin main
# Make changes
git add .
git commit -m "fix(cli): handle empty config gracefully"
git pull --rebase origin main  # ALWAYS pull before push (CI may have bumped version)
git push origin main
```

**Only do this when explicitly instructed.** Default is always branch + PR.

### IMPORTANT: Always Pull Before Push

**Every push to main triggers an auto-release** that bumps `package.json` version and creates a commit. This means remote `main` is often ahead of your local branch.

**Always run `git pull --rebase origin main` before pushing.** This avoids rejected pushes due to the CI's version bump commits.

```bash
# Wrong - will likely fail
git commit -m "fix(cli): something"
git push origin main  # ❌ Rejected - remote has version bump

# Correct - always pull first
git commit -m "fix(cli): something"
git pull --rebase origin main  # ✅ Get CI's version bump
git push origin main           # ✅ Success
```

---

## Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/) strictly.

### Format

```
type(scope): description

[optional body]

[optional footer]
```

### Types

| Type | When to use | Version bump |
|------|-------------|--------------|
| `feat` | New feature | minor |
| `fix` | Bug fix | patch |
| `docs` | Documentation only | patch |
| `refactor` | Code change that doesn't fix bug or add feature | patch |
| `test` | Adding/updating tests | patch |
| `chore` | Maintenance, dependencies, config | patch |
| `style` | Formatting, whitespace | patch |
| `ci` | CI/CD changes | patch |
| `build` | Build system changes | patch |

### Scopes

| Scope | When to use |
|-------|-------------|
| `cli` | CLI commands, user-facing behavior |
| `core` | Core parsing, merging, filtering logic |
| `config` | Configuration loading |
| `formats` | Output formatters |
| `docs` | Documentation site |
| `release` | Release scripts, CI/CD |

### Breaking Changes

For breaking changes, add `!` after the scope:

```
feat(cli)!: remove deprecated decrypt command

BREAKING CHANGE: The `hush decrypt` command has been removed.
Use `hush run -- <command>` instead, which decrypts to memory only.

Migration: See docs/migrations/v2-to-v3.md
```

### Examples

```bash
# Bug fix
git commit -m "fix(cli): handle empty hush.yaml targets gracefully"

# New feature
git commit -m "feat(core): support variable interpolation in include patterns"

# Documentation
git commit -m "docs(guides): add monorepo setup guide"

# Breaking change
git commit -m "feat(config)!: rename 'targets' to 'outputs' in hush.yaml

BREAKING CHANGE: The 'targets' key in hush.yaml is now 'outputs'.
This better reflects that these are output destinations, not build targets."
```

---

## When to Commit

Commit **per logical unit** that would make sense as a changelog entry.

### Good commit granularity

```bash
# Task: Add YAML output format

# Commit 1: Core implementation
git commit -m "feat(formats): add yaml output formatter"

# Commit 2: Tests (if substantial)
git commit -m "test(formats): add yaml formatter tests"

# Commit 3: Documentation
git commit -m "docs(reference): document yaml format option"
```

### Avoid

- **Micro-commits**: "fix typo", "add missing semicolon"
- **Mega-commits**: "implement entire feature with tests and docs"

---

## Version Bump Rules

Version bumps are determined by commit types since the last release:

| Commits include | Bump type | Example |
|-----------------|-----------|---------|
| Any `!` (breaking) | **major** | 2.3.0 → 3.0.0 |
| Any `feat` | **minor** | 2.3.0 → 2.4.0 |
| Only `fix`, `docs`, etc. | **patch** | 2.3.0 → 2.3.1 |

The agent decides the version bump based on understanding the changes made.

---

## Migration Documentation

### When to write migration docs

Write a migration guide when:
- Major version bump (breaking changes)
- Significant behavior changes that might confuse users
- Configuration format changes

### Migration doc location

`docs/src/content/docs/migrations/v{X}-to-v{Y}.mdx`

### Migration doc structure

The AI agent writes the full migration guide with:

1. **Summary** - Who's affected, estimated time
2. **Breaking changes** - Each change with before/after examples
3. **Step-by-step migration** - Exact commands to run
4. **AI Migration Assistant prompt** - Copy-paste prompt for users

Example structure:

```markdown
---
title: "Migration: v2 to v3"
---

# Migrating from Hush v2 to v3

## Summary

**Who's affected:** Users with `hush.yaml` files using the `targets` key
**Estimated time:** 5-10 minutes

## Breaking Changes

### 1. `targets` renamed to `outputs`

The `targets` key in `hush.yaml` has been renamed to `outputs`.

**Before (v2):**
```yaml
targets:
  - name: web
    path: ./apps/web
```

**After (v3):**
```yaml
outputs:
  - name: web
    path: ./apps/web
```

**Migration:**
```bash
# In hush.yaml, rename 'targets:' to 'outputs:'
sed -i '' 's/^targets:/outputs:/' hush.yaml
```

## AI Migration Assistant

Copy this prompt to your AI assistant:

```
Help me migrate from Hush v2 to v3.

Rules:
- Do NOT read .env files directly
- Use hush inspect, hush has, hush status only

Steps:
1. Check my hush.yaml for deprecated keys
2. Update configuration to v3 format
3. Run hush status to verify
```
```

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
7. Deploys docs to Cloudflare Pages

### Version Bump Logic

| Commits since last release | Bump | Example |
|---------------------------|------|---------|
| Any with `!` (breaking) | major | 2.3.0 → 3.0.0 |
| Any `feat:` | minor | 2.3.0 → 2.4.0 |
| Only `fix:`, `docs:`, `chore:`, etc. | patch | 2.3.0 → 2.3.1 |
| No conventional commits | skip | No release |

### Idempotent Publishing

The workflow is idempotent:
- If version already exists on npm → skips publish
- If no conventional commits since last release → skips release
- Re-running CI on same commits → safe (no duplicate releases)

### What Agents Do

Agents just commit with conventional commit messages. That's it.

```bash
git commit -m "feat(cli): add new command"
git push origin main
# → CI auto-releases as next minor version
```

For breaking changes:
```bash
git commit -m "feat(cli)!: rename config key

BREAKING CHANGE: The 'targets' key is now 'outputs'."
git push origin main
# → CI auto-releases as next major version
```

### Changelog and Migration Docs

**Changelogs are auto-generated** from commit messages in GitHub Releases.

For **major versions**, agents should still write migration guides at `docs/src/content/docs/migrations/vX-to-vY.mdx` before the breaking change commit.

---

## CI/CD Workflow

### Single Unified Workflow

One workflow handles everything (`.github/workflows/release.yml`):

**On every push/PR:**
1. Install dependencies (`pnpm install`)
2. Build all packages (`pnpm build`)
3. Run all tests (`pnpm test`)
4. Type check (`pnpm type-check`)

**On push to main (after CI passes):**
1. Calculate version bump from commits
2. Publish to npm (if new version needed)
3. Create git tag and GitHub release
4. Deploy docs to Cloudflare Pages

---

## Required Secrets (GitHub)

| Secret | Purpose |
|--------|---------|
| `SOPS_AGE_KEY` | Private age key for decrypting `.env.encrypted` |

All other secrets (Cloudflare credentials, etc.) are stored in `.env.encrypted` and decrypted at runtime using `hush run`.

### Setting Up CI Secrets

```bash
# 1. Generate CI key (separate from developer keys)
hush keys generate

# 2. Add secrets to encrypted file
hush set CLOUDFLARE_API_TOKEN
hush set CLOUDFLARE_ACCOUNT_ID

# 3. Encrypt
hush encrypt

# 4. Add the private key to GitHub secrets as SOPS_AGE_KEY
# Get it from: cat ~/.config/sops/age/keys/{project}.txt
```

---

## Error Recovery

### If CI fails after push

1. Check GitHub Actions logs
2. Fix the issue locally
3. Commit fix: `git commit -m "fix(ci): resolve build failure"`
4. Push again

### If npm publish fails

1. Check if version already exists on npm
2. If duplicate version: bump version again, re-release
3. If auth issue: verify `NPM_TOKEN` secret

### If docs deploy fails

1. Check Cloudflare Pages logs
2. Verify `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
3. Try manual deploy: `cd docs && pnpm deploy`

---

## Quick Reference

### Common commands

```bash
# Development
pnpm install          # Install deps
pnpm build            # Build all
pnpm test             # Run tests
pnpm dev              # Watch mode

# CLI testing
cd hush-cli && pnpm test:watch

# Docs
cd docs && pnpm dev   # Dev server
cd docs && pnpm build # Build

# Release prep
git log --oneline v2.3.0..HEAD  # Commits since last release
```

### File locations

| What | Where |
|------|-------|
| CLI version | `hush-cli/package.json` |
| Migration guides | `docs/src/content/docs/migrations/` |
| CI workflows | `.github/workflows/` |
