# Hush Environment Topology Workflows

## New monorepo setup

Goal: one Hush repository with explicit service × environment targets.

```bash
hush bootstrap
hush status
hush config show --json
```

Create or update encrypted docs through Hush-managed commands. For initial simple writes:

```bash
hush set SHARED_PUBLIC_BASE_URL --gui
hush set DATABASE_URL -e production --gui
```

Then organize service-owned production keys into service files:

```bash
hush move-key DATABASE_URL --from env/project/production --to env/api/production
```

Recommended targets:

```text
api-development
api-staging
api-production
root-development
root-staging
root-production
```

## Add staging without reusing production

Do not point staging at production files.

Use explicit staging files and targets:

```text
env/project/staging
env/api/staging
api-staging
```

Verify staging independently:

```bash
hush verify-target api-staging \
  --require DATABASE_URL \
  --require RESEND_API_KEY

hush run -t api-staging -- npm run smoke:test
```

## Fix “secret exists but deploy target cannot see it”

Symptom:

```bash
hush trace RESEND_API_KEY
```

Trace reports the key exists in `env/project/production`, but `api-production` is `not selected by target bundle`.

Decision:

1. If only API uses the key:

   ```bash
   hush move-key RESEND_API_KEY \
     --from env/project/production \
     --to env/api/production
   ```

2. If API and root both intentionally share it:
   - Keep it in `env/project/production`.
   - Ensure both service bundles explicitly import `project-production`.

3. If two services should start with same value but diverge later:

   ```bash
   hush copy-key RESEND_API_KEY \
     --from env/project/production \
     --to env/api/production
   ```

Verify:

```bash
hush verify-target api-production --require RESEND_API_KEY
```

## Production deploy guardrail

Before syncing remote Worker secrets or flipping traffic:

```bash
hush verify-target api-production \
  --require JWT_SECRET \
  --require BETTER_AUTH_SECRET \
  --require RESEND_API_KEY \
  --json

hush resolve api-production --json
hush push -t api-production --dry-run --verbose
```

Only deploy if verification succeeds.

## Agent-safe troubleshooting loop

Use this loop when an AI agent is working on Hush topology:

```bash
hush status
hush config show --json
hush trace <KEY> --json
hush resolve <target> --json
hush verify-target <target> --require <KEY> --json
```

Forbidden:

```bash
cat .env
cat .dev.vars
cat .hush/manifest.encrypted
cat .hush/files/**/*.encrypted
hush list
```

## Target review checklist

For each target:

- target name is concrete: `service-environment`
- target references the matching bundle
- bundle includes service-owned file
- bundle imports only genuinely shared `project-*` files
- `hush verify-target` covers release-required keys
- `hush trace` explains any key that is missing
- no staging target resolves production-only files
