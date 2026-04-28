---
name: hush-environment-topology
description: Comprehensive Hush v3 guide for dev teams structuring development, staging, and production secrets across services, bundles, targets, runtime config, deployment verification, copy/move workflows, and agent-safe Hush usage. Use when setting up Hush in a monorepo, designing service x environment secret topology, debugging target completeness, syncing Worker secrets, or deciding where a key should live.
allowed-tools: Bash(hush:*), Bash(npx hush:*), Bash(bun:*), Bash(npm:*), Bash(pnpm:*), Read, Grep, Glob
---

# Hush Environment Topology Guide

Use this skill when a team needs to structure Hush v3 secrets across `development`, `staging`, and `production`, especially in a monorepo with multiple deployable services.

This is a topology and operations guide. For basic secret safety rules, also load `hush-secrets`.

## Core decision

Hush v3 is **explicit service × environment topology**, not ambient inheritance.

The model:

| Concept | Security boundary? | Purpose |
| --- | --- | --- |
| File | YES | Encrypted document with readers/ACLs |
| Bundle | NO | Explicit grouping of files for runtime composition |
| Target | NO | Named consumer surface: process, deploy, Worker, export |

Files own access. Bundles package files. Targets consume bundles.

If a key exists in `env/project/production` but `api-production` does not import that file/bundle, `api-production` should not see it. That is correct. Fix the topology explicitly with an import, `copy-key`, or `move-key`.

## Naming convention

Use concrete service/environment names for runtime bundles and targets:

```text
api-development
api-staging
api-production
root-development
root-staging
root-production
landing-production
worker-production
```

Use `project-*` only for intentionally shared material:

```text
project-shared
project-development
project-staging
project-production
```

Do not use `project-production` as a dumping ground. A key belongs there only if more than one production service intentionally shares it.

## Recommended file layout

Typical monorepo:

```text
.hush/
  manifest.encrypted
  files/
    env/
      project/
        shared.encrypted
        development.encrypted
        staging.encrypted
        production.encrypted
      api/
        development.encrypted
        staging.encrypted
        production.encrypted
      root/
        development.encrypted
        staging.encrypted
        production.encrypted
```

Recommended ownership:

- `env/project/shared` — non-environment-specific shared config.
- `env/project/{development,staging,production}` — shared keys intentionally consumed by multiple services in that environment.
- `env/<service>/{development,staging,production}` — service-owned runtime keys.
- `artifacts/<service>/<environment>` — file or binary materialization subjects.

## Bundle and target shape

Each concrete service/environment should have a bundle and target.

Example:

```yaml
bundles:
  project-production:
    files:
      - path: env/project/production

  api-production:
    files:
      - path: env/api/production
    imports:
      - bundle: project-production

  root-production:
    files:
      - path: env/root/production
    imports:
      - bundle: project-production

targets:
  api-production:
    bundle: api-production
    format: wrangler

  root-production:
    bundle: root-production
    format: dotenv
```

This makes sharing explicit. If `root-production` should not receive an API secret, keep that secret in `env/api/production`, not `env/project/production`.

## Where should a key live?

Decision table:

| Key usage | Put it in |
| --- | --- |
| Only API production uses it | `env/api/production` |
| API staging only | `env/api/staging` |
| API dev only | `env/api/development` or local override if machine-specific |
| Root and API production both intentionally use it | `env/project/production`, imported by both bundles |
| Local developer-only override | machine-local override via `hush set --local` |
| Certificate/profile/file artifact | `artifacts/<service>/<environment>` |

Prefer **move** when ownership was wrong. Prefer **copy** when two files genuinely need separate values that currently start the same. Prefer **explicit import** when one shared key should remain single-source-of-truth.

## Safe commands

Never read `.env`, `.dev.vars`, or `.hush/**` directly. Use Hush commands.

Inspect structure:

```bash
hush status
hush config show --json
hush config show bundles
hush config show targets
hush config show files
```

Inspect resolved runtime without values:

```bash
hush resolve api-production
hush resolve api-production --json
hush trace RESEND_API_KEY
hush trace RESEND_API_KEY --json
```

Verify deploy completeness:

```bash
hush verify-target api-production \
  --require JWT_SECRET \
  --require BETTER_AUTH_SECRET \
  --require RESEND_API_KEY

hush verify-target api-production --require RESEND_API_KEY --json
```

Move/copy a key without exposing its value:

```bash
hush move-key RESEND_API_KEY \
  --from env/project/production \
  --to env/api/production

hush copy-key RESEND_API_KEY \
  --from env/project/production \
  --to env/api/production \
  --json
```

Run with secrets:

```bash
hush run -t api-development -- npm run dev
hush run -t api-production -- npm run build
hush run -t root-staging -- npm run preview
```

Push/sync remote runtime secrets:

```bash
hush verify-target api-production --require RESEND_API_KEY
hush push -t api-production --dry-run --verbose
hush push -t api-production
```

## Release automation contract

Before remote secret sync or traffic flip, release automation should:

1. Run `hush verify-target <target> --require ...`.
2. Run `hush resolve <target> --json` if it needs provenance metadata.
3. Run the platform-specific sync, for example `hush push -t api-production` for Wrangler targets.
4. Fail before deploy if any required key is missing, unreadable, or in conflict.

Do not rely on `hush set -e production KEY` intuition for service-specific runtime secrets. In v3, target visibility is determined by bundle/file topology.

## Common diagnoses

### Key exists but target cannot see it

Run:

```bash
hush trace KEY
```

If trace says the key exists in `env/project/production` but target bundle `api-production` does not resolve that file, choose one:

- key is API-owned: `hush move-key KEY --from env/project/production --to env/api/production`
- key is shared: add an explicit import from `api-production` to `project-production`
- key should be duplicated: `hush copy-key KEY --from ... --to ...`

### Target has too many secrets

Usually the target imports a shared bundle that contains service-specific keys. Move those keys out of `project-*` and into the service file.

### Staging uses production secrets

Create explicit `*-staging` files/bundles/targets. Do not overload production.

Use:

```text
env/api/staging
api-staging
target api-staging
```

Then verify:

```bash
hush verify-target api-staging --require DATABASE_URL --require RESEND_API_KEY
```

## Hard rules for agents

- Do not read `.env*`, `.dev.vars`, or `.hush/**` directly.
- Do not print or echo secret values.
- Do not use `hush list` for agent-readable output.
- Use `--json` outputs for automation because they contain structure and provenance, not scalar values.
- Do not invent ambient inheritance. Add explicit imports or use `copy-key`/`move-key`.
- Treat file readers as the security boundary.

## More detail

- See `REFERENCE.md` for command behavior and JSON shapes.
- See `examples/workflows.md` for concrete setup and release workflows.
