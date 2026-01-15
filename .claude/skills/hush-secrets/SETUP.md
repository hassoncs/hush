# Hush First-Time Setup

This guide walks through setting up Hush from scratch. Follow these steps in order.

## Prerequisites

### Required: SOPS and age

```bash
which sops && which age-keygen && echo "Prerequisites installed" || echo "Need to install"
```

**macOS:**
```bash
brew install sops age
```

**Linux (Debian/Ubuntu):**
```bash
sudo apt install age
wget https://github.com/getsops/sops/releases/download/v3.8.1/sops-v3.8.1.linux.amd64 -O /usr/local/bin/sops
chmod +x /usr/local/bin/sops
```

**Windows:**
```powershell
choco install sops age
```

### Optional: 1Password CLI (recommended for teams)

For automatic key backup and sharing:

```bash
brew install --cask 1password
brew install 1password-cli
```

Enable "Integrate with 1Password CLI" in 1Password desktop app settings.

---

## Project Setup

### Step 1: Install Hush

```bash
npm install -D @chriscode/hush
# or
pnpm add -D @chriscode/hush
```

### Step 2: Initialize (auto-generates everything)

```bash
npx hush init
```

This will automatically:
1. Detect your project structure
2. Generate an age encryption key
3. Back up the key to 1Password (if available)
4. Create `hush.yaml` and `.sops.yaml`

**No 1Password?** Keys are saved locally to `~/.config/sops/age/keys/`. Share securely with your team.

### Step 4: Review `hush.yaml`

The generated config looks like:

```yaml
sources:
  shared: .env
  development: .env.development
  production: .env.production

targets:
  - name: root
    path: .
    format: dotenv
```

Customize targets for your monorepo. Common patterns:

**Next.js app (client vars only):**
```yaml
- name: web
  path: ./apps/web
  format: dotenv
  include:
    - NEXT_PUBLIC_*
```

**API server (exclude client vars):**
```yaml
- name: api
  path: ./apps/api
  format: wrangler  # or dotenv
  exclude:
    - NEXT_PUBLIC_*
    - VITE_*
```

**Kubernetes:**
```yaml
- name: k8s
  path: ./k8s
  format: yaml
```

### Step 5: Create initial `.env` files

Create `.env` with shared secrets:

```bash
# .env
DATABASE_URL=postgres://localhost/mydb
API_KEY=your_api_key_here
NEXT_PUBLIC_API_URL=http://localhost:3000
```

Create `.env.development` for dev-specific values:

```bash
# .env.development  
DEBUG=true
LOG_LEVEL=debug
```

Create `.env.production` for production values:

```bash
# .env.production
DEBUG=false
LOG_LEVEL=error
```

### Step 6: Encrypt secrets

```bash
npx hush encrypt
```

This creates:
- `.env.encrypted`
- `.env.development.encrypted`
- `.env.production.encrypted`

### Step 7: Verify setup

```bash
npx hush status
npx hush inspect
```

### Step 8: Update `.gitignore`

Add these lines to `.gitignore`:

```gitignore
# Hush - plaintext env files (generated, not committed)
.env
.env.local
.env.development
.env.production
.dev.vars

# Keep encrypted files (these ARE committed)
!.env.encrypted
!.env.*.encrypted
```

### Step 9: Commit encrypted files

```bash
git add .sops.yaml hush.yaml .env*.encrypted .gitignore
git commit -m "chore: add Hush secrets management"
```

---

## Team Member Setup

### With 1Password (easiest)

```bash
npx hush keys setup
```

This automatically pulls the key from 1Password (triggers biometric auth).

### Without 1Password

1. **Get the private key** from an existing team member (via secure channel)
2. **Save it** to `~/.config/sops/age/keys/{project}.txt`
3. **Verify:** `npx hush status`

### Key sharing commands

```bash
hush keys list       # See all keys (local + 1Password)
hush keys push       # Push local key to 1Password (for sharing)
hush keys pull       # Pull key from 1Password
```

---

## Verification Checklist

After setup, verify everything works:

- [ ] `npx hush status` shows configuration
- [ ] `npx hush inspect` shows masked variables
- [ ] `npx hush decrypt` creates local env files
- [ ] `.env.encrypted` files are committed to git
- [ ] Plaintext `.env` files are in `.gitignore`

---

## Troubleshooting Setup

### "age: command not found"
```bash
brew install age  # macOS
```

### "sops: command not found"  
```bash
brew install sops  # macOS
```

### "Error: no matching keys found"
Your age key doesn't match. Get the correct private key from a team member.

### "hush.yaml not found"
Run `npx hush init` to generate configuration.

### "No sources defined in hush.yaml"
Edit `hush.yaml` and add your source files under `sources:`.
