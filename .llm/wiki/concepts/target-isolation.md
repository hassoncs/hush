# Concept: Target Isolation

> Named consumers receive only bundle-defined secrets — nothing more, nothing less.

## What It Is

A **Target** is a named consumer surface for resolved configuration. Targets define WHERE config goes and HOW artifacts should be shaped. They do not define who can read secrets — that's the file ACL's job.

## Target Definition

```typescript
// hush-cli/src/v3/domain.ts:HushTargetDefinition
interface HushTargetDefinition {
  bundle?: HushBundleName;    // Which bundle to resolve from
  path?: HushLogicalPath;     // Or a specific logical path
  format: HushArtifactFormat; // Output format (dotenv, wrangler, json, env, etc.)
  mode?: 'process' | 'file' | 'example';  // Materialization mode
  filename?: string;          // For file mode: output filename
  subpath?: string;           // Relative subpath for materialization
  materializeAs?: string;     // Override materialization path
}
```

## Resolution Flow

When a target is resolved via `resolveV3Target()`:

1. **Lookup target** from `repository.manifest.targets[targetName]`
2. **Validate target** — must reference a bundle or path, must have a format
3. **Resolve the referenced bundle** via `resolveV3Bundle()`
4. **Return the bundle resolution** augmented with the target name

```typescript
// hush-cli/src/v3/resolver.ts lines 297-317
export function resolveV3Target(ctx, options): HushTargetResolution {
  const target = options.repository.manifest.targets?.[options.targetName];
  // validation...
  const bundleResolution = resolveV3Bundle(ctx, {
    ...options,
    bundleName: target.bundle,
  });
  return { ...bundleResolution, target: options.targetName };
}
```

## Isolation Properties

Targets provide isolation through **bundle composition**:

1. **Only bundle files are included** — A target only receives secrets from files explicitly referenced by its bundle
2. **ACLs still enforced** — If the active identity can't read a file the bundle references, resolution fails
3. **Format shapes output** — The target's `format` determines how resolved values are emitted (dotenv = `KEY=VALUE`, json = JSON object, wrangler = Cloudflare vars format)
4. **No cross-target leakage** — Secrets defined for one target's bundle never appear in another target's resolution

## Target Selection at Runtime

`selectRuntimeTarget()` (in `hush-cli/src/commands/v3-command-helpers.ts`) determines which target to use:
1. If `-t <target>` is specified, use that target
2. Otherwise, find the first target with `mode: 'runtime'` or a default target

## Example Target Definitions

```yaml
targets:
  web-dev:
    bundle: web-runtime
    format: dotenv          # Environment variables for dev server

  api-run:
    bundle: api-runtime
    format: env             # Process-env injection

  ios-signing:
    bundle: fitbot-signing
    format: binary          # Certificates/key files
    mode: file              # Write to disk (not memory)
```

## Target vs Bundle vs File (Boundary Summary)

| Concept | Is it a security boundary? | Purpose |
|---------|---------------------------|---------|
| **File** | **YES** | Encrypted document with ACLs |
| **Bundle** | NO | Organizational composition of files |
| **Target** | NO | Consumer surface for resolved config |

A target consumes a bundle, which consumes files, which enforce ACLs. The security boundary is always the file.

## Service × Environment Topology Guidance

For monorepos, prefer concrete service/environment bundle and target names such as `api-development`, `api-staging`, `api-production`, `root-staging`, and `root-production`. Use `project-*` only for material that is intentionally shared across services, such as `project-shared`, `project-staging`, or `project-production`.

Hush does **not** use ambient inheritance. If a secret exists in `env/project/production` but a target resolves the `api-production` bundle, the secret should remain invisible unless `api-production` explicitly imports the bundle/file or the key is copied/moved into an API-owned file. This is intentional: target completeness should be verified, not guessed from nearby project files.

Useful diagnostics:

- `hush trace <KEY>` explains when a key exists in another file but is not selected by a target bundle.
- `hush trace <KEY> --json` exposes the same reachability diagnosis for agents/CI without values.
- `hush verify-target <target> --require <KEY>` verifies a release target resolves required leaf keys before remote secret sync or deploy.
- `hush copy-key <KEY> --from <file> --to <file>` and `hush move-key <KEY> --from <file> --to <file>` relocate a key between encrypted v3 file documents without printing its value.
- `hush config show --json` and `hush resolve <target> --json` provide machine-readable structure/provenance without decrypted scalar values.

For team onboarding or project-agent guidance, point agents at `.claude/skills/hush-environment-topology/`. That skill packages the service × environment naming rules, release verification contract, and safe copy/move workflows in a reusable form.

> Sources: `hush-cli/src/v3/domain.ts` (lines 115-123, 340-354) — `HushTargetDefinition`, `createTargetDefinition`; `hush-cli/src/v3/resolver.ts` (lines 297-317) — `resolveV3Target`; `docs/HUSH_V3_SPEC.md` (lines 305-313) — target model description; `hush-cli/src/commands/run.ts` (lines 32-33) — `selectRuntimeTarget` usage
