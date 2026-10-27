# Research: Waypoint Draft Protection

**Date**: 2026-10-27 | **Feature**: [spec.md](./spec.md)

Research used current source and existing test definitions. No application tests
or browser journeys were executed. There are no unresolved technical choices
requiring external research.

## 1. Reuse dirty state and native confirmation

**Evidence**:
[WaypointEditor](../../src/components/WaypointEditor.tsx) computes `formDirty`,
adds non-whitespace unapplied JSON to `dirty`, and uses it for draft registration
and unload handling. Its Cancel button directly calls the parent.
[IdeaEditor](../../src/components/IdeaEditor.tsx) and
[ActivityEditor](../../src/components/ActivityEditor.tsx) use `window.confirm`
before cancelling a changed draft.

**Decision**: Use `dirty` directly and the same browser-confirmation mechanism,
with `You have unsaved Waypoint changes. Discard them?`. Declining changes no state.
A saving ref takes precedence over this decision.

**Rationale**: Close the missing path without a second dirty definition, draft
snapshot, custom modal or global navigation event.

**Alternatives considered**: A shared helper adds no useful logic to centralize.
A custom modal adds state/focus work. Generic navigation interception contradicts
the confirmed Cancel-only scope.

## 2. Make the async contract truthful without inventing success results

**Evidence**:
[Locations](../../src/pages/Locations.tsx) awaits `addWaypoint`, closes add mode
after success and renders caught errors without closing.
[LocationDetails](../../src/pages/LocationDetails.tsx) does the same for
`updateWaypoint`. Both callbacks are async despite the editor's `void` prop;
handled-failure branches resolve normally.

**Decision**: Replace the callback type with `Promise<void>` and await settlement.
Keep success, editor closure and page messages owned by the parents.

**Rationale**: The editor needs the operation's duration, not a new success protocol.
Interpreting fulfillment as success would discard a retained failed draft.

**Alternatives considered**: Boolean results or `onSaved` unnecessarily rewrite
both parents. A `void | Promise<void>` compatibility union retains the obsolete
contract. Global mutation state couples the editor to other operations and does
not cover its callback's full work.

## 3. Use a short local save lock with exact error propagation

**Evidence**:
[ActivityEditor](../../src/components/ActivityEditor.tsx) has saving state/ref,
a disabled fieldset, `aria-busy`, `Saving...` feedback and a fatal-state envelope
that rethrows escaped errors during render.
[Its lifecycle tests](../../src/components/ActivityEditor.lifecycle.test.tsx)
exercise immediate duplicate submission, delayed completion and the actual
[root error element](../../src/app/App.tsx).

**Decision**: Reuse that small pattern without Activity-specific GPX, success-result
or router-blocker behavior. Lock form controls, Save and Cancel while this submission
is pending. Release in `finally`; forward an escaped thrown value exactly.

**Rationale**: A ref closes the gap before disabled controls rerender. Locking
the submitted form prevents new edits being lost on normal successful closure.
Cleanup must not convert a rejection to success.

**Alternatives considered**: Button disabling alone does not prevent same-turn
submits; concurrent saves make a boolean lock inaccurate. Fire-and-forget callbacks
cannot protect Cancel for the operation's duration. A new generic inline catch
would hide unexpected failures.

## 4. Preserve navigation and page boundaries

**Evidence**:
[JourneyContext](../../src/features/journey/JourneyContext.tsx) tracks mutations
and drafts for `confirmNavigation`. Parent Cancel callbacks remove add mode or exit
editing and clear their page message. Both pages gate editors on read-only status.

**Decision**: Do not invoke those callbacks on decline, change navigation guards,
or clear page messages from the editor. Do not alter access or persistence code.

**Rationale**: The existing parent callback supplies the correct context and reset
on confirmed discard. Calling a navigation guard too risks duplicate prompts and
unwanted registry changes.

**Alternatives considered**: Broader Back/Forward protection was rejected in
clarification. Persisting draft content or storing a return snapshot expands scope
and approved storage behavior.

## 5. Validate at the right boundaries

**Evidence**:
[Editor tests](../../src/components/WaypointEditor.test.tsx) cover validation and
JSON dirtiness. [Locations tests](../../src/pages/Locations.test.tsx) cover remote
creation/viewers; [detail tests](../../src/pages/LocationDetails.test.tsx) cover
failed location edits and protected assignments.
[Journey browser tests](../../e2e/journey.spec.ts) and
[Challenge journey browser tests](../../e2e/challenge-activity-journey.spec.ts)
intercept fictional API responses, count writes and hold requests pending.

**Decision**: Extend those three component/page test files and add one focused
browser file using existing interception patterns. Use deferred promises, not
sleeps. Cover both target viewports and read-only access.

**Rationale**: Component tests check exact state, page tests check actual parents,
and isolated browser tests check visible interaction and write counts. None proves
real Cosmos, geocoding or hosted authentication behavior.

**Alternatives considered**: Full-suite-only checks are less diagnostic. Shared
browser pages and real Production writes are unacceptable. Native-dialog API
acceptance/dismissal does not prove OS-dialog keyboard controls; retain that
distinction in the validation guide.
