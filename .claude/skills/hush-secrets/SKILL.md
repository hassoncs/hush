---
name: hush-secrets
description: Manage secrets safely using Hush CLI. Use when working with .env files, environment variables, secrets, API keys, database URLs, credentials, or configuration. NEVER read .env files directly - always use hush commands instead to prevent exposing secrets to the LLM.
allowed-tools: Bash(hush:*), Bash(npx hush:*), Bash(brew:*), Bash(npm:*), Bash(pnpm:*), Bash(age-keygen:*), Read, Grep, Glob, Write
---

# Hush - AI-Native Secrets Management

Hush encrypts secrets so they can be committed to git, and provides AI-safe commands that let you work with secrets without exposing values to LLMs.

## CRITICAL RULES

### NEVER do these things:
- Read `.env`, `.env.*`, `.env.local`, or `.dev.vars` files directly
- Use `cat`, `grep`, `head`, `tail`, `less`, `more` on env files
- Echo or print environment variable values like `echo $SECRET`
- Include actual secret values in your responses
- Write secrets directly to `.env` files

### ALWAYS use Hush commands instead:
- `npx hush inspect` to see what variables exist (values are masked)
- `npx hush has <KEY>` to check if a specific variable is set
- `npx hush edit` to modify secrets (opens secure editor)
- `npx hush status` to view configuration

## Quick Check: Is Hush Set Up?

Run this first to check if Hush is configured:

```bash
npx hush status
```

**If this fails or shows errors**, see [SETUP.md](SETUP.md) for first-time setup instructions.

---

## Daily Usage (AI-Safe Commands)

### See what variables exist

```bash
npx hush inspect                    # Development
npx hush inspect -e production      # Production
```

Output shows **masked values** - safe for AI to read:

```
Secrets for development:

  DATABASE_URL      = post****************... (45 chars)
  STRIPE_SECRET_KEY = sk_t****************... (32 chars)
  API_KEY           = (not set)

Total: 3 variables
```

### Check if a specific variable exists

```bash
npx hush has DATABASE_URL           # Verbose output
npx hush has API_KEY -q             # Quiet: exit code only (0=set, 1=missing)
```

### View configuration

```bash
npx hush status
```

### Edit secrets (requires user interaction)

```bash
npx hush edit                       # Edit shared secrets
npx hush edit development           # Edit dev secrets  
npx hush edit production            # Edit prod secrets
```

After editing, encrypt:

```bash
npx hush encrypt
```

### Decrypt to targets

```bash
npx hush decrypt                    # Development
npx hush decrypt -e production      # Production
```

---

## Common Workflows

### "What secrets are configured?"
```bash
npx hush inspect
```

### "Is DATABASE_URL set?"
```bash
npx hush has DATABASE_URL
```

### "Help user add a new secret"
1. Tell user to run: `npx hush edit`
2. They add the variable in their editor
3. They save and close
4. Tell them to run: `npx hush encrypt`
5. Verify: `npx hush inspect`

### "Check all required secrets"
```bash
npx hush has DATABASE_URL -q && npx hush has API_KEY -q && echo "All configured" || echo "Some missing"
```

---

## Files You Must NOT Read

These contain plaintext secrets - NEVER read them:
- `.env`, `.env.local`, `.env.development`, `.env.production`
- `.dev.vars`
- Any `*/.env` or `*/.env.*` files

## Files That Are Safe to Read

- `hush.yaml` - Configuration (no secrets)
- `.sops.yaml` - SOPS config (public key only)
- `.env.encrypted`, `.env.*.encrypted` - Encrypted files

---

## Additional Resources

- **First-time setup**: [SETUP.md](SETUP.md)
- **Command reference**: [REFERENCE.md](REFERENCE.md)
- **Workflow examples**: [examples/workflows.md](examples/workflows.md)
