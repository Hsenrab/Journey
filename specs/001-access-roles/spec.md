# Feature Specification: Access and Roles Baseline

**Feature Branch**: `001-access-roles`

**Created**: 2026-10-17

**Status**: Draft baseline for owner review

**Input**: User description: "Start with access and roles: document existing behavior,
using the implementation, tests, and project guidelines. Do not change application behavior."

## Clarifications

### Session 2026-10-17

- Q: Which Microsoft Entra work accounts should be eligible for an invitation to Journey?
  A: Any explicitly invited Entra work identity, regardless of organization; an invitation
  and exactly one Journey role are still required for protected data and map operations.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Enter the Private Application (Priority: P1)

As an invited user, I can sign in with my Microsoft Entra work identity and reach
the page I requested. Signing in alone does not grant access to Journey data.

**Why this priority**: The application contains private shared information; access
must be limited to invited identities before useful journeys can begin.

**Independent Test**: Open a protected page while signed out, complete sign-in
as an invited user, and confirm access to the requested page. Repeat with an
authenticated account that has no Journey invitation.

**Acceptance Scenarios**:

1. **Given** a signed-out visitor requests a protected page or supported deep link,
   **When** access is checked, **Then** sign-in starts before the application loads,
   with the requested location retained for the return journey.
2. **Given** an invited user with one Journey role completes sign-in,
   **When** the application is reached, **Then** the requested route is available.
3. **Given** a user has authenticated but has neither Journey role,
   **When** they request the application or protected services,
   **Then** access is denied; authentication or consent alone grants no Journey access.
4. **Given** a request has no valid authenticated identity, an unsupported identity
   provider, no user identifier, no Journey role, or both Journey roles,
   **When** it requests protected data or map services,
   **Then** the request is denied rather than treated as an administrator or viewer.

---

### User Story 2 - Browse Shared Data as a Viewer (Priority: P1)

As a viewer, I can browse the same shared records as an administrator, use
read-only map features, and export the loaded dataset without changing it.

**Why this priority**: Read-only sharing is useful only when browsing works and
write restrictions cannot be bypassed.

**Independent Test**: Sign in as a viewer, inspect shared lists and detail pages,
view a map, export the loaded dataset, and attempt each supported kind of change
both through the interface and outside the normal editing controls.

**Acceptance Scenarios**:

1. **Given** a viewer and an administrator use the same hosted application and
   shared dataset, **When** each browses it, **Then** both can read its records;
   records are not filtered by creator or owner.
2. **Given** a viewer has successfully loaded Production or Demo Cosmos data,
   **When** they open lists, detail pages, or Settings,
   **Then** they can browse but cannot create, edit, delete, import, restore,
   clear, replace, or modify relationships, links, or saved routes.
3. **Given** a viewer attempts a change without using the normal interface,
   **When** authorization is evaluated, **Then** the change is rejected and
   the stored records remain unchanged.
4. **Given** a viewer is browsing a successfully loaded shared dataset,
   **When** the access status is displayed, **Then** it identifies viewer
   read-only access. Collection and detail pages that hide write actions explain
   why editing is unavailable and link to Settings.
5. **Given** a viewer has a loaded dataset,
   **When** they export it, **Then** a backup of that active dataset is available
   without modifying the stored data.
6. **Given** a viewer has valid access,
   **When** they request read-only map viewing or location lookup,
   **Then** their viewer role does not itself prevent that read operation.

---

### User Story 3 - Manage Shared Data as an Administrator (Priority: P1)

As an administrator, I can manage the active shared dataset while remaining
subject to its normal validation and availability rules.

**Why this priority**: Administrators must be able to maintain records without
turning the role into permission to bypass other data constraints.

**Independent Test**: Sign in as an administrator and exercise valid record changes
in each writable shared dataset. Confirm that local demo data, loading states,
and failed production loads do not become writable.

**Acceptance Scenarios**:

1. **Given** an administrator has successfully loaded Production or Demo Cosmos,
   **When** they submit a valid supported change,
   **Then** it is permitted in the active dataset subject to normal validation.
2. **Given** an administrator selects Demo local, including the visible local demo
   fallback, **When** they try to edit,
   **Then** it remains read-only despite their administrator role.
3. **Given** a dataset is still loading or Production has failed to load,
   **When** an administrator tries to change records,
   **Then** the operation is blocked.
4. **Given** an administrator tries to restore a backup into a nonempty active
   shared dataset, **When** the restore is evaluated,
   **Then** it is rejected; administrator access does not bypass the empty-dataset rule.

---

### User Story 4 - Assign Access Outside the Application (Priority: P2)

As the application operator, I assign access to approved identities for each
hosted application without maintaining a second role-management interface in Journey.

**Why this priority**: Clear assignment and session-refresh procedures make access
usable without adding an application administration feature.

**Independent Test**: On a hosted test application, assign one role, accept the
invitation, sign out and back in, and check the resulting access. Repeat separately
for the other hosted application; test role replacement using the operator procedure.

**Acceptance Scenarios**:

1. **Given** an approved identity needs access,
   **When** the operator issues an invitation with one Journey role and that
   identity accepts it, **Then** the assignment is associated with that identity.
   A work identity from another organization is eligible for invitation on the
   same terms; belonging to any organization alone grants no access.
2. **Given** an identity has access to one separately hosted application,
   **When** it uses another hosted application without an invitation there,
   **Then** the first assignment does not grant access to the second.
3. **Given** an invitation has just been accepted or a role has changed,
   **When** the user signs out and back in,
   **Then** access is evaluated from the refreshed identity and assigned role.
4. **Given** an operator needs to audit, replace, or revoke an assignment,
   **When** they follow the hosting platform's role-management procedure,
   **Then** no in-application role-management screen is required.

### Edge Cases

- Both `admin` and `viewer` are assigned: protected data and map operations are
  denied, not resolved by choosing the more or less privileged role. This baseline
  does not claim that the application shell is blocked before it loads.
- Missing, malformed, or incomplete identity information is rejected for protected
  operations; it is not interpreted as local-development access.
- An authenticated identity without a Journey role is not a viewer. Unrelated
  platform roles do not substitute for `admin` or `viewer`.
- Switching datasets does not grant a viewer edit rights. Selecting local demo data
  never grants write access to either role.
- A dataset load warning or failure can take precedence over the viewer explanation.
  The displayed reason must describe the active read-only state, not imply that
  changing data mode upgrades the user's assigned role.
- Export requires a successfully loaded active dataset. Read-only access alone
  does not prevent export.
- An existing session can retain earlier role information. Immediate revocation
  or privilege refresh in an already-open page is not promised by this baseline.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The hosted application MUST start Microsoft Entra sign-in for
  unauthenticated access to protected pages and retain the requested return location.
- **FR-002**: Application entry MUST require at least one of the invited Journey
  roles. An authenticated user with neither role MUST be denied entry.
- **FR-003**: Every protected data or map operation MUST require an authenticated
  Microsoft Entra identity, a nonempty user identifier, and exactly one of `admin`
  or `viewer`. Missing, malformed, incomplete, unsupported, unassigned, or
  ambiguously assigned identities MUST be denied.
- **FR-004**: Administrators and viewers MUST read the same complete shared dataset
  when using the same hosted application and selected data source.
- **FR-005**: Viewers MUST NOT create, update, delete, import, restore, clear, replace,
  or change saved relationships, links, or routes in either shared dataset.
- **FR-006**: Viewer write restrictions MUST be enforced independently of the visible
  controls. Bypassing the normal interface MUST NOT authorize a stored change.
- **FR-007**: The interface MUST identify loaded viewer access as read-only, hide
  or disable relevant write controls, and explain read-only access on collection
  and detail pages where write actions are hidden, with a link to Settings.
- **FR-008**: Both roles MUST be allowed to export the active successfully loaded
  dataset and use authorized read-only map services.
- **FR-009**: Administrators MUST be allowed supported changes to loaded Production
  and Demo Cosmos data, subject to the same validation and data-integrity rules
  as any other permitted write.
- **FR-010**: Administrator access MUST NOT make Demo local writable, permit writes
  during loading or after a failed Production load, or allow a restore into a
  nonempty shared dataset.
- **FR-011**: Switching data modes MUST NOT upgrade a user's assigned role or give
  a viewer permission to change records.
- **FR-012**: Role assignment MUST be administered through invitations outside
  Journey, separately for each hosted application. Any Microsoft Entra work
  identity MUST be eligible for an explicit invitation regardless of organization;
  Journey MUST NOT add a single-organization eligibility restriction.
  An invitation and exactly one Journey role remain required for protected data
  and map operations. Journey MUST NOT provide its own role-management interface.
- **FR-013**: The operator guidance MUST cover invitation acceptance, auditing,
  role replacement and revocation, and signing out and back in to refresh access.
  Authentication consent alone MUST NOT be described as granting a role.

### Key Entities _(include if feature involves data)_

- **Invited identity**: An authenticated work identity with a stable user identifier
  and an assignment for a particular hosted application. Work identities from
  different organizations are eligible; organization membership alone grants no access.
- **Journey role**: Either `admin` or `viewer`. Exactly one authorizes protected
  data and map operations; neither and both are invalid.
- **Hosted application**: A separately managed application with its own invitations;
  access to one does not imply access to another.
- **Active dataset and access state**: The selected shared or local demo data,
  its loading status, and whether the current identity may modify it.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: For every route in the
  [route and page audit inventory](quickstart.md#route-and-page-audit-inventory),
  using a representative deep link for each parameterized route, a signed-out
  visitor is directed to sign-in and an invited user can return to the requested
  location after successful authentication. The root route retains its normal
  redirect to `/challenges`.
- **SC-002**: Across both shared datasets, all six write categories (create, update,
  delete, import, replace, and clear) are rejected for viewers, with zero stored
  changes. Relationship and saved-route edits are included within update/replace.
- **SC-003**: Each invalid-access category in FR-003 is denied protected data and
  map access, with zero successful protected operations.
- **SC-004**: Both valid roles can read the same shared records and export a loaded
  dataset; only administrators can perform valid stored changes in writable datasets.
- **SC-005**: Every collection/detail page marked for a read-only notice in the
  [route and page audit inventory](quickstart.md#route-and-page-audit-inventory)
  explains its read-only state and links to Settings where writes are hidden.
  Settings does not enable viewer import or clear actions.
- **SC-006**: A role assignment on one hosted application grants no access to a
  second application without its own assignment. An invited work identity from
  another organization is eligible on the same terms as any other invited work identity.

## Assumptions

- This is a living, existing-behavior baseline for review, not authorization to
  implement a new authentication system or alter permissions.
- Scope covers application entry, protected-service authorization, shared-data
  visibility, read-only presentation, and the operator access-assignment procedure.
- Detailed data-mode lifecycle, fallback behavior, backup formats, map behavior,
  and individual entity editing rules belong in separate feature specifications;
  they appear here only where they constrain permissions.
- Per-entity ownership, per-user datasets, editor roles, viewer link mutations,
  personal-account support, application-based role management, and immediate
  revocation of already-open sessions are outside this baseline.
- The existing hosting service performs sign-in, identity forwarding, and invitation
  management. Its operational configuration is a dependency, not recreated locally.
- This draft is based on repository evidence. Live invitations, session-refresh
  timing, and hosted redirect behavior have not been verified in this exercise.
  [Evidence and review notes](evidence.md) distinguish implemented behavior,
  documented operations, and remaining verification gaps.
