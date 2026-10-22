# Existing Access-Control Contract

**Specification**: [Access and roles](../spec.md)
**Model**: [Existing identity and access state](../data-model.md)

This documents existing supported browser/service behavior. It creates no endpoint,
new payload format, identity provider, or permission.

## Hosting Boundary

| Route class               | Current rule                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| `/.auth/*`                | Platform authentication endpoints remain reachable.                                            |
| `/api/*`                  | Hosting requires membership in `admin` or `viewer`.                                            |
| Application pages         | Hosting requires membership in `admin` or `viewer`.                                            |
| Unauthenticated rejection | The configured 401 override redirects to `/.auth/login/aad?post_login_redirect_uri=.referrer`. |

The route membership list is not an exclusive-or expression. A principal with both
roles may reach the shell but must fail protected backend validation. Do not assert
identical HTTP behavior for hosting rejection and handler rejection: the platform
may return a login redirect or access-denied response, while the handlers return
their explicit JSON denial.

## Protected Principal Contract

All three backend handlers require the platform-forwarded
`x-ms-client-principal` to satisfy the existing parser and role validator.
The principal must represent `aad`, have a nonempty user ID, include
`authenticated`, and include exactly one of `admin` or `viewer`.

Expected principal validation failures return HTTP 403 with
`{"error":"forbidden"}` from the handler. They must not trigger downstream data
access, token acquisition, or search.

Browser clients use the same-origin platform proxy and do not supply an
authorization principal themselves. Synthetic headers are appropriate only for
local handler/host tests; they are not a hosted login method.

## Journey Data Interface

Existing route: `/api/journey/{container}`. Supported containers are `production`
and `demo` only. The selected partition ID is server configuration, not a
caller-provided query parameter.

| Supported client operation   | Method | Admin                                                             | Viewer               |
| ---------------------------- | ------ | ----------------------------------------------------------------- | -------------------- |
| Read selected shared dataset | GET    | 200 dataset envelope                                              | 200 dataset envelope |
| Create entity                | POST   | Normal validated create; 201 on success                           | 403 forbidden        |
| Update entity                | PUT    | Normal validated update; 200 on success                           | 403 forbidden        |
| Delete entity                | DELETE | Normal validated delete; 204 on success                           | 403 forbidden        |
| Import empty dataset         | POST   | 200 after validation; nonempty target yields 409 `data_not_empty` | 403 forbidden        |
| Replace dataset              | POST   | 200 after validation and concurrency checks                       | 403 forbidden        |
| Clear dataset                | POST   | 200 after successful change                                       | 403 forbidden        |

Mutation bodies use the existing `operation` discriminator and existing
entity/data/ETag fields; their complete schemas remain in
[journeySchema.ts](../../../api/src/lib/journeySchema.ts). Do not infer a new
method-validation rule for other registered methods from this table; it lists
the supported client invocations, not a redesign of dispatch.

GET returns `{ data, etags, datasetId, role }`; both roles see the same graph.
The frontend's role field must be `admin` or `viewer`. Viewer mutation denial
occurs before body processing, geocoding, or Cosmos data I/O. Construction of the
container client can precede viewer write denial; a test must not confuse client
construction with a downstream data operation.

The unsupported `test` container must not become an alias or new test endpoint.
Production-named route tests must mock Cosmos rather than access live production.

## Maps Read Interfaces

| Interface                        | Valid admin                          | Valid viewer        | Invalid principal |
| -------------------------------- | ------------------------------------ | ------------------- | ----------------- |
| GET `/api/maps/token`            | 200 `{ token, expiresOn, clientId }` | Same supported read | 403 `forbidden`   |
| GET `/api/maps/search?query=...` | 200 `{ results }` for a valid query  | Same supported read | 403 `forbidden`   |

The existing search query is trimmed and constrained to 2-200 characters.
Authentication does not bypass query validation or grant write access.
Maps downstream authentication remains the Function managed identity.
Do not log or persist response tokens as acceptance evidence.

## Browser Permission Contract

- `role` comes from the loaded dataset; client controls are not the backend's
  authorization authority.
- Viewers retain navigation, reading, map reads, mode selection, and loaded-data export.
- Viewer mutation controls are absent/disabled. Direct context mutation calls also
  reject in remote mode without sending a write request.
- Collection/detail pages hiding writes render the existing read-only notice;
  Settings disables restore/clear rather than needing a new access-management screen.
- Loading, local demo, and failed Production impose restrictions even on admins.
- Changing modes or following the notice's Settings link does not change the
  assigned Journey role. Error/fallback explanations may take precedence over
  the normal viewer explanation.

## Operator and Session Contract

Use the existing hosting invitation procedure separately for each resource.
Any explicitly invited Entra work identity is eligible regardless of organization,
subject to external identity/platform policies. No application tenant allowlist is added.

Assignment audit, replacement, and revocation occur outside Journey. Verify changed
access after signing out/in and loading data with the refreshed session.
Immediate revocation of an already-open page and a bespoke in-app denial page
are not part of this existing-behavior contract.
