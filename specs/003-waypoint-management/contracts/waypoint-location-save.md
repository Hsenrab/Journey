# Waypoint Location Save Contract

Applies to US2, FR-005, and SC-005. Existing FR-006/FR-008/FR-010 and the
[data-mode contract](../../002-data-modes-persistence/spec.md) remain applicable.

## Form and JSON-loaded drafts

- Create without a location is valid.
- Create with searchable place/address text and no coordinates resolves on save.
- Edit with changed identifying text and an untouched initial pair submits no
  stale pair; resolve the new text before persistence.
- Clearing both identifying fields from a named location with untouched
  coordinates removes the entire location and its metadata.
- Newly supplied/changed valid coordinates win over text resolution.
- An unchanged coordinate-only location remains valid.
- Text comparison ignores leading/trailing whitespace; coordinate comparison
  uses numeric values, not display formatting.
- Invalid explicit input blocks save before normalization; partial pairs are never
  converted into lookup requests. Metadata-only locations without a pair fail.
- Source/approximate edits alone do not change coordinates.
- Failure retains entered form values, including old displayed coordinates if
  they were invalidated only for submission; they are not considered saved.
- Existing JSON review, identity, Challenge selection, references, and photo rules
  remain unchanged. All reviewed drafts use the same final submission rules.

## Existing protected endpoint

`POST /api/journey/{container}` with existing `operation: replace`, `data`, and
`etags` fields. Container remains `production` or `demo`; no new endpoint.

- Require the existing valid `aad` admin principal before geocoding/writing.
- Only the request's Waypoint location representation gains the unresolved-input
  allowance. Unknown/malformed fields and invalid graph links remain rejected.
- Resolve unresolved Waypoints through existing Maps Search with Function managed
  identity. Already resolved, absent, Idea, Challenge, and Activity locations do
  not trigger additional geocoding in replacement.
- Run strict saved-dataset and graph validation before creating any write batch.
- Success remains HTTP 200 with the full resolved `data` and current `etags`.
- Unresolvable location returns the expected HTTP 400 JSON error with its specific
  message; no Cosmos write and no success notification.
- Preserve existing conflict HTTP 409 behaviour and ETag matching; no automatic
  retry or overwrite. Preserve unexpected downstream failures, not empty success.
- Browser error handling follows the response rules below. Malformed expected
  payloads fail explicitly rather than inventing a message.

### Browser error-response rules

These rules apply only to unsuccessful HTTP responses; success parsing is unchanged.

- HTTP 400 and 409 require JSON regardless of the advertised content type.
- Other unsuccessful responses require JSON parsing only when `Content-Type`
  declares `application/json` or an `application/*+json` media type. Compare media
  types case-insensitively and ignore parameters such as `charset`.
- A parsed error body must be an object with an `error` string whose trimmed
  value is nonempty. Use runtime validation, not a cast. Additional fields are
  permitted and do not change error classification.
- For HTTP 409 only, `error: conflict` produces the existing
  `JourneyConflictError`; `error: data_not_empty` produces the existing
  `JourneyImportNotEmptyError`. A different valid error string is an ordinary
  error, not a typed conflict. These codes on other statuses are not classified
  as HTTP 409 errors.
- For all other valid JSON errors, include the validated message and HTTP
  status/status text in the surfaced error. Do not replace it with a generic
  status-only message.
- Other unsuccessful non-JSON responses, including missing content type and HTML
  502 responses, retain the existing HTTP status/status-text error without trying
  to parse JSON or display the response body.
- When JSON is required, malformed JSON and invalid error shapes (including
  missing, non-string, empty, or whitespace-only `error`) propagate their original
  parsing/validation errors. Do not catch them to substitute a status-only error.

## Unchanged interfaces

- `import` remains strict: no implicit geocoding or repair of imported records.
- Stored documents remain strict and use their existing schema versions.
- Single-entity create/update continue accepting explicit coordinates as
  authoritative; they do not infer editor history from place-label changes.
- Activity postcode-only replacement is not repaired here; #174 remains open for
  its Activity portion. No new guarantee is made for unrelated defects.

## Required observable checks

Verify actual replacement request/response shapes, resolved response adoption,
zero writes on lookup/validation failure, valid-pair bypass, unchanged relationship
data, conflict handling, and pending/draft guards. Tests of the single-entity
geocoding endpoint alone do not establish this contract.
