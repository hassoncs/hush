# Hush Environment Topology Reference

This reference explains the current Hush v3 model for development, staging, and production secrets.

## V3 primitives

| Primitive | Meaning |
| --- | --- |
| Identity | Actor used for ACL checks and audit attribution |
| File | Encrypted document and ACL boundary |
| Path | Logical address inside a file, e.g. `env/api/production/DATABASE_URL` |
| Bundle | Explicit composition of files and imports |
| Target | Consumer surface that resolves one bundle/path into runtime output |
| Artifact | File/binary materialization subject |

## File naming

Use this base pattern:

```text
env/<scope>/<environment>
```

Examples:

```text
env/project/shared
env/project/development
env/project/staging
env/project/production
env/api/development
env/api/staging
env/api/production
env/root/production
```

Use `project-*` for shared project-wide material only. Use service names for service-owned keys.

## Bundle naming

Use this pattern:

```text
<service>-<environment>
```

Examples:

```text
api-development
api-staging
api-production
root-development
root-staging
root-production
```

Shared bundles:

```text
project-shared
project-development
project-staging
project-production
```

## Target naming

Targets should usually match the concrete runtime surface:

```yaml
targets:
  api-production:
    bundle: api-production
    format: wrangler
  root-production:
    bundle: root-production
    format: dotenv
```

This keeps release automation obvious: the API production deploy uses target `api-production`.

## Runtime resolution flow

Every runtime command follows this conceptual flow:

1. Resolve active identity.
2. Load the target and its bundle.
3. Collect files from the bundle and explicit imports.
4. Check file readers against the active identity.
5. Select winning logical paths by precedence.
6. Resolve interpolation.
7. Split values and artifacts.
8. Materialize to memory, a file output, or platform sync.

`hush run` uses memory-only injection. It does not write plaintext env files.

## Command reference

### Structure

```bash
hush status
hush config show
hush config show --json
hush config show bundles
hush config show targets
hush config show files
```

`config show --json` is safe for agents. It exposes structure, not values.

### Set values

```bash
hush set DATABASE_URL --gui
hush set API_KEY --local
hush set RESEND_API_KEY -e production
```

Note: `-e production` writes to the default project production file. For service-specific files, prefer `copy-key`/`move-key` or edit the intended encrypted document through Hush-managed workflows.

### Move/copy values safely

```bash
hush copy-key KEY --from env/project/production --to env/api/production
hush move-key KEY --from env/project/production --to env/api/production
```

These commands re-encrypt the touched documents and never print the value.

### Diagnose visibility

```bash
hush trace KEY
hush trace KEY --json
hush resolve api-production
hush resolve api-production --json
```

Use `trace` when the question is: “Where does this key live and which targets can see it?”

Use `resolve` when the question is: “What does this target receive?”

### Verify release completeness

```bash
hush verify-target api-production \
  --require JWT_SECRET \
  --require BETTER_AUTH_SECRET \
  --require RESEND_API_KEY
```

JSON shape includes:

```json
{
  "ok": true,
  "target": "api-production",
  "bundle": "api-production",
  "identity": "owner-local",
  "files": ["env/api/production"],
  "resolvedLogicalPaths": [],
  "resolvedKeys": {},
  "required": ["RESEND_API_KEY"],
  "missing": [],
  "conflicts": []
}
```

No secret values are included.

### Run/push/materialize

```bash
hush run -t api-development -- npm run dev
hush push -t api-production --dry-run --verbose
hush push -t api-production
hush materialize -t ios-signing --json --to /tmp/signing
```

Use `materialize` only when a tool needs files. Prefer `hush run` for process env.

## Import vs copy vs move

| Situation | Operation |
| --- | --- |
| One shared key should stay single-source-of-truth | Explicit bundle/file import |
| Key was placed in the wrong owner file | `hush move-key` |
| Key should start duplicated but diverge later | `hush copy-key` |
| Service should not receive shared bundle contents | Move service-specific keys out of `project-*` |

## Anti-patterns

- Putting all production keys into `project-production`.
- Naming targets only `production` when multiple services deploy.
- Assuming `-e production` means every production target can see the key.
- Importing a broad shared bundle that contains service-specific keys.
- Using staging deploys with production files.
- Reading `.hush/**` or `.env*` directly.

## CI/release checklist

For each deploy target:

```bash
hush status
hush verify-target <target> --require KEY1 --require KEY2 --json
hush resolve <target> --json
hush push -t <target> --dry-run --verbose
```

Fail the deploy before traffic flips if verification fails.
