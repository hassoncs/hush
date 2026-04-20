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
