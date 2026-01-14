# Hush Workflow Examples

Step-by-step examples for common AI assistant workflows when working with secrets.

## Checking Configuration

### "What environment variables does this project use?"

```bash
hush inspect
```

Read the output to see all configured variables, their approximate lengths, and which targets receive them.

### "Is the database configured?"

```bash
hush has DATABASE_URL
```

If the output says "not found", guide the user to add it.

### "Are all required secrets set?"

```bash
# Check each required secret
hush has DATABASE_URL -q || echo "Missing: DATABASE_URL"
hush has API_KEY -q || echo "Missing: API_KEY"
hush has STRIPE_SECRET_KEY -q || echo "Missing: STRIPE_SECRET_KEY"
```

Or check all at once:
```bash
hush has DATABASE_URL -q && \
hush has API_KEY -q && \
hush has STRIPE_SECRET_KEY -q && \
echo "All secrets configured" || \
echo "Some secrets missing"
```

---

## Helping Users Add Secrets

### "Help me add a new API key"

1. **Check if it already exists:**
   ```bash
   hush has NEW_API_KEY
   ```

2. **If not set, guide the user:**
   > To add `NEW_API_KEY`, run:
   > ```bash
   > hush edit
   > ```
   > Add a line like: `NEW_API_KEY=your_actual_key_here`
   > Save and close the editor, then run:
   > ```bash
   > hush encrypt
   > ```

3. **Verify it was added:**
   ```bash
   hush has NEW_API_KEY
   ```

### "I need to add secrets for production"

Guide the user:
> Run `hush edit production` to edit production secrets.
> After saving, run `hush encrypt` to encrypt the changes.
> To deploy, run `hush decrypt -e production`.

---

## Debugging Issues

### "My app can't find DATABASE_URL"

1. **Check if the variable exists:**
   ```bash
   hush has DATABASE_URL
   ```

2. **If it exists, check target distribution:**
   ```bash
   hush inspect
   ```
   Look at the "Target distribution" section to see which targets receive it.

3. **Check if it's filtered out:**
   ```bash
   cat hush.yaml
   ```
   Look for `include`/`exclude` patterns that might filter the variable.

4. **Regenerate env files:**
   ```bash
   hush decrypt
   ```

### "Secrets aren't reaching my API folder"

1. **Check target configuration:**
   ```bash
   hush status
   ```
   Verify the API target path and format are correct.

2. **Check filters:**
   ```bash
   cat hush.yaml
   ```
   If there's an `exclude: EXPO_PUBLIC_*` pattern, that's intentional.
   If there's an `include` pattern, only matching variables are sent.

3. **Run inspect to see distribution:**
   ```bash
   hush inspect
   ```

---

## Deployment Workflows

### "Deploy to production"

```bash
# Decrypt production secrets to all targets
hush decrypt -e production
```

### "Push secrets to Cloudflare Workers"

```bash
# Preview what would be pushed
hush push --dry-run

# Actually push (requires wrangler auth)
hush push
```

### "Verify before deploying"

```bash
# Check all encrypted files are up to date
hush check

# If drift detected, encrypt first
hush encrypt

# Then decrypt for production
hush decrypt -e production
```

---

## Team Workflows

### "New team member setup"

Guide them:
> 1. Get the age private key from a team member
> 2. Save it to `~/.config/sops/age/key.txt`
> 3. Run `hush decrypt` to generate local env files
> 4. Start developing!

### "Someone added new secrets, my app is broken"

```bash
# Pull latest changes
git pull

# Regenerate env files
hush decrypt
```

### "Check if I forgot to encrypt changes"

```bash
hush check
```

If drift detected:
```bash
hush encrypt
git add .env*.encrypted
git commit -m "chore: encrypt new secrets"
```

---

## Understanding the Output

### hush inspect output explained

```
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
```

**Reading this:**
- `DATABASE_URL` is set, starts with "post", is 45 characters (likely a postgres:// URL)
- `STRIPE_SECRET_KEY` starts with "sk_t" (Stripe test key format)
- `API_KEY` is not set - user needs to add it
- The `app` folder only gets `EXPO_PUBLIC_*` variables
- The `api` folder gets everything except `EXPO_PUBLIC_*`

### hush has output explained

```bash
$ hush has DATABASE_URL
DATABASE_URL is set (45 chars)

$ hush has MISSING_VAR
MISSING_VAR not found
```

The character count helps identify if the value looks reasonable (e.g., a 45-char DATABASE_URL is plausible, a 3-char one might be wrong).
