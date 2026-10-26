# Journey Award Contract

**Scope**: Existing same-origin `/api/journey/{container}` boundary.
**Model**: [data-model.md](../data-model.md).

## Access and Transport

- Keep existing authenticated `aad` principal validation and exactly one
  `admin`/`viewer` role. Viewers can read, never mutate.
- Keep Production/Demo containers and managed-identity Cosmos access.
- No award/statistics endpoint, browser Cosmos access, credential, or new service.
- Keep the operation envelopes and response shapes used by
  [journeyApi.ts](../../../src/services/journeyApi.ts).

## Challenge Configuration

Create and update use the existing entity operations. An enabled Challenge
includes:

```json
{
  "supportsActivityCategories": true,
  "awardDescriptions": {
    "bronze": "An afternoon visit.",
    "silver": "A full-day visit.",
    "gold": "An overnight stay."
  }
}
```

These are fictional test criteria, not product defaults. Disabled Challenges
set the flag to false and omit `awardDescriptions`. Missing, blank, partial,
unknown-key, or disabled-but-present descriptions are rejected.

Edits replace current descriptions without updating Activity categories.
Preserve all other Challenge fields, including planned route and location.
Challenge documents use schema version 4; no version-3 reader or conversion.

## Activity Validation

For every Activity in the prospective dataset:

1. Validate the complete existing entity, including title, UK date, location,
   IDs, and fixed category enum.
2. Resolve `waypointId`, if present, and all required relationships.
3. Derive eligibility from enabled Challenges in that Waypoint's `challengeIds`.
4. Require category when eligible; reject category otherwise.

A direct `Activity.challengeId` alone never enables an award. Multiple enabled
memberships require one scalar category, not multiple fields or a selected
owning Challenge. Errors name the affected Activity/Waypoint and retain their
specific message.

Apply these rules to load, import, replace, create, and update. JSON draft
application also performs contextual validation in the frontend; it is not a
substitute for backend enforcement.

## Mutation and Deletion Semantics

| Operation                                           | Required outcome                                                                          |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Change descriptions                                 | Accept valid current guidance; keep Activity awards unchanged                             |
| Enable awards or add enabled membership             | Reject if retained member Activities lack a required category                             |
| Remove one membership or disable/delete a Challenge | Accept only if all retained awarded Activities keep eligibility                           |
| Delete an awarded Waypoint                          | Reject and identify awarded Activities requiring handling                                 |
| Delete a non-awarded Waypoint                       | Preserve existing allowed detachment/orphan-pruning behavior                              |
| Edit Activity level or eligible destination         | Validate the explicitly supplied candidate and recalculate derived views                  |
| Explicitly remove Activity eligibility              | Accept the deliberate Activity edit with category omitted, after frontend acknowledgement |
| Delete Activity                                     | Preserve existing explicit deletion and orphan-pruning behavior                           |

Rejected enabling or enabled-membership changes identify retained Activities
that would remain unawarded in the candidate graph and leave the dataset
unchanged. Explain that these settings/membership actions do not convert
unawarded history; do not suggest tier assignment while ineligible or add an
automatic backfill or migration path.

Allowed Challenge deletion removes its ID from Waypoint memberships and unsets
matching direct `Activity.challengeId` links. It does not remove Activity
categories or treat those direct links as award ownership.

Validate structural transitions against the original dataset, not merely the
final graph. A replacement that removes a Waypoint/last eligible membership
and simultaneously strips categories from retained Activities must be rejected.
Those Activities must be deliberately corrected first. This prevents full
replacement from reproducing the old silent-clearing deletion behavior.
Existing explicit whole-dataset Clear remains a separate confirmed destructive
operation, not a hidden award repair.

## Atomicity and Conflicts

- Build the prospective dataset and validate both its graph and structural
  transition before writes.
- For award-sensitive direct create/update/delete, reuse the complete-snapshot
  `replaceDataset` batch path rather than standalone writes.
- Replace retained snapshot documents with their loaded ETags, even when their
  entity values are unchanged. Include creates/deletes in the same batch.
- Check an update/delete request's target `ifMatch` against the loaded target
  before planning; do not substitute a fresh ETag for a stale client precondition.
- Preserve the full replacement caller's expected snapshot ETags. Do not
  silently refresh stale input, retry, or merge.
- All eligibility-changing writers, including Activity creates, must use this
  boundary so a new awarded visit cannot race past a disable/delete check.
- One batch, one dataset partition, at most 100 operations. An oversized plan
  fails explicitly before submission; no chunking or partial commit.

Keep raw operation success envelopes unchanged: entity/ETag for create/update,
204 for delete. Full load/replace retain the dataset/ETag response shape.

## Failure Contract

| Condition                                                      | Response                                                   |
| -------------------------------------------------------------- | ---------------------------------------------------------- |
| Invalid request, descriptions, award, or structural transition | Existing HTTP 400 with specific `{ "error": "<message>" }` |
| Viewer or invalid principal write                              | Existing HTTP 403 `{ "error": "forbidden" }`               |
| ETag/precondition conflict                                     | Existing HTTP 409 `{ "error": "conflict" }`                |
| Import target not empty                                        | Existing HTTP 409 `{ "error": "data_not_empty" }`          |
| Stored graph corruption                                        | Existing HTTP 422 with specific error                      |

Unsupported document versions and unexpected failures retain their specific
errors through the existing application boundary. Do not turn failed loads or
oversized batches into successful empty datasets.

## Contract Tests

Extend existing API schema, graph, Cosmos, and endpoint tests for:

- Enabled/disabled Challenge shape and exact schema-version rejection.
- Missing required and supplied ineligible categories on all write paths.
- Description edits preserving records, shared eligibility, and direct links.
- Full-replace attempts to disguise structural award loss by stripping fields.
- Challenge detachment and blocked awarded Waypoint deletion, with no partial writes.
- Conflicting concurrent Activity creation versus Challenge disabling/deletion;
  exactly one valid graph commits, with the loser receiving conflict.
- Raw and full-replace paths respecting target and snapshot ETags.
- Explicit operation-limit failure and unchanged admin/viewer enforcement.
