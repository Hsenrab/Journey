# Data Model: Access and Roles Baseline

**Scope**: Describe existing runtime and platform state. No new persisted model,
schema version, migration, or role-management store is proposed.

## Client Principal

Source: [principal.ts](../../api/src/lib/principal.ts).

| Field              | Current representation | Authorization significance                                                                                                               |
| ------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `identityProvider` | String                 | Must equal `aad`.                                                                                                                        |
| `userId`           | String                 | Must be nonempty; it is not compared against a single-user allowlist.                                                                    |
| `userDetails`      | Display string         | Not an authorization key; parser defaults missing display text to an empty string.                                                       |
| `userRoles`        | String array           | Must contain `authenticated` and exactly one distinct supported Journey role. Other platform roles do not substitute for a Journey role. |

The platform forwards the encoded principal at the hosted boundary; it is not an
application entity that the browser may create or save. The existing parser
rejects absent/malformed required fields and filters non-string role entries.
This plan tests that actual parser contract rather than inventing a new strict
identity schema.

## Journey Role

Existing values: `admin` and `viewer`. The frontend also has a `local` sentinel;
it is not an assignable platform role and grants no hosted privileges.

- Both supported roles allow reads of the same selected shared dataset.
- Only `admin` allows a supported stored mutation after data validation.
- Neither role and both roles are rejected by protected backend operations.
- Duplicate occurrences of one supported role do not create two distinct roles;
  the validator checks membership of the two known values.
- Tenant/organization membership is not a separate application authorization field.

## Hosted Resource Assignment

Owned by the hosting platform, not Cosmos or browser storage.

Conceptual relationship: a platform identity has a Journey role assignment for a
particular Static Web App resource. Invitations and role assignment on one resource
do not grant a role on another resource. Operators manage assignments externally.
No application invitation entity, administrator screen, tenant table, or ownership
field is introduced.

## Loaded Dataset Envelope

Source: [Journey handler](../../api/src/functions/journey.ts) and
[frontend client](../../src/services/journeyApi.ts).

| Field       | Source                       | Purpose                                                             |
| ----------- | ---------------------------- | ------------------------------------------------------------------- |
| `data`      | Dataset GET response         | Existing validated Journey entity graph.                            |
| `etags`     | Dataset GET response         | Existing concurrency tokens keyed by document ID.                   |
| `datasetId` | Handler configuration        | Active server-side partition identifier.                            |
| `role`      | Validated platform principal | `admin` or `viewer`, returned by GET and validated by the frontend. |

No per-user filtering, owner field, role document, or backup-schema change is planned.
Mutation responses do not universally include `role`; the context retains its
loaded role until a subsequent dataset load.

## Frontend Access State

Source: [Journey context](../../src/features/journey/JourneyContext.tsx) and
[status rules](../../src/domain/dataMode.ts).

| Field                 | Existing states                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Requested/active mode | `production`, `demo-cosmos`, `demo-local`; these may differ during fallback.                                       |
| Loaded role           | `admin`, `viewer`, or `local`.                                                                                     |
| Load state            | Loading; loaded, optionally with a warning; failed with a message.                                                 |
| Writability           | Loading, viewer, local demo, and failed Production are read-only. Normal remote writes additionally require admin. |

### Relevant Transitions

1. Selecting a shared dataset starts loading and blocks edits.
2. Successful GET applies data, ETags, and the backend role.
3. Viewer data remains readable but not mutable, including after a mode switch.
4. Selecting local demo sets the `local` sentinel and remains read-only.
5. Demo Cosmos load failure selects the explicitly labelled read-only local demo.
6. Production load failure blocks writes and export; a prior displayed snapshot
   may remain in state but is not treated as a successful fresh load.
7. Invitation/role changes are reflected through platform session refresh and a
   later request/load, not a new application polling mechanism.

All automated permission tests must use mocked remote mode, not the legacy
test-only local storage path.
