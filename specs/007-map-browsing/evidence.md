# Map Browsing Evidence

**Reviewed**: 2026-10-20
**Specification**: [Map baseline](spec.md)

| Requirements          | Implementation reviewed                                                                                                                                              | Existing tests reviewed                                                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001 through FR-004 | [Map page](../../src/pages/MapPage.tsx), [map rules](../../src/domain/map.ts), [completion](../../src/domain/visit.ts)                                               | [Page tests](../../src/pages/MapPage.test.tsx), [domain tests](../../src/domain/map.test.ts)                                                                                 |
| FR-005 through FR-007 | [Map search/list controls](../../src/pages/MapPage.tsx), [nearby ordering](../../src/domain/map.ts), [search handler](../../api/src/functions/mapsSearch.ts)         | [Page tests](../../src/pages/MapPage.test.tsx), [domain tests](../../src/domain/map.test.ts), [search tests](../../api/src/functions/mapsSearch.test.ts)                     |
| FR-008, FR-009        | [Map display/selection](../../src/pages/MapPage.tsx), [shared GPX contract](../008-gpx-import-geometry/spec.md)                                                      | [Page display/framing tests](../../src/pages/MapPage.test.tsx); shared geometry evidence is maintained in [GPX evidence](../008-gpx-import-geometry/evidence.md)             |
| FR-010, FR-011        | [Map layout and service handling](../../src/pages/MapPage.tsx)                                                                                                       | [Page tests](../../src/pages/MapPage.test.tsx)                                                                                                                               |
| FR-012                | [Token handler](../../api/src/functions/mapsToken.ts), [search handler](../../api/src/functions/mapsSearch.ts), [credential boundary](../../api/src/lib/mapsAuth.ts) | [Token tests](../../api/src/functions/mapsToken.test.ts), [search tests](../../api/src/functions/mapsSearch.test.ts), [credential tests](../../api/src/lib/mapsAuth.test.ts) |

## Status and Boundaries

- All rows are source-reviewed, not newly executed. Tests mock the rendering SDK
  and service responses; this baseline does not claim a live rendering or token test.
- No shared-browser navigation, cloud inspection, live location search, Journey
  write, role change, deployment, or infrastructure change occurred for this feature.
- Initial camera center uses a chosen origin, then the first located Waypoint,
  then first located Activity, otherwise zero coordinates. The nearby list still
  requires an explicit searched origin and is not populated from initial center.
- A `map?activityId=...` deep link controls track scope and initial Activities mode.
  All Activity markers and nearest Activity results remain eligible; it is not a
  dataset filter.
- Planned Challenge routes are drawn independently of the exclusive point-mode
  choice. Named route controls frame rather than hide all unselected routes.
- Shared file acceptance and geometry preservation belong to the
  [GPX baseline](../008-gpx-import-geometry/evidence.md), not a second Map contract.
  Styling, visibility, camera framing, and deep-link scope remain here.
- Record coordinates are read, not repaired. Missing-coordinate counts cover the
  complete loaded dataset, not just filtered/visible markers.
- First rendering token is consumed by the SDK, which obtains subsequent tokens
  through the same protected endpoint. This is normal credential renewal, not a
  service-failure retry or alternate-authentication fallback.
- The existing 404 message attributes the problem to an absent API/preview
  limitation. A 404 alone does not prove that cause: the earlier shared-test
  investigation found linked backend resources. This baseline requires an explicit
  error but does not certify the message's infrastructure diagnosis.
- Nearby query failure preserves prior selections/filters; the source review
  does not establish request-order guarantees for overlapping origin searches.
- The Challenge detail map has its own recorded-track toggle; the general Map
  page uses point modes and route/Activity selections, not that same control.

## Known Defects and Gaps

- [#160](https://github.com/Hsenrab/Journey/issues/160) includes observed Maps
  token/search 404s on the shared test site; real hosted rendering/search acceptance
  remains unverified. No alternate provider is authorized.
- [#174](https://github.com/Hsenrab/Journey/issues/174) tracks form-save geocoding
  bypass. The missing-coordinate notice's suggestion to re-save is not proof
  that the current browser save path resolves missing coordinates.
- [#171](https://github.com/Hsenrab/Journey/issues/171) tracks inconsistent
  membership input that can affect award eligibility and Challenge track membership.
- No additional Map-specific defect was confirmed during this bounded review.

See the [quality checklist](checklists/requirements.md). Baseline completeness is
documentation completeness, not a live map acceptance result or a new implementation plan.
