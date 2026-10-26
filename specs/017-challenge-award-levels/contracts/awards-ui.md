# Award Presentation and Interaction Contract

**Spec**: [spec.md](../spec.md) | **Model**: [data-model.md](../data-model.md).

## Configuration and Recording

- Dashboard creation defaults to awards disabled. Enabling reveals three
  required description fields using shared MUI form conventions.
- Challenge details exposes current definitions to all readers and a compact
  admin-only award-settings editor. Description updates remain allowed after
  visits; disabling performs graph validation and preserves the draft on failure.
- Add a minimal admin Challenge deletion action with confirmation describing
  membership/direct-link detachment and the protection of awarded Activities.
  Blocked deletion identifies the records needing handling.
- Activity creation/editing shows one required "Award tier" selector only when
  the selected Waypoint is eligible. Explain that it describes this visit and
  does not determine completion.
- Show every applicable enabled Challenge's name and all three explanations.
  A shared Waypoint still has one selection applying to all enabled memberships.
- New Activities start without a tier selected. Editing an existing Activity
  without changing its Waypoint preserves its recorded tier, including when
  saving an unrelated field edit. Do not provide "No award" on eligible recording.
- For a changed destination, require a deliberate tier choice; do not silently
  reuse the old interpretation. Explain and acknowledge category removal when
  explicitly moving to no/ineligible Waypoint, before successful save.
- If enabling awards or adding an enabled membership would leave retained
  Activities unawarded, reject the entire change without writes. Identify the
  affected Activities and explain that award settings and membership actions
  do not convert unawarded history. Do not suggest assigning tiers while those
  Activities remain ineligible or introduce a conversion/backfill action.
- Applying structured Activity JSON validates the supplied category against the
  form's selected Waypoint before replacing draft values. Failure preserves the
  existing draft and reports the category issue. JSON gains no relationship IDs.
- Preserve save-pending protection, explicit retry, required title/date/location,
  attachments, Idea-origin returns, and existing unsaved-change decisions.

## Summary Meaning

| Context                                   | Display                                              |
| ----------------------------------------- | ---------------------------------------------------- |
| Eligible Waypoint with awarded Activities | `Highest recorded award: Gold` or the actual maximum |
| Eligible Waypoint without Activities      | `No award recorded`                                  |
| Ineligible Waypoint                       | No award indicator                                   |
| Member in an enabled Challenge            | Same highest record as global Waypoint view          |
| Member in an ordinary Challenge           | No award indicator, even when eligible elsewhere     |
| Individual Activity with category         | `Recorded award: Bronze` or its recorded tier        |
| Ordinary Activity without category        | No empty award status                                |

Completion labels remain separate. Label a latest visit date explicitly; it
must not look like the award date of the maximum record.

Audit Dashboard rollups and Recently visited, Waypoint list/details, Challenge
members, Activity list/details, Map list/popups, and Settings explanatory rules.
Replace user-facing "Activity categories", award "Not Started", "Medal tier",
and empty "Uncategorised" award language. Keep ordinary Waypoint categories.

Determine award-control applicability from the selected dataset or Challenge
scope before applying list filters or pagination. Hide award filtering/sorting
only when that scope has no eligible award content, or is an ordinary Challenge.
A dataset with no enabled Challenges has no award control or rollup.
If an applicable scope produces zero matches after filtering, retain its award
controls, active filter state, and clearing action beside the explicit empty
state; clearing the filter restores matching records.
Map completion filtering and icons remain driven by completion, not awards.

## Statistics and Drill-Downs

Place a Statistics section in existing Challenge details. Show completion,
total members, and total linked Activities for ordinary Challenges too.
For enabled Challenges, additionally show:

- "Waypoints by highest recorded award", with exact Bronze/Silver/Gold buckets
  and a separate "No award recorded" member count.
- "Activities by recorded award", with each visit in exactly one tier bucket.
- Links whose accessible names include scope, unit, tier, and count.

Dashboard award rollups use the same labelled units, restricted to eligible
entities and deduplicated globally. Do not sum per-Challenge counts to obtain
global totals. Do not invent one overall Challenge trophy from its best member.

Extend existing list routes with these query contracts:

| Link                                           | Result                                               |
| ---------------------------------------------- | ---------------------------------------------------- |
| `/waypoints?challenge=<id>&status=gold`        | Current members whose highest award is exactly Gold  |
| `/waypoints?challenge=<id>&status=not-started` | Eligible current members with no recorded award      |
| `/activities?challenge=<id>&award=bronze`      | Bronze Activities linked to current members          |
| `/waypoints?status=gold`                       | Distinct eligible global Waypoints with highest Gold |
| `/activities?award=bronze`                     | Distinct eligible global Bronze Activities           |

Keep the existing Waypoint `status` query key and tier values; its internal
`not-started` value means "No award recorded" within eligible scope, not
completion. Activity filtering uses `award=bronze|silver|gold`. No aliases or
compatibility parsers are needed. Query values and scope must be validated
consistently; user-facing labels always explain highest versus recorded.

Each list shows its active Challenge/tier scope and a link back to that
Challenge's Statistics section. Records remain navigable and Back retains the
filter URL. An unknown Challenge or invalid filter is an explicit error, not
an unfiltered successful list. A valid empty result is an empty state.

## Accessibility and Permissions

Use existing theme, Stack/Grid, labelled fields, Tabs where views actually
switch, Alerts, and loading/empty-state components. Long explanations wrap.
At 360x800 and 1280x800, content and actions must not overlap or cause horizontal
page scrolling. Keyboard focus and field-error associations remain visible.

Viewers and Demo-local readers see the same definitions, highest awards,
history, statistics, and drill-downs but no mutation controls or write requests.
