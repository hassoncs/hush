# Topic: Identity-Based Access Control

> File-scoped ACLs with roles and explicit identities.

## Overview

Hush v3's access model is intentionally simple: **files are the security boundary**. ACLs attach to encrypted files, not to individual paths. There are no path-glob ACLs or per-path reader policies.

## Role Model

Three locked roles defined in `hush-cli/src/v3/schema.ts`:

| Role | Purpose |
|------|---------|
| `owner` | May manage file metadata, readers, values, and topology within the file |
| `member` | May read files and participate in normal local runtime workflows |
| `ci` | May read files for automation and non-interactive execution |

This spec does not introduce custom roles, policy DSLs, or dynamic policy engines.

## Readers Structure

Each encrypted file carries its own readers metadata (`hush-cli/src/v3/domain.ts:HushReaders`):

```yaml
readers:
  roles: [owner, member, ci]
  identities: [developer-local, teammate-local, ci]
```

- **`roles`** — Which roles are allowed to read this file
- **`identities`** — Explicit identity names allowed regardless of role

## Access Check

`isIdentityAllowed()` (`hush-cli/src/v3/domain.ts`, line 407):

```typescript
export function isIdentityAllowed(
  readers: HushReaders,
  identity: HushIdentityName,
  role: HushRole
): boolean {
  return readers.identities.includes(identity) || readers.roles.includes(assertHushRole(role));
}
```

An identity can read a file if:
1. Their identity name is in `readers.identities`, OR
2. One of their assigned roles is in `readers.roles`

## Identity Resolution

Identities are named actors declared in the manifest (`hush-cli/src/v3/domain.ts:HushIdentityRecord`):

```yaml
identities:
  developer-local:
    roles: [owner]
  teammate-local:
    roles: [member]
  ci:
    roles: [ci]
```

Each identity record maps to a set of roles. The role set is resolved by `getIdentityRoles()` in the resolver:

```typescript
function getIdentityRoles(repository, identity): string[] {
  const record = repository.manifest.identities[identity];
  if (!record) {
    throw new Error(`Identity "${identity}" is not declared...`);
  }
  return record.roles;
}
```

## Active Identity Selection

The active identity can come from:
1. Explicit `activeIdentity` option passed to resolution
2. `requireActiveIdentity()` which reads from the store context (machine-local or repo-local state)

The manifest's `activeIdentity` field serves as a stored selector, not the sole determinant.

## File-Scoped ACL Properties

Consequences of file-scoped ACLs:

1. **Different audiences → different files**: Secrets with different reader sets belong in separate encrypted files.
2. **Bundle composition doesn't weaken ACLs**: A bundle may combine files with different readers, but each file's ACL is still enforced individually.
3. **Export fails on unreadable files**: If an identity cannot read every required file for a target, materialization fails.
4. **Moving between files = access change**: Moving a value between files changes the ACL boundary and should be visible in diff/audit.

## Creation Validation

`createFileDocument()` and `createReaders()` validate readers data during document creation:
- `assertRoleList()` validates all roles are from the locked set
- `assertIdentityList()` validates identity names are non-empty

## Non-Goals

- No path-glob ACLs
- No custom role authoring
- No policy DSLs
- No dynamic policy engines

> Sources: `hush-cli/src/v3/domain.ts` (lines 41-44, 407-409, 248-252, 401-405) — `HushReaders`, `isIdentityAllowed`, `createReaders`, `createIdentityRecord`; `hush-cli/src/v3/resolver.ts` (lines 39-51, 115) — `getIdentityRoles`, `canReadFile`, readability partition; `docs/HUSH_V3_SPEC.md` (lines 216-252) — access model, roles, readers semantics, file-scoped ACLs
