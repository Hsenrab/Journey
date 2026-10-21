# Safe Mode Switching: Validation

## Scope

Use mocked authenticated Journey API responses for frontend tests, not Vite's
legacy local-record path to establish remote mutation behaviour. No live account,
Production mutation, infrastructure run, or new test tooling is required.

## Required Scenarios

1. Hold save, restore, and clear responses pending; attempt mode switches through
   Settings and direct context calls, including same-tick calls. Assert no mode
   preference change or new load. Cover success and failure for each operation.
   Start restore blocking at file acceptance: defer `file.text()`, attempt a switch,
   and verify rejection. Cover read rejection, invalid JSON/schema, and successful
   preparation through a delayed write; every outcome releases participation.
2. Cover delete and saved-route mutations, overlapping pending operations, page
   unmount, and release only when the last operation settles. Preserve error text.
3. For each draft family, test changed/unchanged state, cancel/confirm discard,
   successful save, failed save, and stale-registration cleanup.
   Include valid and invalid unapplied JSON, whitespace-only text, and clearing
   text while applied form edits remain dirty in each JSON-capable editor.
4. Exercise editor -> Settings -> select mode with the real router. Cancel retains
   editor values and route; confirm discards once; switching carries no old draft.
   Also enter Settings without switching modes: confirmation still occurs before
   unmount; cancel retains the editor and confirm causes no duplicate later prompt.
5. Preserve viewer/local-demo/load-failure restrictions, export behaviour, and
   stale-load tests. Verify failed saves do not show success.

## Commands

Run in existing Ubuntu WSL with installed dependencies as documented in
[AGENTS.md](../../AGENTS.md). During implementation run only relevant Vitest cases
when useful. Before commit, format changed files, run frontend lint/typecheck and
the directly affected tests, plus the affected Playwright journey:

```text
npm run lint
npm run typecheck
npm test -- src/features/journey/JourneyContext.test.tsx src/pages/Settings.test.tsx
npm run test:e2e -- e2e/journey.spec.ts
```

Add each changed editor/page test file to the same Vitest invocation; use actual
test selectors if the browser journey is added to the existing smoke file.
Production build is only needed if build/configuration changes; no such change is
planned. For a later requested push/PR, run the complete local CI sequence once,
not duplicate successful checks on an unchanged tree. Record outcomes and any
blockers in [evidence.md](evidence.md).
