# Research: Activity Recording Experience

## Scope and method

Repository-source research for the existing stack; no new technology or external
service selection is required. Decisions below resolve the implementation unknowns.
This is not browser testing or evidence that the feature already works.

## 1. Mandatory title without schema renaming

**Evidence**: `src/domain/visit.ts` makes `ActivitySchema.name` optional,
`createActivity` converts empty names to undefined, and `activityTitle` falls back
to a formatted date. `ActivityDraft` and `ActivityJsonImportDraft` also use optional
names; `api/src/lib/journeySchema.ts` accepts an optional name.

**Decision**: Retain `name` as the required trimmed data property, expose "Activity
title" in the UI, remove obsolete fallback display behavior, and update all
constructors, ingestion paths, examples, prompts and affected test fixtures.

**Rationale**: The requirement concerns a mandatory title, not renaming every
serialized field. A single existing field is smaller and unambiguous.

**Alternatives considered**: Rename to `title` (unnecessary format churn); add a
second title field or generate names (competing sources/silent backfill).

## 2. UK calendar dates at every boundary

**Evidence**: The editor defaults to UTC today and independently validates calendar
dates. The frontend schema checks real dates; the API currently checks only
`YYYY-MM-DD` shape. Both packages already target runtimes with `Intl` support.
The user explicitly chose non-future dates and UK time including BST.

**Decision**: Use `Europe/London` with `Intl.DateTimeFormat.formatToParts` and
assemble an ISO calendar date. Combine real-date validation with a dynamic UK-date
cutoff in frontend/API schemas and editor feedback. Keep a tiny helper in each
package, with matching deterministic boundary tests.

**Rationale**: Handles BST correctly without dependencies, client settings, or
daylight-saving offset arithmetic. `api/tsconfig.json` has its own root/output;
pulling frontend modules into it would change deployment packaging.

**Alternatives considered**: UTC/device dates (contradict clarification); date
library or shared package/build copying (unneeded dependency/infrastructure).

## 3. Deliberate persisted-contract replacement

**Evidence**: Cosmos Activity documents currently use version 4 and explicitly
accept version 3 without tracks. `JourneyDocumentSchema` validates documents on
load; `JourneyDataSchema` validates imports and replacement data.

**Decision**: Activity version 5 expresses required title and strict non-future
real dates. Reject obsolete Activity versions; retain all unrelated versions.
Update seed/test tooling through existing schema consumers and document the
breaking failure. Do not migrate or edit hosted data.

**Rationale**: Existing versioned documents should not imply the obsolete contract
is still supported. The constitution explicitly requires breaking errors rather
than compatibility or migration.

**Alternatives considered**: Accept old versions or synthesize names (compatibility
not authorized); silently filter invalid Activities (data loss).

## 4. One explicit asynchronous save lifecycle

**Evidence**: `ActivityEditor.onSubmit` returns void while pages supply async
functions. Save only checks GPX parsing. `runMutation` counts pending operations
but does not deduplicate them. Pages already own save error/conflict messages.

**Decision**: Editor-owned synchronous submit lock and pending state; asynchronous
success/failure result from the page, followed by an explicit success callback
after unlocking. Keep handled failures visible at their page boundary.

**Rationale**: All entry points use one guard, including multiple events before a
render. Success navigation cannot fight the pending blocker. Explicit failure is
not inferred from a callback merely resolving.

**Alternatives considered**: Disabled button alone (same-tick/keyboard gaps);
global request deduplication or idempotency store (out of scope); pages swallowing
errors and resolving indistinguishably from success (ambiguous lifecycle).

## 5. Supported navigation blocking

**Evidence**: `App.tsx` uses declarative `BrowserRouter`; Layout only intercepts
Settings links. Existing draft registration protects data-mode/Settings changes,
and editors install before-unload warnings.

**Decision**: Use React Router's supported data-router setup and `useBlocker` for
the pending Activity editor. Preserve routes and provider behavior; migrate
affected test wrappers to memory data routers. Discard blocked navigation attempts.

**Rationale**: A link-only guard cannot cover browser history or programmatic
navigation. The installed router supports blocking through its data-router APIs.

**Alternatives considered**: Browser history monkey-patching or click interception
alone (incomplete workaround); disabling navigation permanently after failure
(traps users); full reload recovery storage (not authorized).

## 6. Optional sections and accessible correction

**Evidence**: GPX, References, and Photos are currently expanded. Validation stores
errors but does not focus the first invalid field; coordinates use separate text.
The UI guidelines explicitly support Accordion for secondary content and require
field-associated help and consistent MUI controls.

**Decision**: Local accordion state, initialized from actual content, opens on
applied content or errors. Keep values, associate helper text, and focus in visual
reading order after revealing the invalid control. Distinguish optional evidence
from required core fields and conditional Award tier.

**Alternatives considered**: Multi-step wizard or new editor framework (unneeded);
collapsing populated/error sections without an indication (hides important state).

## 7. Idea-origin success

**Evidence**: `Activities.tsx` returns directly to the Idea without a success
message. Idea usage already derives from loaded Activity links.

**Decision**: One-shot typed navigation feedback consumed by IdeaDetails; use the
saved Activity's actual identity returned by `addActivity` for its link. Allocate
the ID before the reducer action so computing the next dataset and test-mode
dispatch cannot create different identities. Preserve Activities destination if
the Idea was unlinked, and reuse provider updates rather than a feedback-only read.

**Alternatives considered**: Query-string success flag (replays/bookmarks as truth);
matching records by title/date (duplicates are legitimate); new notification store
(unnecessary scope).

## Research outcome

No unresolved clarification or new dependency. Main implementation risks are
router/provider lifetime, same-tick locking, releasing the blocker before success
navigation, deterministic clocks across existing fixtures, and explicit load
failures for old Activity documents. Each has acceptance coverage in the plan.
