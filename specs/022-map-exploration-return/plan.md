# Implementation Plan: Resume Map Exploration

**Branch**: `022-map-exploration-return` | **Date**: 2026-11-01 |
**Spec**: [spec.md](spec.md)
**Input**: [#192](https://github.com/Hsenrab/Journey/issues/192)
**Status**: Application implementation and full local frontend/API CI complete.
The evidence-test timeout is resolved without changing its budget. Live SDK
acceptance awaits publication to the approved test environment.
See [validation evidence](quickstart.md).

## Summary

Reuse the existing Journey provider lifetime for an ephemeral, typed Map session
keyed by source history entry. Capture navigation metadata immediately before an
accepted ordinary record activation; put only a namespaced origin hint in router
state. Browser Back looks up the original entry; **Back to Map** carries its hint
to a new entry that follows the same exploration.

The hint includes the live scope identifier as well as the source entry and exact
opened record. Retaining invalidated origin provenance prevents a reused history
key from making an old hint resolve to a newly captured exploration.

Restore criteria against current data and apply the captured SDK camera after
readiness, without automatic route/track fitting overriding it. Keep Map,
Waypoint-list and Challenge origins independent. No record cache, persistence,
service, dependency, deployment or global navigation framework is needed.

## Technical Context

- **Language/Version**: TypeScript ~6.0.2 strict; React 19.2.
- **Primary Dependencies**: Existing React Router 7.18, MUI 9.2, Zod 4 and Azure
  Maps Web SDK. No additions or upgrades.
- **Storage**: In-memory navigation metadata only. Journey records remain on
  the unchanged protected API/Cosmos boundary.
- **Testing**: Existing Vitest/Testing Library SDK substitutes and Playwright;
  live authenticated Maps acceptance reported separately.
- **Target Platform**: Authenticated browser, 360x800 and 1280x800, admin/viewer
  and read-only Demo local.
- **Project Type**: Frontend-only navigation behavior.
- **Performance Goals**: Zero restoration origin searches or record writes;
  one-shot focus without timers/polling; metadata grows with captured visits,
  not dataset size.
- **Constraints**: Live-tab lifetime, permanent dataset invalidation, specific
  errors, current-data selections and unchanged completion/award semantics.
- **Scale/Scope**: One Map/detail round trip and existing detail/link surfaces.

## Constitution Check

Constitution v1.0.2 evaluated before research and after design:

| Principle                      | Evidence                                                                                     | Before / After |
| ------------------------------ | -------------------------------------------------------------------------------------------- | -------------- |
| Small, direct changes          | One Map helper, existing provider/pages; no generic framework                                | PASS / PASS    |
| Explicit failures              | Strict hint/metadata validation; explicit expired/absent states; no retry or silent recovery | PASS / PASS    |
| Typed rules and consistent UI  | Feature-owned types; existing MUI breadcrumbs, controls and focus rules                      | PASS / PASS    |
| Protected access and integrity | No record/geometry cache, credentials, API changes or navigation writes                      | PASS / PASS    |
| Evidence-based validation      | Scoped controlled tests; separate live-SDK evidence; no deployment implied                   | PASS / PASS    |

No exceptions or unresolved design questions remain.

## Project Structure

```text
specs/022-map-exploration-return/
  spec.md
  plan.md
  research.md
  data-model.md
  contracts/ui-contract.md
  quickstart.md
  checklists/requirements.md
```

Planned source changes:

- Add `src/features/journey/mapExploration.ts` and colocated tests.
- Update `JourneyContext.tsx` and tests for session ownership and the existing
  accepted selected/effective dataset invalidation boundaries.
- Update `MapPage.tsx` and tests for capture, restore, current selection, camera,
  search feedback, all popup/list actions and one-shot focus.
- Update `LocationDetails.tsx`, `ActivityDetails.tsx` and tests to add the Map
  breadcrumb without changing existing breadcrumbs, Challenge return or Activity
  `backTarget`/delete behavior. Reuse `DetailPageHeader` without changing its API.
- Add `e2e/map-exploration-return.spec.ts`; retain relevant existing journey tests.
- Update existing README and Waypoint/Activity guides. No new Map guide is required.

**Structure Decision**: Navigation rules belong beside existing Journey feature
helpers; presentation stays in existing pages. No routing, build/config, API,
infrastructure, storage schema or editor implementation changes are planned.

## Implementation Approach

1. Own `createMapExploration` beside `createWaypointDiscovery`. Wire selected
   transitions after accepted confirmation and effective transitions after the
   superseded-load check; cancelled switches/reloads must not invalidate context.
2. Reuse `isPlainDiscoveryActivation` for React and DOM link events. Introduce
   one Map-local typed activation coordinator reading the latest UI/camera state.
   Give popup/cluster anchors SPA callbacks, preserve modified links, and add a
   direct Waypoint popup action for both empty and populated Activity lists.
3. Capture search input, resolved origin, unchosen choices and handled search
   feedback separately from token/render errors. Do not capture pending requests,
   credentials, record arrays, geometry or DOM/SDK instances.
4. Resolve an original entry or explicit-return hint. Follow new explicit-return
   entries so subsequent Back/Forward/navigation remains independent. Scope-tagged
   origins remain invalidated even if their history key is reused. An accepted
   dataset change leaves an invalidated entry and resets to bare `/map`, dropping
   old track intent with an explanation.
5. Restore mode/filters/panel before rendering current results. Resolve marker,
   popup action, planned route and track IDs from current data. For an Activity
   opened inside a Waypoint popup, retain the selected Waypoint and Waypoints mode.
   Cluster return uses current individual-record content, not an old cluster ID.
6. Capture real `getCamera()` values when ready; validate them without invented
   defaults. Apply once after current data and SDK readiness. Seed/suppress the
   initial fit sentinels so track/route effects do not override restoration;
   explicit later selections and fresh direct-track entry still fit normally.
   Recreated instances during restoration must not consume it prematurely.
7. Add guarded **Back to Map** ahead of existing detail breadcrumbs, including
   missing-record detail. Focus the originating available action/result or the
   visible panel/explanation once, not on later record/filter updates.
8. Update documentation and execute [quickstart.md](quickstart.md) during
   implementation. Preserve existing errors, draft guards, roles and geometry styles.

## Design Artifacts and Validation

[Research](research.md), [navigation model](data-model.md),
[UI contract](contracts/ui-contract.md) and [validation guide](quickstart.md).

Controlled SDK tests cover camera and all six entry combinations. Browser tests
cover actual layout, links, focus, roles and list return without pretending mocked
or unavailable Maps rendering is live acceptance. Authenticated live-SDK camera,
marker, cluster and touch checks require an approved usable environment; report
blocked checks explicitly rather than add fake rendering infrastructure.

The local Windows coverage execution timeout was subsequently resolved by reducing
repeated evidence-editor DOM queries, without altering pools, budgets, thresholds
or assertions. Full local/hosted CI and frontend-only test publication passed.
Partial live admin acceptance then exposed a cluster-event representation bug:
the SDK returns cluster points as GeoJSON Features, not editable Shapes. The
correction and pending live checks are tracked separately from the deployed
commit. No checks or hosted acceptance ran during planning. Evidence is recorded in
[quickstart.md](quickstart.md); task completion is tracked in [tasks.md](tasks.md).
