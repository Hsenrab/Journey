# Operations guide

This guide covers deploying, verifying, rolling back, and backing up the Journey
application, which runs as an Azure Static Web App.

## Environments

| Environment | Bicep `environmentName` | Default SKU | Purpose                            |
| ----------- | ----------------------- | ----------- | ---------------------------------- |
| dev         | `dev`                   | `Free`      | Manual or experimental deployments |
| prod        | `prod`                  | `Standard`  | The site published from `main`     |

All resources are tagged with `environment`, `owner`, `application`, and
`managedBy` so ownership is visible in the Azure portal and in cost reports.

## Required configuration

Production Azure login uses GitHub OIDC from the `main` branch. Define these
repository-level secrets:

- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` — federated
  (OIDC) credentials; no client secret is stored.
- `AZURE_RESOURCE_GROUP`, `AZURE_STATIC_WEB_APP_NAME` — the deployment target.

Optional variables: `AZURE_LOCATION` (default `westeurope`) and
`AZURE_RESOURCE_OWNER` (default `journey-maintainers`).

The production Static Web Apps deployment token is never stored as a GitHub secret.
The deploy job reads it from Azure at run time and masks it in the logs.

The `azure-test` GitHub environment must define `AZURE_STATIC_WEB_APPS_API_TOKEN` for
pull request previews. This token targets the shared Static Web App preview environment.

## Pipelines

- `.github/workflows/ci.yml` runs on every pull request, can be started manually,
  and is reused by the deploy workflow via `workflow_call`: dependency install
  (`npm ci`), lint, type check, formatting, tests with coverage, a production build,
  and end-to-end smoke tests.
- `.github/workflows/azure-static-web-apps.yml` runs production deployment on pushes
  to `main` and pull request preview deployment for open pull requests. Both paths
  call the CI workflow first. Production publishes the application URL to the job
  summary and deployment record, then verifies the site returns HTTP 200.

Failures surface in the GitHub Actions run: the failing job is marked red and
verification failures are reported with an `::error::` annotation.

## Deploying manually

```sh
az deployment group create \
  --resource-group <resource-group> \
  --template-file infra/main.bicep \
  --parameters staticWebAppName=<name> environmentName=dev owner=<owner> \
               repositoryUrl=https://github.com/Hsenrab/Journey
```

The template is idempotent: repeated runs converge on the same resource and are
safe to re-run. Use `--what-if` first to preview changes.

## Preview environments

Pull requests targeting `main` are published to Static Web Apps staging environments
(`stagingEnvironmentPolicy` is enabled in the template). The workflow summary reports
the preview URL. Preview environments share the production resource but not the
production URL, and are automatically deleted on merge or close.

## Rollback

1. Identify the last known-good commit on `main`.
2. Revert the offending change (`git revert <sha>`) and merge it, or re-run the
   deploy workflow from the good commit using **Run workflow** on the
   `Deploy Azure Static Web App` workflow with that ref.
3. Re-running the workflow republishes the built assets; no infrastructure
   change is required because the Bicep template is idempotent.
4. Confirm the verification step reports HTTP 200 for the application URL.

If the site is unavailable and a rollback cannot be completed quickly, redeploy
the previous artifact from the CI run's `dist` artifact using
`swa deploy ./dist --deployment-token <token>`.

## Backup and restore

Application data is stored only in the visitor's browser local storage; there is
no server-side database to back up.

- **User data**: use **Settings → Export** in the app to download a JSON backup,
  and **Settings → Import** to restore it.
- **Application and infrastructure**: the Git repository is the source of truth.
  Restoring means redeploying `infra/main.bicep` and re-running the deploy
  workflow.

## Troubleshooting

| Symptom                              | Likely cause and action                                                                            |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Azure login step fails               | Federated credential subject does not match the `main` branch. Re-check the app registration.      |
| Bicep deployment fails on SKU        | The Free SKU allows a limited number of apps per subscription. Delete unused apps or use Standard. |
| Deploy step reports an invalid token | The Static Web App was recreated. Re-run the workflow so the token is read again.                  |
| Verification step fails              | The CDN may still be propagating. Re-run the job; if it still fails, roll back.                    |
| Routes return 404 on refresh         | Check `staticwebapp.config.json` navigation fallback is still present.                             |

## Routine operational checks

- Confirm the latest `main` run of both workflows is green.
- Open the application URL and check the dashboard loads.
- Review Azure resource tags and cost monthly.
- Keep dependencies current and re-run CI after upgrades.
