# Implementation Plan: Waypoint Draft Protection

**Branch**: `018-waypoint-draft-protection` | **Date**: 2026-10-27 |
**Spec**: [spec.md](./spec.md)

**Input**: The clarified specification for
[#188](https://github.com/Hsenrab/Journey/issues/188).

## Summary

Protect explicit Cancel in the shared Waypoint add/edit editor using its existing
`dirty` calculation and a browser confirmation. An unchanged draft closes
immediately; declining discard does not invoke the parent callback or alter state.

Expose and await the existing asynchronous submission contract, lock Cancel while
saving, and restore it after failure. Reuse Activity editor patterns for local
saving state, synchronous exclusion of duplicate submits and propagation of escaped
errors to the application root. The parents retain ownership of successful closure
and their existing error presentation.

No navigation expansion, backend change, migration, autosave, draft storage,
new dependency or change to Idea/Activity editors is planned.

## Technical Context

**Language/Version**: TypeScript ~6.0.2, strict mode; React 19.2.

**Primary Dependencies**: Existing MUI 9.2, React Router 7.18 and Vite 8.2.
Use browser `window.confirm`; no new modal or shared abstraction.

**Storage**: None added. Current Journey context/protected Cosmos persistence is
unchanged. Saving and confirmation state exist only in the component.

**Testing**: Vitest 4.1, Testing Library and Playwright 1.62 Chromium.

**Target Platform**: Browser application at 360 by 800 and 1280 by 800, with
keyboard use, admins, viewers and read-only modes.

**Project Type**: Frontend interaction fix with component, page and browser coverage.

**Performance Goals**: Cancel starts zero requests; unchanged Cancel has no prompt.
A pending save admits one submission and no Cancel closure. No timers or polling.

**Constraints**: Preserve current dirty rules, JSON, evidence order, parent context,
errors, write restrictions and navigation safeguards. Use isolated fictional data.

**Scale/Scope**: One shared editor, two existing production callers, three existing
test files, one focused browser test file and the Waypoints page guide.

## Constitution Check

Pre-research and post-design gates both pass:

| Principle                      | Design evidence                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Small, direct changes          | Component-local behavior; reuse existing confirmation and saving patterns.                                             |
| Explicit failures              | No defaults, retries or swallowed callback rejections. Escaped errors reach the existing root error element unchanged. |
| Typed rules and consistent UI  | Replace the misleading `void` callback with `Promise<void>`; retain domain validation and MUI controls.                |
| Protected access and integrity | No schema, service, authorization or persistence changes; Cancel invokes no mutation.                                  |
| Evidence-based validation      | Focused component/page/browser checks planned; source review is not runtime validation. No push or deployment.         |

No constitutional exception or unresolved technical clarification is required.

## Project Structure

### Documentation (this feature)

```text
specs/018-waypoint-draft-protection/
  spec.md
  plan.md
  research.md
  data-model.md
  contracts/
    waypoint-editor.md
  quickstart.md
  checklists/
    requirements.md
```

`tasks.md` records implementation work and its execution status.

### Source Code (repository root)

```text
src/components/WaypointEditor.tsx
src/components/WaypointEditor.test.tsx
src/pages/Locations.tsx                 existing add caller; behavior preserved
src/pages/Locations.test.tsx
src/pages/LocationDetails.tsx           existing edit caller; behavior preserved
src/pages/LocationDetails.test.tsx
e2e/waypoint-draft-protection.spec.ts    new focused acceptance file
e2e/journey.spec.ts                     existing changed-draft Cancel expectation
docs/pages/locations.md
```

**Structure Decision**: Keep behavior in the shared editor. Both production page
callbacks already return promises; no parent production-code changes are expected.
Any integration-driven adjustment must stay limited to the callback lifecycle,
not unrelated persistence or error handling.

## Phase 0 - Research

[research.md](./research.md) records the source evidence and decisions. All choices
are resolved from repository patterns; no external technology selection or separate
research agent is needed for this bounded change.

## Phase 1 - Design

### Cancel decision

Use the existing `dirty` value without normalization or a new comparator.
Return immediately if saving. Otherwise invoke `onCancel` only for an unchanged
draft or after accepting `You have unsaved Waypoint changes. Discard them?`.

The browser owns the confirmation UI. Do not copy the dataset-switch confirmation
path, clear its registry or introduce a second confirmation. Declining performs
no state update and leaves the parent message and current tab intact.

### Submission lifecycle

Change `onSubmit` to `(draft: WaypointDraft) => Promise<void>`. Preserve validation
and draft construction before taking the saving lock. Use state for rendering and
a ref for immediate exclusion of repeated submits and Cancel.

Take the lock before invoking the callback, await it, and release it in `finally`.
Lock form controls for the same interval using the existing Activity fieldset
pattern, so edits made after submission cannot be silently lost on successful
closure. Explicitly disable Cancel and Save, expose `aria-busy`, and show
`Saving...` using existing MUI patterns. This short pending lock is not a
navigation change or a new persisted draft state.

Do not close, reset, mark clean or show success when the callback merely resolves.
The parent alone closes after success. A handled failure resolves while retaining
the editor; releasing the lock restores normal editing and guarded Cancel.

If a callback rejection escapes existing parent handling, preserve the original
thrown value in a fatal-state envelope and throw it during render, matching
Activity recording and the root `ApplicationError`. Do not replace it with a
generic message or leave an unhandled event-handler rejection.

### Preserved boundaries

- Keep `useJourneyDraft(dirty)`, `useBeforeUnload`, routing, data modes and global
  mutation/navigation behavior unchanged. Do not adopt Activity's router blocker.
- Keep saved-record defaults, Challenge/award integrity and save/delete rules.
- Leave existing parent error handling in place; do not widen catches or refactor
  unrelated pre-existing failure handling.
- Keep viewer, Demo local and failed-load write gates outside the editor unchanged.
- Do not add evidence-reordering controls or change evidence resolution when testing
  preservation of the draft's current order.

See [data-model.md](./data-model.md) for transient state transitions and
[the editor contract](./contracts/waypoint-editor.md) for observable behavior.

### Validation and requirement coverage

| Requirements                   | Planned evidence                                                                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001, FR-002, FR-008; SC-003 | Add/edit component cases for untouched, reverted, tab-only, whitespace JSON and unapplied/applied JSON states.                                 |
| FR-003, FR-004, FR-006; SC-001 | Both confirmation choices, repeated decline, exact state/evidence/error retention and zero submission calls.                                   |
| FR-005, FR-007; SC-002         | Both parent pages retain origin context; discard/reopen uses saved values/defaults and makes no write.                                         |
| FR-009, FR-013; SC-006         | Deferred saves, synchronous duplicate attempts, failure/retry, disabled Cancel, successful parent closure and exact unexpected root error.     |
| FR-010; SC-004                 | Keyboard activation, post-dismissal editor focus and no overflow at both viewports; manually check native-dialog keyboard behavior.            |
| FR-011; SC-005                 | Viewer Production/Demo Cosmos and Demo local cannot open mutation controls or write, including a direct add URL.                               |
| FR-012                         | Existing navigation/mode-switch/unload regressions remain intact; each dirty Cancel produces one native confirmation, not a navigation prompt. |

Update [the Waypoints guide](../../docs/pages/locations.md) with Cancel, discard,
reopening and the pending-save lock. Apply the relevant
[UI self-review](../../docs/UI_GUIDELINES.md#self-review-checklist).

Use [quickstart.md](./quickstart.md) for the targeted final validation sequence.
The existing test-mode browser bundle exercises Production through its local test
path. Remote pending/failure and viewer browser cases use intercepted Demo Cosmos;
page integration tests cover the mocked API and viewer restrictions in both
remote modes. Do not claim remote Production browser coverage from that bundle.
Backend/deployment checks are not part of this frontend-only scope. A later push
or PR request requires the repository's complete local CI sequence.

## Complexity Tracking

No violations or additional infrastructure. The only new file outside the design
artifacts is the focused browser test; production changes stay in the shared editor.

## Planning Status

Phase 0 research and Phase 1 design are complete. No application changes or
application/browser tests have been executed during planning. The UX review's
browser timeout is historical evidence, not proof of current browser availability
or a completed acceptance check.
