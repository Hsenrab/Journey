# Data Model: Member Progress

## Existing entities (unchanged)

| Entity    | Relevant fields                                                                | Relationship and constraints                                                              |
| --------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Challenge | `challengeId`, title, description                                              | Members derived from Waypoint assignments                                                 |
| Waypoint  | `waypointId`, `challengeIds`, `completion`                                     | Distinct existing Challenge IDs; completion is once or count with positive integer target |
| Activity  | `activityId`, optional `waypointId`, optional `challengeId`, optional category | Only `waypointId` determines contribution to member completion                            |

These are existing typed, validated entities. No schema/version changes, data
conversion, new persisted fields, or service contracts are introduced.

## Derived member progress (existing type)

`WaypointCompletionProgress` contains:

- `count`: number of loaded Activities linked to the Waypoint.
- `target`: one for once mode, otherwise the Waypoint's configured target.
- `complete`: `count >= target`.

The existing domain helper is the authority. A matching Activity counts regardless
of award category, date, or optional direct Challenge ID. Unlinked Activities,
Activities belonging to other Waypoints, and Ideas do not contribute.

## Derived display

| Mode  | Count     | Target | Count/completion display                    |
| ----- | --------- | ------ | ------------------------------------------- |
| once  | 0         | 1      | `Completion: Not done`                      |
| once  | 1 or more | 1      | `Completion: Done`                          |
| count | 0         | 1      | `Completion: 0 of 1 activity`; `Not done`   |
| count | 0         | 5      | `Completion: 0 of 5 activities`; `Not done` |
| count | 2         | 5      | `Completion: 2 of 5 activities`; `Not done` |
| count | 5         | 5      | `Completion: 5 of 5 activities`; `Done`     |
| count | 7         | 5      | `Completion: 7 of 5 activities`; `Done`     |

Progress belongs to the Waypoint, not to its Challenge assignment. The same member
therefore has the same values in every Challenge containing it.

## State transitions

- Loaded addition/deletion of a linked Activity recalculates count and completion.
- Loaded reassignment changes both the old and new member's derived values.
- Loaded target/rule changes use the current Waypoint rule.
- Dataset switching uses the new dataset only; no previous progress is retained.
- Loading/failure/missing-Challenge handling remains owned by the existing page
  and provider. Do not synthesise zero progress for unavailable records.

There is no separately managed progress lifecycle or write operation.
