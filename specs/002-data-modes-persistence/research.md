# Safe Mode Switching: Design Decisions

## Pending-operation boundary

- Decision: enforce blocking in the existing Journey provider and reflect it in Settings.
- Rationale: pending operations outlive individual pages; direct callers must also
  be protected, including same-tick requests and overlapping operations.
- Alternatives: disabling only the selector misses direct calls; allowing switches
  with generation-tagged write results was rejected by the owner's choice to block.

## Dirty drafts

- Decision: reuse editor dirty comparisons and existing discard-confirmation
  conventions, with transient shared coordination only where required.
- Rationale: Settings is a separate route; checking dirty state only after navigating
  there loses the original draft. Cover the route exit before unmount as well as
  a direct switch while an editor is mounted.
- Alternatives: per-dataset draft persistence/migration is outside scope; blocking
  until manual save/cancel was not the selected UX; replacing BrowserRouter is unnecessary.

## Scope

- Decision: no Cosmos/API, capacity, backup-format, or deployment changes.
- Rationale: those are existing constraints or separate defects, not the two new gaps.
- Unknowns: no unresolved product choices. Exact helper placement follows existing
  patterns during implementation; the behaviour contract is fixed.

## Implementation surface inventory

- All thirteen provider mutator methods share `persist` or the explicit Waypoint delete,
  restore, and clear paths. Delete includes a follow-up load; participation must
  span that load. `reload` is a read, not a mutation.
- Settings is the only runtime mode-switch caller. Backup preparation currently
  precedes provider restore and must join its pending boundary.
- Layout owns Settings navigation; its main content also contains the shared
  read-only Settings link. Guard Settings links before React Router navigates.
- Waypoint, Idea, and Activity editors already compare form fields, references,
  photos, and Activity tracks. Unapplied JSON is currently excluded. Activity
  deliberately excludes automatic location prefill from its dirty comparison.
- Dashboard owns Challenge creation; ChallengeDetails owns route parsing and
  replacement/removal drafts. In-flight GPX selections need unmount invalidation.
- Mode changes can remount the existing provider children to discard editor
  state, without replacing BrowserRouter or persisting drafts.
- The remote browser regression exposed list-editor completion callbacks navigating
  back after their page unmounted. Waypoint, Idea, and Activity creation pages
  now skip their post-save UI/navigation once unmounted; provider writes still
  settle normally and retain their original errors and pending participation.
- Existing ignore files cover Node output, dependencies, secrets, and editor
  files. The package is private; no publishing/Docker/Terraform ignores are needed.

## Analysis Remediation: 2026-10-21

- U1 resolved in the specification, plan, transient state, UI contract, validation
  guide, and T005: restore spans file acceptance, reading, validation, and writing.
  All failure paths release the shared pending boundary.
- I1 resolved in the same artifacts and T007: entering Settings confirms discard
  before unmount even without a subsequent mode switch; unrelated navigation is
  outside the new guard and accepted discard does not prompt twice.
- U2 resolved in the same artifacts and T008: non-whitespace unapplied JSON counts
  as dirty, including invalid text; clearing it leaves any applied form edits dirty.
- These are approved documentation refinements only. All implementation tasks
  remain pending and no product acceptance is claimed.
