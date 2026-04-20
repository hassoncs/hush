# HUSH_V3_MIGRATION_STRATEGY

## Status

Planning document. Canonical source of truth for how the future Hush v3 architecture should be introduced, migrated, and handed off into shipped product documentation.

## Canonical Source of Truth

This file is the canonical migration plan for the Hush v3 planning effort.

Use this file to define rollout phases, compatibility expectations, migration sequencing, risks, and the handoff path from planning docs into shipped docs-site content.

Do not use existing shipped docs under `docs/src/content/docs/**` as the planning source of truth for this future migration. Those pages remain product docs for already released behavior.

## Versioning Note

This planning set intentionally uses a root-level `HUSH_V3_*` naming scheme even though the repository already contains shipped version history and a docs-site `v2-to-v3` migration page.

For this planning set, `HUSH_V3` refers to the future architecture initiative defined by the root-level planning docs. Any later user-facing migration page for shipped behavior should be derived from this plan, not treated as its replacement during planning.

## Planning Doc Topology

The migration strategy works in tandem with `docs/HUSH_V3_SPEC.md`.

| File | Primary responsibility |
| --- | --- |
| `docs/HUSH_V3_SPEC.md` | Defines the future architecture and product intent |
| `docs/HUSH_V3_MIGRATION_STRATEGY.md` | Defines how that architecture is introduced, staged, documented, and migrated |

This split is locked for the planning set. Existing docs-site pages remain shipped product docs, not draft planning artifacts.

## Section Ownership

This file owns the following sections for the planning set:

1. Migration goals and success criteria
2. Compatibility assumptions and transition boundaries
3. Rollout phases and sequencing
4. User and maintainer migration workstreams
5. Risk register and mitigation framing
6. Documentation handoff from root-level planning docs to shipped docs-site pages
7. Open migration questions that depend on future implementation detail

The spec owns architecture decisions. If a migration section starts redefining product behavior, move that material back into `docs/HUSH_V3_SPEC.md` and reference it from here.

## Decision-to-Section Coverage Matrix

Use this matrix to keep migration and adoption decisions explicitly assigned before prose is written.

| Locked decision or migration concern | Destination section | Notes for later writing |
| --- | --- | --- |
| Big-bang migration | `## Migration Strategy`, `### Big-Bang Migration` | Define why rollout is one-way, not phased by long-lived compatibility modes. |
| Required workflow commands | `## Operator Workflow and Required Commands` | Capture the required maintainer and user command workflow without redefining architecture. |
| Migration of unified encrypted config | `## Configuration Conversion Strategy`, `### Unified Config Adoption` | Explain how repos move to the new config shape. |
| Migration of roles, readers, and file-scoped ACLs | `## Configuration Conversion Strategy`, `### Access Model Adoption` | Explain adoption sequencing for the access model defined in the spec. |
| Migration of logical paths, bundles, and imports | `## Configuration Conversion Strategy`, `### Topology and Bundle Adoption` | Explain how existing layouts map to the new topology model. |
| Migration of explicit active identity pointer | `## Identity Transition Strategy` | Explain operator adoption and compatibility expectations. |
| Migration of signal-safe materialization and audit log expectations | `## Runtime Rollout and Verification` | Explain rollout checks and operator-visible verification points. |
| Docs handoff into shipped pages | `## Documentation Handoff` | Keep docs-site work downstream from these planning docs. |
| Preserved non-goals during migration | `## Transition Boundaries and Non-Goals` | Keep non-goals visible during adoption, not only in the spec. |

## Relationship to Shipped Docs

Shipped docs under `docs/src/content/docs/**` remain user-facing documentation for the released product line.

When the future architecture is ready to ship, the docs site can be updated from this migration plan and the spec. Until then, this file is the planning authority for migration topology, and docs-site pages should not be repurposed as the draft migration plan.

## File Map for Later Tasks

Later doc-authoring tasks should follow this routing:

- Put architecture and product-shape decisions in `docs/HUSH_V3_SPEC.md`
- Put migration sequencing, compatibility planning, and rollout detail in `docs/HUSH_V3_MIGRATION_STRATEGY.md`
- Treat any updates to `docs/src/content/docs/**` as downstream shipped-doc work after planning decisions are settled

## Migration Goals and Success Criteria

The migration goal is to move every adopted repository from the released v2 model to the future v3 model defined in `docs/HUSH_V3_SPEC.md` through a single big-bang cutover per repository.

Success means:

1. Each migrated repository lands fully on the v3 architecture with no v2 compatibility layer left in place.
2. The migration workflow is agent-driven, repeatable, and scoped to one project per agent session.
3. Every repository has a pre-migration inventory, a recorded migration result, and a validation result.
4. Shared migration friction is captured in `docs/migration/feedback.md` and repository completion is recorded in `docs/migration/completed.md`.
5. Downstream shipped docs are written only after the migration pattern is stable and validated against the canonical spec.

## Transition Boundaries and Non-Goals

This plan is intentionally narrow.

- It does define how repositories are migrated from v2 into the future v3 architecture.
- It does not redefine the architecture itself. `docs/HUSH_V3_SPEC.md` remains the canonical source for unified encrypted config, file-scoped ACLs, the `owner` / `member` / `ci` role model, explicit active identity pointer, pull-only imports, and artifact semantics.
- It does not treat `docs/src/content/docs/migrations/v2-to-v3.mdx` as planning authority. That page is historical shipped-doc context only.
- It does not allow a progressive rollout, long-lived feature flag, compat shim, or dual-support period. Those approaches are explicitly rejected here.
- It does not ask one agent session to migrate multiple repositories at once. One project per agent session is the required operating rule.

## Migration Strategy

The canonical migration strategy is big-bang and agent-driven.

Each repository is migrated in one bounded execution window from its v2 state to the v3 model. The repo does not enter a mixed mode where v2 and v3 are both supported for an extended period. Migration work may happen repository by repository across the broader ecosystem, but inside a given repository the cutover is one-way and complete.

### Big-Bang Migration

For the purposes of this planning set, `big-bang` means:

1. A repository starts from a known v2 baseline.
2. An agent performs a full migration pass for that repository using the standard prompt and workflow in this file.
3. The repository is validated against the v3 expectations.
4. The repository either lands fully on v3 or is rolled back to its pre-migration state.

The following are explicitly out of scope and should be rejected if proposed during execution:

- A v2 and v3 dual-support period inside the same repository
- Compatibility shims that preserve old config semantics during rollout
- Feature flags that keep the repository half-migrated
- Shipping user-facing docs-site guidance before the migration pattern is proven against the planning docs

The architecture source remains `docs/HUSH_V3_SPEC.md`. This file only defines how to move a repository onto that architecture.

## Rollout Phases and Sequencing

The rollout sequence is standardized so each repository follows the same shape.

### Phase 0: Prepare the migration batch

Maintain a candidate list of repositories that still use the v2 model. For each candidate, capture:

- Repository path or URL
- Primary maintainer if known
- Current v2 usage shape
- Known custom scripts or workflow edges
- Migration status: queued, in progress, blocking, completed, rolled back

This phase produces the migration queue, not implementation changes.

### Phase 1: Inventory one repository

A single agent session claims one repository and performs inventory only for that repository.

The inventory should record:

- Current Hush config files and encrypted files
- Current command usage in scripts, CI, and docs
- Current identity, reader, target, or output assumptions that need mapping to the v3 model
- Any local repository constraints that might create blocking migration work

If the repository cannot be inventory-scoped cleanly, classify that as blocking and stop before changing code.

### Phase 2: Execute the repository migration

Run `hush migrate --from v2` in the repository-specific migration workflow once the inventory is complete and blockers are understood.

This phase converts the repository to the v3 structure described by `docs/HUSH_V3_SPEC.md`, updates repo-local workflow references, and removes v2-only assumptions from the migrated repository.

### Phase 3: Validate and classify outcomes

Validation decides whether the repository is complete, blocking, or rolled back.

- If all required checks pass, append the result to `docs/migration/completed.md`.
- If blocking issues prevent a safe landing, roll back the repository and log the issue in `docs/migration/feedback.md`.
- If issues are non-blocking, keep the repository on v3, record the follow-up in `docs/migration/feedback.md`, and mark the migration complete with notes.

### Phase 4: Cleanup and downstream docs handoff

After validation passes, run the cleanup pass with `hush migrate --from v2 --cleanup` and remove migration-only leftovers from the repository.

Once several migrations have converged on the same stable pattern, convert the root-level planning guidance into shipped docs-site content as a separate docs handoff task.

## Operator Workflow and Required Commands

The workflow below is the required default for maintainers and migration agents.

### Standard per-repository workflow

1. Claim exactly one repository for the current agent session.
2. Inventory the repository and map v2 usage to the v3 model described in `docs/HUSH_V3_SPEC.md`.
3. Record any expected hazards before editing.
4. Run the migration path anchored on `hush migrate --from v2`.
5. Run the validation checklist in this file.
6. If validation passes, run `hush migrate --from v2 --cleanup`.
7. Append completion or friction notes to the shared migration logs.

### Standard agent prompt

Use this exact prompt shape when dispatching a migration agent for a repository:

```text
Migrate this repository from Hush v2 to the future Hush v3 model.

Rules:
- This is a big-bang migration. Do not leave a dual-support period.
- Do not introduce a compatibility layer or feature-flagged fallback.
- One project per agent session.
- Use docs/HUSH_V3_SPEC.md as the canonical architecture source.
- Use docs/HUSH_V3_MIGRATION_STRATEGY.md as the canonical migration workflow.
- Treat docs/src/content/docs/migrations/v2-to-v3.mdx as historical shipped-doc context only.
- Start with an inventory of current v2 usage.
- If you hit a blocking issue, stop, record it in docs/migration/feedback.md, and roll back repo changes.
- If an issue is non-blocking, finish the migration, note it in docs/migration/feedback.md, and continue.

Required workflow:
1. Inventory the repository.
2. Run the migration flow anchored on hush migrate --from v2.
3. Validate the migrated repository.
4. Run hush migrate --from v2 --cleanup after validation passes.
5. Append the result to docs/migration/completed.md.
```

### Shared feedback log workflow

All migration sessions write to the same planning-owned logs.

- `docs/migration/feedback.md` stores migration friction, follow-up items, repeated hazards, blocking failures, and non-blocking issues.
- `docs/migration/completed.md` stores one entry per repository that successfully landed on v3.

Each entry in `docs/migration/feedback.md` should include:

- Repository name
- Date
- Agent or maintainer identifier if useful
- Classification: blocking or non-blocking
- Short description of the issue
- Resolution status or next action

Each entry in `docs/migration/completed.md` should include:

- Repository name
- Date
- Migration commit or reference if available
- Validation result summary
- Whether cleanup completed

## Configuration Conversion Strategy

This section describes migration mapping only. It does not reopen architecture decisions that already live in `docs/HUSH_V3_SPEC.md`.

### Unified Config Adoption

Each migrated repository moves from the v2 layout into the unified encrypted config model defined by `docs/HUSH_V3_SPEC.md`.

Migration work should:

- Identify every v2 config file and secret source that feeds the current repository
- Convert those sources into the unified encrypted config without leaving a parallel plaintext config tier behind
- Remove repo-local assumptions that the old split config shape still exists after cutover

### Access Model Adoption

Each migrated repository must map its current access expectations onto the spec-defined file-scoped readers model.

Migration work should:

- Split values into separate encrypted files when different audiences require different readers
- Adopt the locked role vocabulary `owner`, `member`, and `ci`
- Reject any attempt to preserve path-glob ACL behavior as a compatibility shortcut

The access model itself is owned by `docs/HUSH_V3_SPEC.md`. This migration plan only defines how repositories adopt it.

### Topology and Bundle Adoption

Migration work should map current repository layout assumptions into the v3 topology model without inventing interim compatibility structures.

That includes:

- Moving from old path or target conventions into the spec-defined logical path and file model
- Adopting bundle and import structure according to the canonical spec
- Removing obsolete repo-local layout glue during the same cutover instead of carrying it forward as transitional debt

## Identity Transition Strategy

Each migrated repository must adopt the explicit active identity pointer workflow described in `docs/HUSH_V3_SPEC.md`.

Migration work should:

- Identify the current implicit identity assumptions in local scripts and CI
- Replace those assumptions with explicit v3 identity handling
- Verify that local operator flows and CI flows both resolve against the intended active identity

Identity semantics belong to the spec. This migration strategy only requires repositories to land on that explicit model during cutover.

## Runtime Rollout and Verification

Runtime verification confirms that the repository behaves correctly after migration and that migration debt is not being hidden by leftover v2 behavior.

### Validation checklist

Every repository migration should pass all of the following checks before it is marked complete:

1. The repository no longer depends on a v2 compatibility layer, shim, or dual-support path.
2. The repository structure matches the v3 migration target described by `docs/HUSH_V3_SPEC.md`.
3. Repository-local scripts, CI workflows, and maintainer instructions reference the migrated workflow rather than the old v2 workflow.
4. Identity selection is explicit where the v3 model requires it.
5. File-scoped access behavior is validated for the expected readers.
6. Runtime materialization succeeds for the intended targets or artifacts.
7. Signal-safe cleanup and audit-visible behaviors are exercised where the implementation provides them.
8. Cleanup passes successfully via `hush migrate --from v2 --cleanup`.
9. The migration result and any issues are logged in the shared migration files.

If any required validation item fails and cannot be corrected safely inside the migration window, classify the issue as blocking.

## Risk Register and Mitigations

The main migration risks are execution risks, not architecture uncertainty. Architecture intent already belongs in `docs/HUSH_V3_SPEC.md`.

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Mixed-mode migration | Leaves the repository in an ambiguous state | Reject dual-support and compat-shim approaches up front |
| Hidden repo-local workflow drift | Scripts or CI may keep assuming v2 behavior | Require inventory before edits and validation after cutover |
| Multi-repo session sprawl | Context bleed causes incorrect migration decisions | Enforce one project per agent session |
| Repeated migration friction goes untracked | Each repo rediscovers the same failure | Require append-only logging in `docs/migration/feedback.md` |
| Cleanup skipped after successful migration | Transitional leftovers remain and mask debt | Make `--cleanup` part of the required completion workflow |

### Blocking vs non-blocking classification

Use the following rule consistently.

An issue is `blocking` when it prevents the repository from landing safely and fully on the v3 model during the current migration window. Examples include:

- The repository cannot be mapped to the spec-defined model without unresolved architecture ambiguity
- Validation failures show the repository still depends on v2 behavior
- Required runtime or access checks fail and no safe fix is available in the session

An issue is `non-blocking` when the repository has landed safely on v3 and the remaining work is follow-up polish, documentation refinement, or implementation hardening that does not require reverting the cutover.

Blocking issues require rollback plus an entry in `docs/migration/feedback.md`.
Non-blocking issues require a feedback entry but do not prevent completion.

## Rollback Strategy

Rollback is repository-scoped and immediate. There is no rollback through a compatibility layer.

If a migration becomes blocking:

1. Stop further repository edits.
2. Restore the repository to its pre-migration state using the branch, commit, or worktree baseline captured before the cutover.
3. Record the failure in `docs/migration/feedback.md` with `blocking` classification and enough detail for the next attempt.
4. Return the repository to the migration queue instead of leaving it partially converted.

The rollback goal is a clean return to the last known v2 baseline, not a temporary mixed v2/v3 state.

## Cleanup

Cleanup is part of the canonical migration, not optional polish.

After a repository passes validation, run `hush migrate --from v2 --cleanup` and remove migration-only leftovers such as:

- Deprecated config fragments that were only needed to understand the old v2 shape
- Temporary conversion helpers created during the cutover
- Obsolete maintainer notes that describe the pre-migration workflow

Do not run `--cleanup` before validation passes. Cleanup belongs at the end of a successful big bang migration.

## Documentation Handoff

This file and `docs/HUSH_V3_SPEC.md` remain the planning authority until the migration pattern has stabilized.

Docs handoff happens after repeated migrations confirm that the plan is correct.

The handoff sequence is:

1. Review `docs/migration/feedback.md` and `docs/migration/completed.md` for repeated patterns.
2. Update root-level planning docs if the migration workflow needs clarification.
3. Draft shipped docs-site pages from the stabilized planning docs.
4. Publish docs-site content as downstream product documentation, not as replacement planning authority.

The shipped docs-site migration page must be derived from this file and `docs/HUSH_V3_SPEC.md`, not the other way around.

## Open Migration Questions

Open questions in this file should stay migration-owned.

Current open questions:

1. What exact inventory template should be standardized for migration agents across repositories?
2. What minimum validation evidence should be copied into `docs/migration/completed.md` for each completed repository?
3. Which repeated non-blocking issues should trigger a planning-doc update before the next migration batch?

## Opening Guidance for Follow-on Authors

When extending this migration plan, preserve these rules:

1. Keep this file as the canonical migration source of truth.
2. Keep current docs-site pages in their shipped-doc role.
3. Reference `docs/HUSH_V3_SPEC.md` for architecture intent instead of duplicating it here.
4. Preserve the big-bang, no-compatibility migration stance unless the planning set is explicitly re-approved.
5. Keep one project per agent session as the standard operating rule.
6. Treat `docs/migration/feedback.md` and `docs/migration/completed.md` as append-only shared migration logs.
