# GitHub Copilot instructions

Follow the repository conventions in `AGENTS.md`.

This is a lightweight personal project. Keep changes small and direct. Fail fast and
allow unexpected errors, with their specific messages intact, to bubble to the
application root. Do not hide failures with defaults, retries, silent data loss,
fallbacks, degraded behavior, or compatibility layers.

Do not maintain backward compatibility unless the request explicitly requires it.
Replace obsolete behavior and update its tests and documentation together. Do not add
migrations for persisted data unless explicitly requested.

If the current stack or project constraints cannot support a request directly, document
the limitation clearly. Do not implement a workaround or add infrastructure merely to
approximate unsupported behavior. Prefer the simplest implementation that meets the
current requirement without speculative abstractions or future-proofing.

## Tool usage

Prefer built-in editor/agent tools and any connected MCP tools for reading files,
searching code, checking diagnostics, editing files, inspecting source control, and
working with GitHub issues, pull requests, and workflows. Use terminal commands only
for project commands or operations that have no built-in tool. Do not use `sed`, `cat`,
`find`, or repeated Git commands when an editor or source-control tool provides the
same information.

## Chat mode

When working in chat mode, explain changes as you go. If the user asks whether
something is possible or asks for options, answer first and do not make changes unless
they ask you to proceed.

Act autonomously during implementation. Use editor diagnostics as changes are made and
run a targeted test only when it provides useful implementation feedback. Do not run
Prettier, lint, typecheck, coverage, builds, end-to-end tests, or broad validation
suites as you go. Immediately before committing, first identify the impacted surfaces
by tracing imports, callers, configuration consumers, build steps, and deployment paths
from the changed files. Validate those impacted surfaces once; do not blindly run every
package or assume that only directly edited files are affected:

- Documentation-only changes: editor diagnostics and formatting for the changed files.
- Workflow or configuration changes: validate their syntax and the scripts, packages,
  or deployment paths whose behavior changed. Do not run application tests merely
  because a workflow references them when their invocation and inputs are unchanged.
- Frontend code: lint, typecheck, and the directly relevant tests. Add a production
  build for build/configuration changes and end-to-end tests for affected user flows.
- API code: run the equivalent checks from `api/`; do not also run unrelated frontend
  checks.
- Cross-cutting, dependency, release, push, or pull-request work: run the complete local
  CI sequence from `.github/workflows/ci.yml` once.

Run formatting and the selected static/test checks once, after implementation is
complete and immediately before the final diff review and commit. Do not repeat a
successful check unless files covered by it changed afterward. A commit does not
require another validation pass when the working tree is unchanged. Run `npm ci` only
when dependencies need installing or the lockfile changed, and install Playwright
Chromium only when an end-to-end run requires it.

Never hide or bypass a failed check. If a failure is unrelated or the environment makes
a command impossible, report the exact command and error as a blocker. Do not claim that
GitHub-only steps using Actions contexts, environments, OIDC, secrets, or artifacts ran
locally. Never trigger the Azure deployment workflow, push, or deploy unless the user
explicitly requests that side effect.

Before committing, inspect the final source-control diff and status once, then stage
only intended files. Do not run redundant combinations of status, diff statistics,
whitespace checks, logs, or other Git inspection commands unless a specific concern
requires them.

When the user explicitly requests a push or remote validation, use the GitHub CLI to
dispatch or monitor CI for the current branch, inspect the completed checks, and verify
the pull request preview URL when the Azure workflow provides one. Do not claim preview
validation if deployment did not run or no URL is available.
