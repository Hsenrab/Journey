# Research: Map Exploration Return

All decisions use current repository source, not new user research or live Maps
observations. No new technology choice or external research was needed.

## Session ownership and lifetime

- **Decision**: Add a Map-specific in-memory session to the existing Journey provider.
- **Rationale**: [waypointDiscovery.ts](../../src/features/journey/waypointDiscovery.ts)
  already establishes history-entry lookup, strict origin validation, scope
  invalidation and live-tab lifetime. [JourneyContext.tsx](../../src/features/journey/JourneyContext.tsx)
  supplies accepted-switch and superseded-load boundaries.
- **Implementation refinement**: Scope-qualified origin hints and retained
  invalidated provenance distinguish an old capture from a new capture under the
  same history key. A regression reproduced old-hint adoption after A -> B -> A;
  a new non-secret random scope per provider/transition prevents revival, including
  across provider restart. Full metadata is discarded on invalidation.
- **Alternatives considered**: URL-encoded state, local/session storage, keeping
  Map pages mounted, or a generic navigation store. These add persistence,
  lifecycle coupling or abstractions not required by #192.

## Entry paths and detail navigation

- **Decision**: One Map-local activation coordinator for nearby, popup and cluster
  links; add a direct Waypoint popup action.
- **Rationale**: [MapPage.tsx](../../src/pages/MapPage.tsx) currently has local
  exploration state, bare detail paths, cluster anchors without SPA callbacks,
  and Waypoint popups that only link Activities. Hard reload loses the session.
- **Alternatives considered**: Capturing every global navigation or forwarding
  Map origin automatically through nested detail journeys. Both exceed scope.
- **Decision**: Add a breadcrumb using the existing
  [DetailPageHeader](../../src/components/DetailPageHeader.tsx), rather than replace
  record navigation. Preserve [ActivityDetails.tsx](../../src/pages/ActivityDetails.tsx)
  `backTarget`, which also controls Waypoint chips and deletion navigation.

## Camera and current data

- **Decision**: Store camera values and identifiers, never records/geometry.
- **Rationale**: The installed SDK exposes `getCamera()` and `setCamera()`;
  existing Map route/track fit effects can otherwise overwrite a restored view.
  Dataset edits require current filtering, distances, marker positions and overlays.
- **Alternatives considered**: Fitting to the origin/selected record on return,
  retaining old bounds-derived entity content, or retaining cluster IDs. These
  change framing or introduce stale data.
- **Decision**: Keep entered query, resolved origin and unresolved search feedback
  separate. Restoring text must not imply it resolved successfully.

## Evidence and test limits

- **Decision**: Use existing controlled SDK unit tests and browser list/role/layout
  scenarios; keep authenticated live Maps checks separate.
- **Rationale**: [MapPage.test.tsx](../../src/pages/MapPage.test.tsx) already substitutes
  the SDK. Existing [browser tests](../../e2e/journey.spec.ts) mock token endpoints
  and block Azure requests; they do not establish live rendering.
- **Alternatives considered**: A new fake browser SDK alias, map provider, token
  fallback or deployment. None is required or authorized for this planning step.
- **Limitations**: Actual camera/cluster/touch behavior and target-viewport hosted
  acceptance remain unexecuted. Local coverage timeouts remain separate.
