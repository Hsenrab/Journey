# Implementation Plan: Safe Data-Mode Switching

**Feature**: `002-data-modes-persistence` | **Date**: 2026-10-21 | **Spec**: [spec.md](spec.md)

## Summary

Implement only the approved FR-017/FR-018 improvements and SC-007/SC-008 checks:
block mode switches during writes, and confirm discard of changed drafts before
a mode switch. Existing baseline behaviour is not a new implementation backlog.
Creating this plan/tasks does not authorize implementation, commits, or deployment.

## Technical Context

- TypeScript strict mode, React 19, MUI, React Router with `BrowserRouter`.
- Existing `WaypointsProvider` owns mode selection, loads, and mutations.
- Existing editors own draft state; Settings owns the only mode selector.
- Vitest/Testing Library and existing Playwright suite provide validation.
- No persisted schema, Cosmos/API, dependency, infrastructure, or auth changes.
- Transient state only; no draft persistence, migration, automatic retry, or queue.
- Scope is a personal app; no new performance or scale infrastructure.

## Constitution Check

Pre-design and post-design gates pass: small frontend-only change; preserve
explicit errors, existing permission/load guards, Cosmos boundary, and data integrity.
Reuse editor dirty comparisons and existing confirmation conventions. Do not add
a new router solely to obtain a navigation-blocking API.

## Project Structure

- `src/features/journey/JourneyContext.tsx`: pending mutation guard and mode boundary.
- `src/pages/Settings.tsx`: selector availability and awaited switch feedback.
- `src/components/{Waypoint,Idea,Activity}Editor.tsx`: existing dirty state.
- `src/pages/Dashboard.tsx`: Challenge creation draft.
- `src/pages/ChallengeDetails.tsx`: unsaved planned-route draft.
- Corresponding colocated tests and `e2e/journey.spec.ts`.
- `src/components/Layout.tsx`: navigation to Settings if needed to protect a draft
  before its editor is unmounted.

## Design

1. Track pending mutations at provider scope; every mutator, including delete,
   route changes, restore, and clear, participates. Acquire before asynchronous
   work, release in `finally`, preserve original errors. A synchronous guard must
   reject a same-tick direct switch; a rendered disabled selector alone is insufficient.
   Concurrent pending operations must not unlock switching when only one finishes.
   Settings must enter the shared pending boundary when it accepts a backup file,
   before awaiting file reading or validation, and leave it on every outcome.
   Keep the destination bound throughout preparation and persistence; coordinate
   with provider restore tracking without an early unlock or leaked participation.
2. Disable Settings mode selection while writes are pending and enforce the same
   restriction in the context method. Do not alter saved preference on rejection.
3. Reuse existing dirty comparisons and add only the small shared connection needed
   between editors and mode selection. Clear registration on unmount or successful
   save; failed save retains dirty state. Do not persist draft contents.
   Extend dirty detection to non-whitespace unapplied JSON, including invalid text.
   Clearing JSON removes only that dirty contribution; applied form edits remain dirty.
4. Protect the real path to mode selection: the selector is in Settings, so leaving
   an editor may unmount its draft before `setDataMode` is called. Confirm before
   that loss; cancellation preserves route, mode, and draft. Confirmed discard
   must not trigger a duplicate prompt later in Settings. No general navigation
   redesign or unsupported router hooks.
   This confirmation also applies when the user only visits Settings and never
   selects another mode; unrelated route transitions are outside this new guard.
5. When a mode switch is requested directly with a mounted dirty draft, the same
   cancel/discard contract applies. An accepted switch resets the old editor state;
   it must not appear as an edit in the newly loaded dataset.

## Validation and Delivery

Required regressions are part of SC-007/SC-008; see [quickstart.md](quickstart.md).
Keep existing load-generation, viewer, local-demo, export, and failure tests intact.
Record actual results in [evidence.md](evidence.md); do not mark improvements
implemented merely because tasks exist. No backend or hosted mutation is required.

## Complexity Tracking

No constitutional exceptions or new platform dependencies.
