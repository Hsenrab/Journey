# Feature Specification: Structured Draft Entry and Prompt Help Baseline

**Feature Branch**: `009-structured-draft-entry`
**Created**: 2026-10-20
**Status**: Current-state baseline; source-reviewed, not newly runtime-verified
**Input**: Document shared Paste JSON, example copying, validation, and external-AI
prompt help. Extract shared rules from entity baselines without changing behaviour.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Load a Structured Draft for Review (Priority: P1)

As a user entering a record, I can paste structured content into a reviewable
form instead of manually entering every field.

**Why this priority**: Structured entry is useful only if it remains separate from saving.
**Independent Test**: Inspect valid and invalid fictional drafts for all three record types.

**Acceptance Scenarios**:

1. **Given** an available record editor, **When** I select Paste JSON, **Then**
   I can enter one draft object and explicitly choose Load into form.
   This is available for Waypoint add/edit and Idea/Activity add, not Idea/Activity edit.
2. **Given** an accepted draft, **When** I load it, **Then** its supported fields
   populate the form, the editor returns to Form, and no persisted change occurs
   until the separate entity save succeeds.
3. **Given** invalid JSON, an array, a primitive, missing required keys, unsupported
   keys, or supplied record identities, **When** I load it, **Then** an error
   appears, entered JSON remains available, and invalid content does not replace
   the form. Field issues are listed when validation provides them.
4. **Given** existing relationship selections, **When** a draft loads, **Then**
   entity links remain editor-managed rather than supplied by the JSON.
   Accepted content is not a whole-dataset backup or a batch of records.
5. **Given** JSON mode, **When** the form is submitted directly, **Then** it does
   not bypass the explicit load/review step to save a record.

### User Story 2 - Obtain an Example or External Drafting Prompt (Priority: P2)

As a user, I can copy an example or the appropriate prompt to prepare a draft
outside Journey, without Journey calling an AI service.

**Why this priority**: Guidance makes the strict draft format discoverable.
**Independent Test**: Inspect each example/prompt and clipboard success/failure behaviour.

**Acceptance Scenarios**:

1. **Given** Paste JSON mode, **When** I choose Copy example JSON, **Then**
   the record-specific example is copied, not submitted or automatically loaded.
2. **Given** the record-specific prompt help button, **When** I open it, **Then**
   a dialog shows read-only prompt text and instructions to use an external AI
   tool, then paste its response back into Journey.
3. **Given** the prompt dialog, **When** I choose Copy prompt, **Then** its text
   is copied; Close dismisses it without changing the record draft.
4. **Given** unavailable or rejected clipboard access, **When** either copy
   action fails, **Then** an explicit local error is shown. Retrying prompt copy
   clears the prior prompt-copy error before another attempt.
5. **Given** Activity prompt help, **When** I read its instructions, **Then**
   it requests a factual historical account grounded only in supplied material,
   without external research. Idea and Waypoint prompts permit confirmable
   research and prohibit invented detail. These are prompt instructions, not
   guarantees about an external tool's output.

### Edge Cases

- Draft validation is not persistence authorization, successful geocoding, or
  proof that all entity form rules will pass; those checks still apply at save.
- Optional blank metadata is normalized only where the existing draft parser
  explicitly supports it; required keys are not silently invented.
- Loading a draft replaces its supported form fields, not a merge of every
  existing field. Unsupplied editor-managed links and Activity track remain separate.
- No automatic AI request, website fetch, research, Markdown stripping, multi-object
  import, compatibility conversion, or record-ID preservation is provided.
- Clipboard errors are failures, not claims of successful copying; no clipboard
  workaround is implied.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Editors MUST expose the documented Form/Paste JSON availability matrix.
- **FR-002**: Loading MUST validate one supported draft object and populate the
  reviewable form without saving or bypassing normal entity submission.
- **FR-003**: Invalid syntax, shapes, unsupported fields, and supplied identities
  MUST be rejected with errors while retaining the entered JSON.
- **FR-004**: Entity relationships MUST remain form-managed; draft entry MUST NOT
  act as dataset restore or import persisted identities.
- **FR-005**: Each supported editor MUST offer its example and read-only external
  prompt help with explicit copy actions and a dismissible dialog.
- **FR-006**: Clipboard failures MUST be explicit; prompt-copy retry MUST clear
  its prior error before attempting to copy.
- **FR-007**: Prompt help MUST distinguish historical Activity grounding from
  planning/destination research without invoking an integrated AI service.
- Non-whitespace unapplied JSON, valid or invalid, participates in the
  [data-mode discard boundary](../002-data-modes-persistence/spec.md#functional-requirements).
  Cancelling navigation to Settings or a direct mode switch retains the text;
  confirmed discard clears it without transferring it to another dataset.
  Whitespace alone is not dirty. Clearing JSON does not clear applied form edits.
  This frontend behaviour is covered by the local mode-switch regression evidence;
  it does not certify the other acceptance criteria in this baseline.

### Key Entities

- **Draft object**: Supported record fields without persisted identity or entity links.
- **Example**: A fictional record-specific illustration of the draft format.
- **Prompt**: Copyable instructions for an external tool, not an executable Journey service.
- **Validation result**: Accepted draft or explicit error with optional field issues.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: All three record types have documented valid/invalid outcomes, and
  the add/edit availability matrix has no implied unsupported editor.
- **SC-002**: Loading an accepted draft performs zero persistence writes; invalid
  drafts preserve the entered JSON and do not replace the current form.
- **SC-003**: All three examples/prompts have mapped evidence; copy success,
  unavailable clipboard, and rejected clipboard outcomes are explicit.
- **SC-004**: Entity baselines reference this shared contract while retaining their
  own fields and save rules, with no claim of freshly executed acceptance.

## Assumptions

- [Waypoints](../003-waypoint-management/spec.md),
  [Ideas](../005-idea-planning/spec.md), and
  [Activities](../006-activity-recording/spec.md) own field meaning, validation,
  relationships, and persistence actions.
- [Access](../001-access-roles/spec.md) and
  [data modes](../002-data-modes-persistence/spec.md) govern editor availability.
- [GPX](../008-gpx-import-geometry/spec.md) owns route/track import, not JSON drafts.
- External tool output is untrusted input and must be reviewed. No external tool
  is contacted or endorsed by completing this documentation-only baseline.
- The original baseline authorized no application changes. The separately
  authorized safe-mode-switch implementation adds only the transient discard
  participation described above; prompt content, deployments, and hosted data
  remain unchanged.
