# Operations guide

This guide covers deploying, verifying, rolling back, and backing up the Waypoints
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
- `AAD_CLIENT_ID`, `AAD_CLIENT_SECRET` — the Microsoft Entra ID app registration
  used for Static Web Apps authentication (see "API authentication and
  authorization" below). `AAD_CLIENT_SECRET` is only ever read by the deploy
  workflow and passed straight into the Bicep deployment; it is never logged or
  written to a file.
- `JOURNEY_OWNER_OBJECT_ID` — the immutable object id (`oid`) of the single work
  account permitted to call `/api/*`.

Optional variables: `AZURE_LOCATION` (default `westeurope`) and
`AZURE_RESOURCE_OWNER` (default `journey-maintainers`).

The production Static Web Apps deployment token is never stored as a GitHub secret.
The deploy job reads it from Azure at run time and masks it in the logs.

The `azure-test` GitHub environment must define `AZURE_STATIC_WEB_APPS_API_TOKEN` for
pull request previews. This token targets the shared Static Web App preview environment.

## API authentication and authorization

The API boundary follows this chain, established for Azure Maps token issuance
and intended to be reused by future approved Azure service integrations:

```text
Assigned work user
  -> Static Web Apps authentication and route authorization
  -> linked Azure Functions API (api/)
  -> Function managed identity and resource-scoped RBAC
  -> Azure Maps
```

### Sign-in and role assignment

1. Register a single-tenant Microsoft Entra ID application for Journey (Azure
   portal: Microsoft Entra ID → App registrations). Record the application
   (client) id, a client secret, and the tenant id.
2. On the app registration's **Enterprise application**, set
   **Assignment required?** to **Yes**, then assign only the owner's work
   account. No other tenant user, and no personal Microsoft account, can sign
   in once this is set.
3. Store the application id and secret as the `AAD_CLIENT_ID` /
   `AAD_CLIENT_SECRET` GitHub secrets, and the owner's object id (`oid`, found
   on the user's Entra ID profile) as `JOURNEY_OWNER_OBJECT_ID`.
4. `staticwebapp.config.json` restricts `/api/*` to the `authenticated` role
   and configures the Entra ID identity provider. The deploy and preview
   workflow jobs substitute the `AAD_TENANT_ID` placeholder in that file with
   the real tenant id at deploy time, since Static Web Apps does not support an
   app-setting reference for the OpenID issuer URL.
5. Managing and revoking access — add or remove the enterprise application
   assignment in the Entra portal. This repository does not build a roles or
   administration UI; access changes always go through the portal.

### Local development

Static Web Apps authentication cannot be exercised outside Azure. Run the
Functions API locally with the Azure Functions Core Tools and the Azure
Functions extension bundle:

```sh
cd api
npm install
cp local.settings.json.example local.settings.json  # never committed
npm run build
func start
```

`DefaultAzureCredential` (used by `api/src/lib/mapsSas.ts`) falls back to the
signed-in developer identity (Azure CLI or Visual Studio Code) when no managed
identity is present, so `az login` with an account that has the required Azure
Maps roles is required to exercise token issuance locally. Because Static Web
Apps' proxy is not present locally, `x-ms-client-principal` must be supplied by
hand (for example with `curl -H`) to test principal validation end to end.

### RBAC (managed identity to Azure Maps)

The Function App's system-assigned managed identity is granted, scoped to the
Azure Maps account only:

- **Azure Maps Contributor** — required to call the
  `Microsoft.Maps/accounts/listSas/action` control-plane operation that issues
  short-lived SAS tokens. A data-plane reader role does not grant this action.
- **Azure Maps Data Reader** — required for the render/search data-plane
  operations the issued SAS token authorizes.

The signed-in user receives no Azure Maps role assignment; only the Function's
identity can request tokens, and only after the application boundary validates
the caller's tenant and immutable object id.

### Deployment

- `infra/main.bicep` provisions the Function App (system-assigned identity,
  Linux Consumption plan), a storage account for the Functions host (using an
  identity-based `AzureWebJobsStorage` connection, not a shared key), the
  Azure Maps Gen2 account, the two role assignments above, and the
  `userProvidedFunctionApps` link that makes the Function App the exclusive
  backend for `/api/*`.
- The API boundary (`enableApi`) only provisions when `skuName` is `Standard`,
  because linking a Functions backend requires that plan; the `dev` `Free` SKU
  does not deploy it.
- `.github/workflows/azure-static-web-apps.yml` adds a `deploy_api` job that
  builds `api/` and deploys it with `Azure/functions-action@v1` after Bicep
  provisioning, before the Static Web App content deploy.
- Pull request previews do not include the API: Azure does not support linked
  Functions backends in Static Web Apps preview environments, so preview
  deployments only carry static content.

### Diagnostics

- Application Insights is enabled through the Functions host's default
  logging configuration (`host.json`); function-level `context.warn` /
  `context.error` calls record the specific rejection reason (for example
  "wrong tenant" or "listSas request failed") without logging the caller's
  identity beyond what Static Web Apps already includes in the principal.
- Use **Function App → Monitor** in the portal, or Application Insights **Logs**,
  filtered by `operation_Name == "mapsToken"`, to inspect recent calls.

### Token behavior

- `/api/maps/token` issues a SAS token with a 15-minute lifetime and a request
  rate limit (5 requests/second), matching the least-privilege, short-lived
  requirement. Callers must request a new token before it expires; there is no
  refresh endpoint.
- A request without a valid, tenant- and identity-matched principal receives
  `403` and is rejected before any Azure Maps or Resource Manager call is made.

### Costs

- Azure Functions on the Consumption (`Y1`) plan bills per execution; token
  issuance for a single user is negligible.
- Azure Maps Gen2 (`G2`) SKU bills per transaction; render/search calls made
  with the issued SAS token by the browser also count.
- The additional storage account uses the `Standard_LRS` tier at minimal cost.

### Troubleshooting

See the consolidated troubleshooting table below; API-specific rows are
included there.

### Rollback

Unlinking the Functions app (deleting the `userProvidedFunctionApps` resource,
or setting `enableApi` to `false` and redeploying) immediately stops proxying
`/api/*` and removes the API boundary; the Static Web App itself is unaffected.
The Azure Maps account and Function App can be deleted independently if the
integration needs to be fully removed.

## Pipelines

- `.github/workflows/ci.yml` runs on every pull request, can be started manually,
  and is reused by the deploy workflow via `workflow_call`: dependency install
  (`npm ci`), lint, type check, formatting, tests with coverage, a production build,
  and end-to-end smoke tests for the React app; a separate `validate-api` job runs
  the equivalent lint, type check, test, and build steps for `api/`.
- `.github/workflows/azure-static-web-apps.yml` runs production deployment on pushes
  to `main` and pull request preview deployment for open pull requests. Both paths
  call the CI workflow first. Production provisions infrastructure (including the
  API boundary), deploys the Functions API, then deploys the static content and
  publishes the application URL to the job summary and deployment record, then
  verifies the site returns HTTP 200.

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

| Symptom                                                                               | Likely cause and action                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Azure login step fails                                                                | Federated credential subject does not match the `main` branch. Re-check the app registration.                                                                                                                                           |
| Bicep deployment fails on SKU                                                         | The Free SKU allows a limited number of apps per subscription. Delete unused apps or use Standard.                                                                                                                                      |
| Deploy step reports an invalid token                                                  | The Static Web App was recreated. Re-run the workflow so the token is read again.                                                                                                                                                       |
| Verification step fails                                                               | The CDN may still be propagating. Re-run the job; if it still fails, roll back.                                                                                                                                                         |
| Routes return 404 on refresh                                                          | Check `staticwebapp.config.json` navigation fallback is still present.                                                                                                                                                                  |
| `/api/*` returns 401                                                                  | The signed-in account is not assigned to the Entra enterprise application, or is not signed in. Confirm assignment in the Entra portal.                                                                                                 |
| `/api/*` returns 403                                                                  | The principal's tenant or object id does not match `JOURNEY_ENTRA_TENANT_ID` / `JOURNEY_OWNER_OBJECT_ID`. Confirm the assigned account is the intended owner.                                                                           |
| `/api/maps/token` returns 500 with a `listSas` error                                  | The Function's managed identity is missing the Azure Maps Contributor role assignment on the Maps account, or the account name/subscription/resource group app settings are wrong.                                                      |
| Direct calls to the Function App's `*.azurewebsites.net` hostname succeed anonymously | The `userProvidedFunctionApps` link was removed or another identity provider was added to the Function App, disabling the automatic Static-Web-Apps-only restriction. Re-run the Bicep deployment and do not add another auth provider. |

## Routine operational checks

- Confirm the latest `main` run of both workflows is green.
- Open the application URL and check the dashboard loads.
- Review Azure resource tags and cost monthly.
- Keep dependencies current and re-run CI after upgrades.
