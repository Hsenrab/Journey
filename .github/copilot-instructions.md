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
searching code, inspecting GitHub issues/PRs/workflows, and running local project
commands. Use the GitHub CLI (`gh`) or raw shell commands only when no built-in or MCP
tool supports the task, such as dispatching or monitoring a workflow run per the agent
execution rules below.

Act autonomously during implementation: edit, run the narrowest relevant test after the
first substantive change, fix failures caused by the change, and continue through
validation without asking the user to run commands. Before completing any repository
change, run the local CI sequence from `.github/workflows/ci.yml`: `npm run lint`,
`npm run typecheck`, `npm run format:check`, `npm run test:coverage`, `npm run build`,
and `npm run test:e2e`. Run `npm ci` when dependencies are missing or the lockfile has
changed, and install Playwright Chromium when required.

Never hide or bypass a failed check. If a failure is unrelated or the environment makes
a command impossible, report the exact command and error as a blocker. Do not claim that
GitHub-only steps using Actions contexts, environments, OIDC, secrets, or artifacts ran
locally. Never trigger the Azure deployment workflow, push, or deploy unless the user
explicitly requests that side effect.

When the user explicitly requests a push or remote validation, use the GitHub CLI to
dispatch or monitor CI for the current branch, inspect the completed checks, and verify
the pull request preview URL when the Azure workflow provides one. Do not claim preview
validation if deployment did not run or no URL is available.
