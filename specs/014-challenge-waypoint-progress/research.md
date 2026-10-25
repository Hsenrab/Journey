# Research: Waypoint Progress on Challenge Details

## 1. Completion calculation

**Decision**: Reuse `waypointCompletionProgress` and `completionProgressLabel`
from [visit.ts](../../src/domain/visit.ts) without changing their semantics.

**Rationale**: The existing calculation counts Activities whose `waypointId`
matches the member. Once mode uses target one; count mode uses its configured
target; completion means count at least target. The formatter already handles
Done/Not done, target-one singular wording, and uncapped counts.
[Domain tests](../../src/domain/visit.test.ts) cover once, partial, exact-target,
and singular cases. Add zero-count and above-target assertions only if absent
when tasks are implemented.

**Alternatives considered**: A new page-specific count implementation risks
disagreement. Persisted counters or new endpoints are unnecessary and out of scope.

## 2. Presentation and textual completion

**Decision**: Add progress inside the existing card stack, after description and
before View waypoint. Follow the existing completion-label convention; include
an explicit Done/Not done text for count-mode members.

**Rationale**: [Locations](../../src/pages/Locations.tsx) and
[Waypoint details](../../src/pages/LocationDetails.tsx) use completion labels and
success/default colour. Their count label alone does not explicitly say Done or
Not done, so Feature 014 needs a local textual state in addition to the count.
Keep the shared formatter unchanged so other views retain their existing contract.
A simple textual line avoids a new shared styled component.

**Alternatives considered**: Colour-only completion fails accessibility requirements.
A progress bar alone obscures exact counts and over-target values. Award chips
could incorrectly imply that award tier and completion are the same thing.

## 3. Membership and dataset lifecycle

**Decision**: Continue `challengeWaypoints` for membership and calculate each
member's progress from current `data.activities` during rendering.

**Rationale**: [ChallengeDetails](../../src/pages/ChallengeDetails.tsx) already
consumes the active dataset and derives members/tracks. Context updates naturally
cause recalculation. Direct Activity Challenge links are not member completion.
No new refresh, state synchronisation, memoisation layer, or mutation is needed.

**Alternatives considered**: Challenge-specific Activity filtering would incorrectly
exclude linked Activities and diverge across overlapping Challenges. Automatic
refresh/polling would expand scope.

## 4. Regression and UI acceptance

**Decision**: Add card-scoped Testing Library assertions to the existing
[ChallengeDetails tests](../../src/pages/ChallengeDetails.test.tsx), and a focused
mocked browser flow in [journey.spec.ts](../../e2e/journey.spec.ts).

**Rationale**: The test suite already supplies a real Journey provider, role/mode
controls, and a mocked map. Browser routes can use synthetic data and count mutation
requests. Test progress association, both viewport widths, navigation, and
loaded-data changes without touching Azure.

**Alternatives considered**: Global text queries cannot prove a label belongs to
the right member. Snapshots alone cannot prove layout/no-write behaviour. Live
dataset tests are unnecessary.

## 5. Tooling and environment

**Decision**: Use existing commands and dependencies; with WSL Linux Node, run
from a native Linux checkout with dependencies on the same filesystem.

**Rationale**: [Feature 013 validation](../013-challenge-waypoint-relationships/quickstart.md)
records Windows-mount startup timeouts that disappeared on a native-filesystem
copy with unchanged checks. This is an execution requirement, not permission to
increase timeouts, add retries, or add repository copy infrastructure.

**Alternatives considered**: Raising timeouts hides the underlying issue.
Installing alternate tools or changing CI is not required by this feature.

All planning unknowns are resolved. No runtime checks were executed during planning.
