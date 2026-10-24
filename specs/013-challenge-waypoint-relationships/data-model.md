# Data Model: Single-Source Challenge-Waypoint Relationships

## Challenge

Retain `challengeId`, `title`, `description`, `supportsActivityCategories`,
optional `location`, and optional `plannedRoute`.

- Remove `waypointIds`; its presence is an explicit validation error, even empty.
- Challenge objects use strict validation.
- New Cosmos Challenge documents use schema version 3; versions 1/2 are rejected.
- Creating a Challenge creates no assignments and stores no member list.

## Waypoint

Retain all fields, including the required `challengeIds` array.

- Zero, one, or many Challenge assignments are allowed.
- Each identifier is nonempty, distinct, and refers to an existing Challenge.
- No default, deduplication, or dropping of unknown references repairs invalid input.
- Cosmos Waypoint document version remains 2 because its entity shape is unchanged.

## Derived membership

```text
members(challenge) =
  waypoints whose challengeIds contain challenge.challengeId
```

- Dashboard progress and Challenge details consume the existing shared helper.
- Completion still counts Activities against each Waypoint's once/count target.
- Category eligibility means at least one assigned Challenge enables categories;
  it is not a per-Challenge award total.
- Recorded Challenge tracks come from Activities linked to member Waypoints.
- Direct `Activity.challengeId` remains stored and validated under its existing
  rules; it does not become a membership or track-selection authority.

## Assignment state transitions

| Action                                                       | Result                                                                      |
| ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Add a valid assignment                                       | Change only the Waypoint's assignment list.                                 |
| Remove a valid assignment                                    | Change only that assignment; keep other links/history.                      |
| Cancel edit                                                  | No saved change.                                                            |
| Repeat or reference a missing Challenge                      | Reject before accepting/persisting.                                         |
| Remove last category-enabled assignment with awarded history | Reject; do not clear Activity awards.                                       |
| Delete Waypoint                                              | Existing Idea/Activity detachment and orphan cleanup; no Challenge updates. |
| Conflict or failed persistence                               | Saved data unchanged; existing explicit error/draft behavior.               |

## Dataset and backup

- Browser and API dataset validation enforce the assignment rules above.
- Entity uniqueness and unrelated graph rules retain their existing behavior.
- Backup envelope becomes version 2, with the existing `exportedAt` and `data`
  fields. Version 1 is rejected, not converted.
- Reject an obsolete Challenge list even if the backup envelope says version 2.
- An empty dataset is valid. An obsolete Challenge with an empty list is not.

## Data lifecycle

The checked-in Demo fixture and authored test fixtures are updated directly.
No hosted Demo/Test/Production document is rewritten, no legacy browser records
are deleted, and no persisted data is migrated by this feature. Old records and
backups need separately authorized correction before use.
