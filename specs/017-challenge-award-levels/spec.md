# Feature Specification: Clear Challenge Award Levels and Statistics

**Feature Branch**: `017-challenge-award-levels`

**Created**: 2026-10-25

**Status**: Draft

**Input**: Make awards coherent for the minority of Challenges that use them.
An Activity against a Waypoint in an award-enabled Challenge must record a visit
level. Waypoints and Challenge member summaries show the highest recorded level;
individual Activities retain their own level, with totals and drill-downs in
Challenge statistics and other summaries. Ordinary Challenges should not expose
award clutter. Address the remaining awards UX review findings without replacing
the mandatory-selection or highest-award rules.

## Clarifications

### Session 2026-10-25

- Awards are optional for a Challenge, but mandatory on an Activity whose linked
  Waypoint belongs to any award-enabled Challenge.
- A Waypoint's summary shows the highest award among its currently linked
  Activities, not the latest visit's award. Challenge member summaries use that
  same highest level.
- One Activity has one shared award level applying to all its Waypoint's
  award-enabled Challenges, not separate awards for different Challenges.
- Keep the fixed Bronze, Silver, and Gold levels and ordering; add
  Challenge-specific explanations rather than configurable level sets.
- Block changes that would invalidate recorded awards and explain which
  Activities must be handled first. Do not silently remove awards or preserve
  detached awards as a new historical-record mechanism.
- Q: Should Challenge award explanations be editable after Activities have been
  recorded? A: Yes. Explanations are current guidance; editing them never changes
  recorded award levels and does not retain earlier versions.
- Q: May a Challenge be deleted or its awards disabled if all affected awarded
  Activities remain eligible through another enabled Challenge? A: Yes. Block
  only if any awarded Activity would lose its last eligible Challenge.
- Q: Does the no-preselection rule reset an existing Activity's award? A: No.
  Preserve its recorded tier when its Waypoint is unchanged; new Activities and
  moves to another eligible Waypoint require a deliberate tier choice.
- Q: Can award settings or membership changes convert unawarded visit history?
  A: No. Reject changes that leave retained Activities eligible but unawarded,
  identify those Activities, and explain that these actions provide no historical
  conversion or automatic backfill. Do not suggest assigning tiers while ineligible.
- Q: Does an empty award-filter result hide the award controls? A: No.
  Determine applicability from the selected dataset or Challenge scope before
  list filters and pagination; retain applicable controls for empty results.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Explain and Record the Visit Level (Priority: P1)

As an administrator, I can enable awards for a Challenge, explain each level,
and record the level that describes an actual visit without confusing it with
Waypoint completion.

**Why this priority**: A required choice must have a discoverable meaning, while
ordinary recording must remain free of inapplicable award controls.

**Independent Test**: Configure an ordinary Challenge and an award-enabled
Challenge with explanations, then record and edit linked Activities, including
one on a shared Waypoint.

**Acceptance Scenarios**:

1. **Given** a new Challenge, **When** I configure it, **Then** awards are
   disabled by default; enabling them requires a nonblank explanation for each
   of Bronze, Silver, and Gold before saving.
2. **Given** an enabled Challenge explaining Bronze as an afternoon visit and
   Gold as an overnight stay, with an explicitly supplied Silver explanation,
   **When** I view its details or record an Activity at a member Waypoint,
   **Then** I can read all three explanations beside the named Challenge.
3. **Given** a Waypoint in at least one award-enabled Challenge, **When** I
   submit an otherwise valid Activity without an award, **Then** saving is
   rejected with a field-specific error and the draft remains available.
4. **Given** that Waypoint, **When** I select Bronze, Silver, or Gold and save,
   **Then** that one level is recorded on the Activity; no tier is invented or
   preselected merely to satisfy the requirement.
5. **Given** a Waypoint shared by two enabled Challenges with different
   explanations, **When** I record an Activity, **Then** both named sets of
   explanations are available and the form states that the single selected
   level applies to both Challenges.
6. **Given** a Waypoint belonging only to ordinary Challenges, or an independent
   Activity without a Waypoint, **When** I record it, **Then** there is no award
   selector and an award cannot be supplied.
7. **Given** an enabled Challenge with awarded Activities, **When** I save
   valid revised award explanations, **Then** the current guidance updates
   wherever shown and every recorded Activity retains its original award level.
8. **Given** an existing awarded Activity, **When** I edit its title or other
   fields without changing its Waypoint, **Then** its recorded tier remains
   selected and is preserved on save without requiring another selection.
9. **Given** retained unawarded Activities at an ordinary Waypoint, **When** I
   enable awards or add an enabled membership that would require their tiers,
   **Then** the entire change is rejected without writes, the affected Activities
   are identified, and the error explains that these actions cannot convert
   unawarded history or assign tiers while the Activities remain ineligible.

---

### User Story 2 - See the Highest Achievement without Losing Visit Detail (Priority: P1)

As a user, I see the highest recorded award for each eligible Waypoint wherever
it is summarized, and can inspect the individual visits that produced it.

**Why this priority**: Later lower-level visits should not appear to erase an
achievement or be misrepresented as having earned the headline award.

**Independent Test**: Record Bronze, Gold, then Bronze against one Waypoint;
inspect its list, details, Challenge entries, recent visit summary, and Activity
history. Edit, delete, or reassign the sole Gold Activity and verify recalculation.

**Acceptance Scenarios**:

1. **Given** linked Activities recorded as Bronze, Gold, then Bronze, **When**
   I view the Waypoint or its entry in an award-enabled Challenge, **Then** the
   summary says "Highest recorded award: Gold", regardless of visit order.
2. **Given** the same history, **When** I inspect individual Activities,
   **Then** their levels remain Bronze, Gold, and Bronze; a latest-visit date
   beside the summary does not imply that the latest visit earned Gold.
3. **Given** Gold is the sole highest record, **When** it is deliberately
   changed to Silver, deleted, or reassigned to another eligible Waypoint and
   the change is loaded, **Then** both affected Waypoints' summaries and
   Challenge statistics recalculate from their remaining linked Activities.
4. **Given** an eligible Waypoint with no recorded Activities, **When** I view
   it, **Then** its award state is "No award recorded" and its completion state
   is shown independently.
5. **Given** a count-based Waypoint at 1 of 3 Activities with a Gold record,
   **When** I view it, **Then** it can show Gold while still being incomplete;
   adding a Bronze Activity increases the count without reducing Gold.

---

### User Story 3 - Understand Challenge Totals and Drill Down (Priority: P2)

As a user, I can distinguish how many Waypoints have achieved each highest level
from how many Activities were recorded at each level, then inspect the records
behind a total.

**Why this priority**: A count of highest-achieving Waypoints is not a count of
visits, and confusing those units makes Challenge statistics misleading.

**Independent Test**: Use an enabled Challenge with two members: one with
Bronze, Gold, Bronze Activities and one with a Silver Activity. Inspect both
distributions and their drill-down results.

**Acceptance Scenarios**:

1. **Given** that Challenge, **When** I open its statistics, **Then** "Waypoints
   by highest recorded award" shows Bronze 0, Silver 1, Gold 1, while
   "Activities by recorded award" shows Bronze 2, Silver 1, Gold 1. The totals
   identify two member Waypoints and four Activities.
2. **Given** its Gold Waypoint total, **When** I drill down, **Then** I see
   exactly the member whose highest recorded award is Gold, not every member
   with any historical Gold regardless of its current linked records.
3. **Given** its Bronze Activity total, **When** I drill down, **Then** I see
   the two Bronze Activities and can open each record, including their
   Waypoint context.
4. **Given** a Waypoint shared with another Challenge, **When** I review either
   enabled Challenge, **Then** that member and its Activities count once within
   each Challenge. A cross-Challenge summary counts each eligible Waypoint or
   Activity once, not once per membership.
5. **Given** an empty enabled Challenge or an eligible member with no
   Activities, **When** I inspect statistics, **Then** zero totals and the
   number of members with no recorded award are explicit; drill-downs show the
   corresponding empty state rather than unrelated records.
6. **Given** an ordinary Challenge, **When** I inspect its progress and
   statistics, **Then** completion and Activity totals remain available without
   award distributions, even if a member earns awards through another Challenge.

---

### User Story 4 - Keep Ordinary Browsing Free of Award Clutter (Priority: P2)

As a user, I see awards only where they apply, with consistent language that
does not contradict completion.

**Why this priority**: Most Challenges do not use awards and should not appear
unfinished because they have no award.

**Independent Test**: Browse Dashboard, Waypoint list/details, Map, Challenge
details, and Activity history with ordinary-only and mixed datasets as an
administrator and a viewer at both target viewport sizes.

**Acceptance Scenarios**:

1. **Given** a dataset with no award-enabled Challenges, **When** I browse
   those surfaces, **Then** there are no award chips, award distributions, or
   award-specific filters/sorts, and successful completion never says
   "Award tier: Not Started".
2. **Given** a mixed dataset, **When** I view an ordinary Waypoint, **Then**
   no empty award chip appears. An eligible Waypoint shows its separately
   labelled highest award or "No award recorded".
3. **Given** a shared Waypoint, **When** I view it in an ordinary Challenge,
   **Then** that Challenge does not show an award indicator. Its global
   Waypoint page may show the award with its enabled Challenge context.
4. **Given** award filters, sorts, or totals, **When** they are available,
   **Then** they state whether they concern highest Waypoint awards or
   individual Activity awards, and use "Award" consistently rather than
   conflating awards with Waypoint categories, completion status, or medals.
5. **Given** viewer or Demo-local access, **When** I inspect definitions,
   progress, history, statistics, or drill-downs, **Then** the same information
   is readable without write controls or writes.
6. **Given** an award-applicable dataset or Challenge scope, **When** an award
   filter or other list filter produces zero matches, **Then** applicable award
   controls and the active filter remain available beside the empty state, and
   I can clear the filter to restore matching records.

---

### User Story 5 - Correct Records without Accidentally Losing Awards (Priority: P1)

As an administrator, I can deliberately correct Activities, but relationship
changes cannot silently erase or invalidate their recorded levels.

**Why this priority**: An award is part of a recorded visit, not expendable
presentation state.

**Independent Test**: Attempt to delete an awarded Waypoint, remove its last
enabled membership, or disable awards. Then handle
the identified Activities explicitly and retry the intended change.

**Acceptance Scenarios**:

1. **Given** a Waypoint with awarded Activities, **When** I try to delete it
   or remove its last award-enabled membership, **Then** the operation is
   blocked before any write, affected Activities are identified, and their
   links and awards remain unchanged.
2. **Given** awarded Activities that would lose their last eligible Challenge,
   **When** I try to delete that Challenge or disable its awards, **Then** the
   entire operation is blocked and identifies those Activities. Valid edits to
   award explanations, title, or general description remain permitted where
   editing is supported and do not change recorded award levels.
3. **Given** an awarded Activity, **When** I explicitly edit it to remove its
   Waypoint or choose an ineligible Waypoint, **Then** the pending loss of its
   award is explained before saving; only an explicit successful save removes
   it, and cancellation leaves the original record intact.
4. **Given** an awarded Activity moved to another eligible Waypoint, **When**
   I save, **Then** I explicitly confirm its level in the destination's named
   Challenge context rather than silently transferring an old interpretation.
5. **Given** an unsuccessful or cancelled correction, **When** I return to
   summaries and statistics, **Then** the original awards and totals remain;
   no success message or partial detachment is shown.
6. **Given** every awarded Activity affected by a Challenge deletion or award
   disabling remains eligible through another enabled Challenge, **When** I
   confirm the change, **Then** it succeeds, retains all Activity award levels,
   and updates the affected summaries and statistics.

### Edge Cases

- Bronze < Silver < Gold is fixed; descriptions do not create new levels or
  change their order. A missing Silver explanation is not inferred from examples.
- One shared level can have different Challenge-specific explanations. The
  application exposes the difference but does not calculate separate awards.
- Eligibility follows current Waypoint membership, not the Challenge from which
  the user navigated or an optional direct Activity-to-Challenge link.
- New enabled memberships apply the shared level to their existing member
  Activities. Reject enabling or membership changes when retained Activities
  would become eligible without tiers. Award settings and membership actions
  provide no historical conversion flow; identify the blocking Activities and
  explain this limitation without suggesting tier assignment while ineligible.
  Do not backfill, migrate, or automatically alter history.
- Removing an enabled membership while leaving another preserves the shared
  Activity awards and recomputes the affected Challenge's totals. It does not
  imply that an award belonged exclusively to the removed membership.
- Deleting a Challenge or disabling its awards is likewise permitted if every
  affected awarded Activity retains an eligible Challenge. If even one would
  lose its last eligible Challenge, the entire change is blocked without writes.
- Award explanations are editable current guidance, including after awards have
  been recorded. Earlier explanation versions are not retained; revising the
  guidance does not reclassify Activities or change their recorded levels.
- Handling invalidated history means deliberate Activity corrections,
  reassignment, or deletion, not an automatic cleanup.
- Every currently linked Activity contributes once to its Waypoint's completion,
  independent of award. Direct Challenge links and Ideas are not alternate
  sources of member completion or award statistics.
- Removing the sole highest Activity can lower the displayed highest award;
  there is no separately retained permanent achievement.
- An awarded Activity without an eligible Waypoint is invalid. Incompatible
  loaded or imported data fails explicitly; no migration or silent tier removal
  is authorized.
- Loading, missing records, failed loads, empty results, and zero counts remain
  distinct. Production failures never substitute Demo or stale data.
- Long Challenge names and explanations, shared memberships, filtered empty
  results, and zero-count drill-downs remain readable on narrow and wide screens.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Challenges MUST default to awards disabled. Enabling awards MUST
  require nonblank Challenge-specific explanations for Bronze, Silver, and Gold.
  The offered levels and their order MUST remain fixed. Valid explanation edits
  MUST be allowed after Activities exist, update current guidance, and leave
  recorded levels unchanged; previous explanation versions are not retained.
  Enabling or membership changes that leave retained Activities eligible but
  unawarded MUST fail without writes, identify those Activities, and explain
  that these actions provide no historical conversion or automatic backfill.
- **FR-002**: Enabled Challenge details and eligible Activity recording MUST
  expose the named Challenge's explanations. Shared eligible memberships MUST
  show all applicable explanations and state that one level applies to all.
- **FR-003**: An Activity linked to a Waypoint in any enabled Challenge MUST
  record exactly one Bronze, Silver, or Gold award. Activities without such an
  eligible Waypoint MUST NOT record an award. No automatic award is permitted.
  New Activities MUST start without a tier selected. Editing without changing
  the Waypoint MUST preserve the recorded tier; a changed eligible destination
  MUST require a deliberate tier choice.
- **FR-004**: These rules MUST be enforced consistently for Activity creation,
  editing, structured entry, imports, loading, and protected writes. Invalid
  input MUST fail explicitly without partial writes; valid drafts and specific
  validation messages MUST remain available for correction.
- **FR-005**: Waypoint summaries MUST derive the highest award from currently
  linked Activities using Bronze < Silver < Gold and label it "Highest recorded
  award". Eligible members without Activities MUST show "No award recorded".
- **FR-006**: Award-enabled Challenge member summaries MUST show that same
  highest level. Ordinary Challenge views MUST NOT present awards, including
  awards a shared member earns through another Challenge.
- **FR-007**: Activity history and details MUST show each Activity's own level.
  Latest-visit dates MUST be distinguished from highest-award summaries.
  Edits, deletion, and reassignment MUST recalculate affected loaded summaries.
- **FR-008**: Enabled Challenge statistics MUST separately expose member
  Waypoints by highest recorded award, Activities by their individual recorded
  award, total members, members without recorded awards, and total Activities.
  All totals MUST name their unit and Challenge scope.
- **FR-009**: Each award-distribution total MUST support a matching scoped
  drill-down to the contributing Waypoints or Activities, with navigable records
  and an explicit empty state. Ordinary Challenges MUST retain completion and
  Activity totals without award distributions.
- **FR-010**: Per-Challenge counts MUST include current members and their linked
  Activities once each. Cross-Challenge award summaries MUST count each eligible
  entity once, without multiplying it by shared memberships.
- **FR-011**: Dashboard, Waypoint lists/details, Challenge entries/statistics,
  Activity surfaces, and Map controls MUST use consistent award terminology and
  distinguish highest Waypoint awards from individual Activity levels.
  Inapplicable indicators and award controls MUST be absent from ordinary-only
  views; Waypoint category and completion MUST remain separate concepts.
  Award-control applicability MUST use the selected dataset or Challenge scope
  before list filters and pagination. Empty results MUST retain applicable
  controls and the active filter so it can be cleared.
- **FR-012**: Waypoint or Challenge deletion, award disabling, and relationship
  changes MUST be blocked if any awarded Activity would lose its eligible
  Waypoint or its last award-enabled Challenge. Challenge deletion, disabling,
  or membership removal MUST be permitted when every affected award remains
  eligible through another Challenge. A specific blocking message MUST identify
  the affected Activities and what needs handling; no automatic award clearing,
  history rewrite, partial change, or detached-history mechanism is permitted.
- **FR-013**: Explicit Activity edits that remove award eligibility MUST explain
  the resulting award removal before saving. Moves to an eligible destination
  MUST require explicit confirmation of the level in its new context. Cancelled
  or failed edits MUST retain the original record and summaries.
- **FR-014**: Completion MUST remain based on each Waypoint's existing once/count
  rule. Award level MUST NOT weight completion or imply a member is done before
  its Activity target is met.
- **FR-015**: Viewers and read-only Demo users MUST have identical readable
  definitions, summaries, history, statistics, and drill-downs for identical data,
  without write actions or writes and with existing read-only explanations.
- **FR-016**: Changed flows MUST work at 360x800 and 1280x800 without horizontal
  page scrolling, clipped or overlapping content, keyboard traps, or reliance on
  colour alone. Definitions, invalid-field feedback, and navigation MUST be
  accessible with visible focus.
- **FR-017**: Related guidance, examples, and structured-entry instructions MUST
  agree on conditional mandatory awards, shared levels, highest-award summaries,
  statistical units, and protection of recorded history.

### Key Entities _(include if feature involves data)_

- **Challenge award scheme**: Enabled or disabled; when enabled, explains each
  of the fixed Bronze, Silver, and Gold levels for that Challenge.
- **Waypoint**: May belong to multiple Challenges; eligibility follows whether
  any assigned Challenge enables awards. Completion is independent of awards.
- **Activity award**: One required level on an eligible linked Activity, shared
  across the Waypoint's enabled Challenges. It describes that visit, not the
  Waypoint's permanent completion state.
- **Highest recorded award**: A derived maximum across currently linked
  Activities, never a separately retained achievement record.
- **Challenge statistics**: Scoped distributions of distinct member Waypoints
  and their Activities, with separately labelled units and matching drill-downs.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: All ordinary, single-enabled, and shared-enabled recording cases
  offer exactly the applicable choices and explanations. All eligible missing-
  award cases reject; all ineligible supplied-award cases reject across the
  supported entry and data boundaries. An unrelated same-Waypoint edit preserves
  its recorded tier; new Activities and changed eligible destinations have no
  automatically selected tier. Enabling over retained unawarded history rejects
  without writes and explains the conversion limitation.
- **SC-002**: Bronze, Gold, Bronze yields a Gold headline and three correctly
  labelled individual records on every relevant surface. Changing or removing
  the sole Gold updates all affected loaded summaries without manual reload.
- **SC-003**: The two-member, four-Activity acceptance dataset produces exactly
  two highest-award Waypoint entries and four recorded-award Activity entries,
  with every drill-down returning exactly its stated count.
- **SC-004**: Shared membership never duplicates records within a Challenge or
  cross-Challenge total. Ordinary Challenge views expose zero award indicators
  even when their members are eligible elsewhere.
- **SC-005**: Every invalidating maintenance case is blocked before writes,
  identifies the affected Activities, and preserves all recorded awards and
  links. Shared-Challenge removal or disabling cases succeed when all awards
  remain eligible, with no award loss. Deliberate Activity corrections require
  the specified acknowledgement.
- **SC-006**: Ordinary-only browsing exposes zero award chips, distributions,
  or award-specific filters/sorts. Eligible no-history cases show "No award
  recorded", never a contradictory completion message. In an applicable scope,
  zero-match filters retain their controls and can be cleared to restore records.
- **SC-007**: All applicable configuration, recording, summary, statistics,
  drill-down, and correction cases pass at both target viewport sizes; viewer
  cases show the same information with zero write actions or writes.
- **SC-008**: Once/count completion results remain identical for equivalent
  Activity counts at every award level, including count targets not yet met.

## Assumptions

- This is a new improvement feature, separate from
  [the Challenge Activity journey](../016-challenge-activity-journey/spec.md).
  That feature's preservation of conditional mandatory selection is intentional.
  Where they overlap, this feature defines the comprehensive award terminology,
  eligible empty state, scope, statistics, and historical protection rules.
- The UX report's earlier recommendation for optional Activity awards and its
  uncertainty over highest-versus-latest summaries were superseded by the user's
  clarifications. Mandatory selection and highest aggregation are not defects.
- Shared levels are deliberate. This feature does not add per-Challenge Activity
  awards, configurable level names, subsets, automatic assessment, or criteria
  inference.
- Award explanations describe what the user should select; they do not
  automatically classify duration or overnight stays.
- New authoring and explanation updates remain limited to the award feature;
  unrelated Challenge-management capabilities are not introduced.
- Existing authentication, data modes, approved services, Activity validation,
  saving protections, and navigation remain constraints. No migration, live-data
  correction, offline cache, compatibility layer, new service, or deployment is
  authorized. Incompatible persisted records fail explicitly.
- The awards UX report was source/test-definition grounded; browser access
  timed out and its test request executed no tests. This specification does not
  claim those acceptance checks passed.
