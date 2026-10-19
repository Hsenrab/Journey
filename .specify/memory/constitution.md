# Waypoints (Journey) Constitution

## Core Principles

### I. Small, Direct Changes

Waypoints is a lightweight personal project. Changes MUST use the simplest
implementation that fully meets the current requirement, reuse applicable existing
patterns, and avoid unrelated work. Speculative abstractions, infrastructure,
configuration, and future-proofing MUST NOT be added. Unsupported requirements
MUST be reported rather than approximated with workarounds.

### II. Explicit Failures and Deliberate Breaking Changes

Unexpected failures MUST retain their specific messages and propagate to the
application root. An error MAY be caught only where an expected condition can be
fully handled. Failures MUST NOT be hidden by silent data loss, defaults, retries,
compatibility layers, or success-shaped results. Fallbacks and degraded modes
MUST NOT be added without explicit approval; existing documented exceptions remain
narrow exceptions, not precedents for further fallback behavior.

Backward compatibility and persisted-data migrations MUST NOT be added unless
explicitly requested. Obsolete behavior MUST be replaced together with its tests
and documentation; incompatible data MUST fail explicitly.

### III. Typed Domain Rules and Consistent UI

Business rules and data validation MUST remain separate from presentation.
Application boundaries MUST use explicit types and runtime validation for persisted
and imported data. Changes MUST preserve data relationships and integrity.
UI changes MUST follow the shared components, theme, and documented design rules
rather than introduce competing conventions.

### IV. Protected Cloud Access and Data Integrity

Access to private data and protected services MUST be authenticated and authorized
at the backend; frontend restrictions alone are insufficient. Azure service access
MUST use managed identity and least-privilege, resource-scoped permissions.
Browser code MUST NOT receive service credentials or bypass the approved data boundary.
Secrets and personal data MUST NOT be committed.

Real records MUST remain within the approved persistence boundary, without local
caches or offline synchronization. Multi-record changes MUST preserve integrity
and concurrency guarantees. Tests MUST remain isolated from production data.

### V. Evidence-Based Validation and Controlled Delivery

Changes MUST be validated using the existing checks appropriate to their actual
impact. Tests MUST assert explicit success or failure. Failed checks MUST NOT be
hidden, weakened, or bypassed; environmental blockers MUST be reported accurately.
Local checks MUST NOT be presented as proof of hosted behavior.
Pushes, deployments, and resource changes MUST require an explicit user request.

## Project Boundaries

The existing stack and approved service integrations are constraints, not invitations
to add alternative frameworks, databases, authentication systems, or generic backend
infrastructure. Expanding those boundaries MUST have explicit project-owner approval,
purpose-specific design, and corresponding updates to tests, infrastructure, and
operational documentation where applicable.

Feature-specific contracts, including access roles, data modes, entity schemas, and
UI behavior, belong in feature specifications and supporting project documentation.
They MUST NOT be duplicated here as an inventory of the current implementation.
Existing approvals and restrictions remain applicable; shortening this document does
not grant permission to change behavior or remove safeguards.

## Compliance and Supporting Documents

Specifications, plans, task sets, and implementation reviews MUST check compliance
with these principles. Conflicts MUST be surfaced before implementation, not silently
resolved by bypassing a rule.

Use the following documents for their distinct purposes:

- [AGENTS.md](../../AGENTS.md) and [Copilot instructions](../../.github/copilot-instructions.md):
  coding conventions, tool use, and detailed agent validation/delivery procedures.
- [README.md](../../README.md): product overview and how to run the project.
- [Feature specifications](../../specs/): user-visible contracts and acceptance criteria;
  their plans describe implementation and verification.
- [UI guidelines](../../docs/UI_GUIDELINES.md): presentation and interaction conventions.
- [Operations guide](../../docs/operations.md): deployment, configuration, access
  administration, and operational verification.
- [Domain model guide](../../docs/waypoints-model.md): product concepts and relationships.

## Governance

This constitution contains durable project-wide principles, not implementation
instructions or a feature catalogue. It does not authorize new behavior by itself.
Changing a feature or implementation detail within these boundaries does not require
a constitutional amendment; update the relevant spec, tests, and guidance instead.

Amendments MUST have project-owner approval, state the rationale and affected
principles, update the version and amendment date, and identify dependent artifacts
that need alignment. Use MAJOR for incompatible principle removals or redefinitions,
MINOR for added principles or materially expanded guidance, and PATCH for
clarifications without policy changes. Preserve the original ratification date.

**Version**: 1.0.2 | **Ratified**: 2026-10-17 | **Last Amended**: 2026-10-17
