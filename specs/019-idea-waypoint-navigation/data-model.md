# Data Model: Idea-to-Waypoint Navigation

**Feature**: [spec.md](./spec.md)

This feature adds no stored fields, schemas, identifiers, migrations, or
relationships. Existing types in [visit.ts](../../src/domain/visit.ts) remain
authoritative.

## Entities and relationships used

| Entity   | Existing fields used                              | Feature behavior                                                     |
| -------- | ------------------------------------------------- | -------------------------------------------------------------------- |
| Idea     | `ideaId`, `title`, `waypointIds`, `planningState` | Display its existing associations and retain its planning state      |
| Waypoint | `waypointId`, `title`                             | Resolve a destination by identity and display its title as link text |
| Activity | `activityId`, `ideaIds`, optional `waypointId`    | Preserve derived Idea usage and existing Activity detail links       |

- An Idea associates with zero or more Waypoints through `Idea.waypointIds`.
- Waypoint IDs on an Idea are distinct; titles need not be unique.
- An Activity can reference several Ideas independently of its optional Waypoint.
- Usage is the count of Activities whose `ideaIds` contains the Idea's identity.
  Following a Waypoint link does not create usage or change planning state.
- Waypoint completion and Challenge awards are unrelated to this presentation
  change and retain their existing rules.

## Derived display

Continue resolving the existing association IDs against the current dataset.
Preserve association order and show only records that are currently available.
Key links by identity and target the existing Waypoint detail route. Do not
deduplicate by title or store a copy of the destination list.

An empty association list has explicit none-linked text. Existing dataset
validation, deletion/detachment, loading, and missing-record behavior remain
unchanged. No repair, migration, stale-record cache, or fallback is introduced.

## Local UI state

Reuse `IdeaDetails`' existing `editing` boolean; it is not persisted.

| Event/state                                  | Destination presentation                                 |
| -------------------------------------------- | -------------------------------------------------------- |
| Viewing an available Idea                    | Named links                                              |
| Entering the existing editor                 | Names as plain text                                      |
| Save pending while editor remains open       | Names as plain text                                      |
| Save fails and editor remains open           | Names as plain text; existing save error remains visible |
| Existing Cancel confirmation is declined     | Names as plain text; draft retained                      |
| Editing ends after Cancel or successful save | Named links for the current saved associations           |
| Viewer or Demo local browsing                | Named links; editing remains unavailable                 |

No new state machine or editor API is required. Existing reference and
Activity-usage navigation is unaffected by this display transition.
