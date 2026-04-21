# Hush v3 Migration Feedback Log

Purpose: append shared migration friction for Hush v3 cutovers. Use this file for both `blocking` and `non-blocking` issues found during a single repository migration session.

## Append-only rules

- Append new entries at the end of this file.
- Do not rewrite or collapse earlier entries.
- Record one friction item per entry.
- Use `blocking` when the repository was rolled back or could not land safely on v3.
- Use `non-blocking` when the repository landed on v3 and the issue became follow-up work.

## Entry template

```md
## Repository: <repo-name>

- Date: YYYY-MM-DD
- Agent or maintainer: <identifier if useful>
- Classification: blocking | non-blocking
- Issue: <short description>
- Resolution status or next action: <rolled back | fixed in session | follow-up needed>
```

## Entries

Append the next feedback entry below this heading.

## Repository: hush

- Date: 2026-04-20
- Agent or maintainer: Sisyphus-Junior
- Classification: non-blocking
- Issue: Final Wave follow-up found stale shipped docs still teaching legacy `hush.yaml` / `init` / `encrypt` / include-exclude targets, plus hardening gaps in `push.ts` shell secret piping and `core/sops.ts` plaintext temp staging.
- Resolution status or next action: fixed in session; docs now teach the current `.hush/` v3 model, `push.ts` uses direct wrangler args plus stdin, and plaintext staging now uses a private restrictive temp directory with cleanup.

## Repository: hush

- Date: 2026-04-20
- Agent or maintainer: Sisyphus-Junior
- Classification: non-blocking
- Issue: Final Wave blocker found mutation helpers and config metadata updates still allowed non-owner identities to write, and repo-local setup docs still described legacy `hush.yaml` / `init` / `encrypt` as the current architecture.
- Resolution status or next action: fixed in session; `requireMutableIdentity()` now enforces owner role for v3 mutations, `config readers` uses the shared owner gate, denial tests cover `set` / `edit` / `config readers`, and repo-local docs now describe `.hush/` bootstrap/config/run as the live model.
