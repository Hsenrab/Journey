# GPX Import and Geometry Evidence

**Reviewed**: 2026-10-20
**Specification**: [GPX baseline](spec.md)

## Evidence Map

| Requirements          | Implementation reviewed                                                                                                                                                                                                                   | Existing tests reviewed                                                                                                                                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001 through FR-003 | [GPX parser](../../src/domain/gpx.ts)                                                                                                                                                                                                     | [Parser tests](../../src/domain/gpx.test.ts): namespace handling, mixed document order, separate routes/segments, invalid coordinates, unusable geometry                                                                                                        |
| FR-004 through FR-006 | [Parser limits/scanner](../../src/domain/gpx.ts), [frontend geometry schema](../../src/domain/visit.ts), [API geometry schema](../../api/src/lib/journeySchema.ts)                                                                        | [Parser tests](../../src/domain/gpx.test.ts), [domain tests](../../src/domain/visit.test.ts), [API schema tests](../../api/src/lib/journeySchema.test.ts)                                                                                                       |
| FR-007                | [Planned-route/track schemas](../../src/domain/visit.ts), [API schemas](../../api/src/lib/journeySchema.ts), [Activity attachment](../../src/components/ActivityEditor.tsx), [Challenge attachment](../../src/pages/ChallengeDetails.tsx) | [Domain filename/track tests](../../src/domain/visit.test.ts), [API schema tests](../../api/src/lib/journeySchema.test.ts), [Activity editor tests](../../src/components/ActivityEditor.test.tsx), [Challenge tests](../../src/pages/ChallengeDetails.test.tsx) |
| FR-008, FR-009        | [Backup utilities](../../src/services/storage.ts), [completion helpers](../../src/domain/visit.ts), [track membership](../../src/domain/gpxMap.ts)                                                                                        | [Backup round trip](../../src/services/storage.test.ts), [domain tests](../../src/domain/visit.test.ts), [GPX map tests](../../src/domain/gpxMap.test.ts)                                                                                                       |
| FR-010                | [Challenge baseline](../004-challenge-progress/spec.md), [Activity baseline](../006-activity-recording/spec.md), [Map baseline](../007-map-browsing/spec.md), [persistence baseline](../002-data-modes-persistence/spec.md)               | Documentation references checked; consuming tests remain evidence for their workflows, not duplicate GPX contracts                                                                                                                                              |

All implementation/test evidence is **source-reviewed, not newly executed**.
This extraction changed documentation and the local feature pointer only. It did
not run application tests, parse user files, touch hosted records, or deploy.

## Exact Existing Limits and Representation

- `parseGpx` checks 5,242,880 bytes, including UTF-8 byte length, and a
  50,000-supported-point ceiling. These do not promise attachability at that size.
- The pre-parse scanner caps structural markup at 200,000 counted nodes and
  nesting at 256 elements. Its count includes elements, attributes, comments,
  processing instructions, and CDATA. It rejects DOCTYPE declarations and
  mismatched closing tags rather than resolving custom entities.
- `parseGpxRoute` and both UI file consumers use the stricter stored geometry
  limits: 1-100 segments, at least two points per segment, at most 10,000 total.
  No simplification or chunking is present.
- The root namespace may be absent or the exact GPX 1.0/1.1 namespace. The root's
  `version` attribute is not the acceptance switch. Routes/tracks and their
  geometry children must use the root namespace.
- Coordinate text uses the parser's decimal notation, not hexadecimal or
  scientific notation. Stored GeoJSON `MultiLineString` pairs use longitude then
  latitude; parsing exposes named latitude/longitude before conversion.
- The frontend and API schemas enforce coordinate ranges and stored geometry
  bounds. Saved geometry is strict: arbitrary original-file metadata is not
  added to it.
- `parseGpxFile` checks file size then returns filename plus geometry.
  `parseGpxRoute` does not validate the filename wrapper itself.
  `PlannedRouteSchema` and the API planned-route schema enforce nonempty trimmed
  filenames and the 255-character maximum at record validation. A file can be
  parsed and previewed before a Challenge save rejects its filename.
- Activity selection calls the same parser but keeps only `route.geometry`.
  A long filename therefore does not become an Activity schema requirement.
- Geometry backup coverage asserts route/track round trip and absence of raw
  `<gpx` content. There is no GPX XML export or original-file archival path.

## Ownership After Extraction

| Concern                                                                                                       | Authoritative baseline                               |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Shared input formats, validation, limits, point/segment preservation, persisted geometry/filename distinction | [GPX](spec.md)                                       |
| Challenge route preview/save/replace/remove and member-track comparison                                       | [Challenges](../004-challenge-progress/spec.md)      |
| Activity track attach/replace/remove, parsing races, and Activity save                                        | [Activities](../006-activity-recording/spec.md)      |
| Route/track styles, visibility, deep-link scope, and camera framing                                           | [Map](../007-map-browsing/spec.md)                   |
| Dataset import/export actions and writable destination guards                                                 | [Persistence](../002-data-modes-persistence/spec.md) |

The Challenge detail map is a Challenge workflow; shared geometry rules are not
redefined there. Map rendering helpers validate line inputs, but no map-provider
or camera behaviour is moved into this file-import feature.

## Gaps and Known Dependencies

- Existing tests cover many failure and boundary cases; this review does not
  claim exhaustive exact-limit runtime tests for every listed threshold.
- [#160](https://github.com/Hsenrab/Journey/issues/160) leaves hosted persistence
  and map acceptance incomplete; parser/schema source evidence does not resolve it.
- [#170](https://github.com/Hsenrab/Journey/issues/170) concerns whole-dataset
  duplicate identities, not GPX point identity. It still qualifies complete backup
  restore safety claims.
- No new defect was confirmed in this extraction. No fix or additional test was made.

The [quality checklist](checklists/requirements.md) certifies document quality only.
Clarification is available if needed; implementation is not the next automatic step.
