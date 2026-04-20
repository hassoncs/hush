# Hush v3 Migration Completed Log

Purpose: append one successful repository cutover per entry after the repository lands on Hush v3 and validation is complete.

## Append-only rules

- Append new entries at the end of this file.
- Do not rewrite or merge earlier entries.
- Add one successful repository cutover per append.
- Record this entry after validation finishes.
- Include whether `hush migrate --from v2 --cleanup` completed.

## Entry template

```md
## Repository: <repo-name>

- Date: YYYY-MM-DD
- Migration commit or reference: <commit hash, branch, PR, or n/a>
- Validation result summary: <short summary of checks that passed>
- Cleanup completed: yes | no
```

## Entries

Append the next completed cutover entry below this heading.
