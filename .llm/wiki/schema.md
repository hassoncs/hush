# Schema — Writing Rules

> How to read and extend this wiki correctly.

## Normative vs Implementation

This wiki separates **normative rules** (what the system MUST do) from **implementation details** (how the system currently does it). When in conflict, normative rules are the truth.

### Normative Rules (invariant across versions)

These are guarantees the system provides regardless of how the code changes:

- **No plaintext at rest**: All config values are encrypted on disk via SOPS+age.
- **File-scoped ACLs**: Access control is decided at the encrypted file level, not per-path.
- **Memory-only runtime**: `hush run` injects secrets into the child process via environment variables only; no plaintext files are written.
- **Signal-safe cleanup**: Temporary state must be cleaned up on normal exit, SIGTERM, SIGINT.
- **Bundle is not a security boundary**: Bundles are organizational; file ACLs remain authoritative.
- **Target is not a security boundary**: Targets consume resolved config; they don't define who can read.
- **Import is pull-only**: Imported content never pushes itself into bundles.
- **Sensitive metadata is not ACL**: `sensitive: true/false` affects redaction in output, never access control.

### Implementation Details (version-dependent)

These describe the current state of the code and may change:

- CLI argument parsing uses a custom `parseArgs()` function (not a library).
- SOPS is called via `execSync`/`spawnSync` shell invocations.
- Dependency injection uses `HushContext` with `ctx.fs`, `ctx.exec`, `ctx.onepassword`, etc.
- Resolution uses precedence integers: local=200, imported=100.
- Age key files stored at `~/.config/sops/age/keys/{project}.txt`.
- Audit log is local append-only JSONL.

## Source Attribution

Every wiki article MUST include per-section source attribution. Use this format at the end of each section:

```
> Sources: `path/to/file.ts` (line ranges or function names)
```

Do not use generic phrases like "the codebase shows" or "the documentation says." Cite exact file paths relative to the repository root.

## When Updating the Wiki

1. **Read the source** — never write wiki content without reading the relevant source files.
2. **Distinguish norm from impl** — if describing a constraint, mark it as either a normative rule or an implementation detail.
3. **Cite sources** — add source attribution to every section.
4. **Update CONTEXT.md quick-start** — if adding a new topic or concept, add a cross-reference to the task table.

## Terminology Consistency

Use the canonical V3 primitives from `docs/HUSH_V3_SPEC.md`:

| Correct | Incorrect |
|---------|-----------|
| File (encrypted document) | "secret file", "config file" (ambiguous) |
| File-scoped ACL | "path ACL", "reader policy" |
| Bundle | "secret group", "config group" |
| Target | "environment", "deployment" (confusing with env flag) |
| Active identity | "current user", "context" |
