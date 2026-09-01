# Operations guide

This guide covers deploying, verifying, rolling back, and backing up the Waypoints
application, which runs as an Azure Static Web App.

## Azure Maps

The Azure Maps account must keep `disableLocalAuth: true` to satisfy policy. This
disables both shared-key and SAS authentication. Do not weaken this setting or add
a shared-key or SAS fallback.

The required design uses Microsoft Entra authentication. The authenticated
same-origin `/api/maps/token` endpoint obtains an Azure Maps access token with the
Function App's system-assigned managed identity and returns it with the non-secret
Maps account client ID for the Web SDK token callback. Place and postcode searches
use `/api/maps/search`; the Function validates the assigned Static Web Apps
principal and calls Azure Maps with its managed identity. The browser never receives
a shared key, Function key, client secret, or SAS token.

Treat `LocalAuthDisabled` as an architecture defect indicating that a prohibited
local-authentication path has been introduced, not as an Azure configuration problem.
Do not add another provider, retry layer, or bulk geocoding.

Coordinates are saved only when a location is deliberately geocoded or changed.
Records without coordinates remain valid and are reported as omitted by the map.
Application Insights should be used to review token, search, error, and throttling
counts without recording search strings or precise locations.

Azure Maps Gen2 pricing was checked on 2026-08-10: the planning baseline is 5,000
free Base Map Tile transactions (15 tile requests per transaction) and 5,000 free
Search transactions monthly. The published overage is US$4.50 per 1,000
transactions; confirm regional pricing in the Azure Maps pricing page before
deployment. Review monthly usage and cost in Azure Cost Management by Maps resource.
No proportionate budget resource is provisioned because this personal workload is
expected to remain in the free allowance.

## Environments

| Environment | Bicep `environmentName` | SKU        | Purpose                            |
| ----------- | ----------------------- | ---------- | ---------------------------------- |
| dev         | `dev`                   | `Standard` | Manual or experimental deployments |
| prod        | `prod`                  | `Standard` | The site published from `main`     |

The Static Web App is always provisioned on the **Standard** SKU because the
application links a managed Azure Functions backend. Free is not a supported
deployment option for this architecture.

All resources are tagged with `environment`, `owner`, `application`, and
`managedBy` so ownership is visible in the Azure portal and in cost reports.

## Required configuration

Production Azure login uses GitHub OIDC from the `main` branch. Define these
repository-level secrets:

- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` — federated
  (OIDC) credentials; no client secret is stored.

Define `AZURE_RESOURCE_GROUP` and `AZURE_STATIC_WEB_APP_NAME` as environment
variables for the deployment target. Optional variables: `AZURE_LOCATION`
(default `westeurope`) and `AZURE_RESOURCE_OWNER` (default
`journey-maintainers`).

The production Static Web Apps deployment token is never stored as a GitHub secret.
The deploy job reads it from Azure at run time and masks it in the logs.

The `azure-test` GitHub environment must define `AZURE_STATIC_WEB_APPS_API_TOKEN`
for pull request previews. This token targets the shared test Static Web App.
That resource must be provisioned on the **Standard** SKU because it also hosts
the linked Functions backend used by manual test deployments. Set the SKU with
`az staticwebapp update --sku Standard --name <name> --resource-group <group>`,
or use the Azure portal.

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

1. Deploy the Static Web App, which uses the platform's built-in Microsoft Entra
   (`aad`) provider.
2. In the Static Web App's **Role management** page, generate an invitation for
   the owner's work account with the custom role `owner` and the Microsoft Entra
   provider. Open the generated link while signed in as that account.
3. `staticwebapp.config.json` restricts all application routes and `/api/*` to
   the `owner` role while leaving `/.auth/*` reachable for platform login.
4. Repeat the invitation for each separately provisioned Static Web App resource,
   including the production and shared test resources. Role assignment in one
   resource does not grant access to another resource.
5. Manage and revoke access from the Static Web App's **Role management** page.
   This repository does not build a roles or administration UI.

Accepting an Entra consent prompt only authenticates the account; it does not
assign `owner`. After accepting an invitation, sign out through `/.auth/logout`
and sign in again so Static Web Apps issues a principal with the new role. Check
`/.auth/me` on the affected application URL and confirm that
`clientPrincipal.userRoles` contains `owner`.

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

`DefaultAzureCredential` (used by `api/src/lib/mapsAuth.ts`) falls back to the
signed-in developer identity (Azure CLI or Visual Studio Code) when no managed
identity is present, so `az login` with an account that has the required Azure
Maps roles is required to exercise token issuance locally. Because Static Web
Apps' proxy is not present locally, `x-ms-client-principal` must be supplied by
hand (for example with `curl -H`) to test principal validation end to end.

### Application access flow

- Journey is sign-in first. An unauthenticated request to `/`, `/waypoints`,
  `/activities`, `/map`, `/settings`, or a supported client-side deep link is
  rejected by Static Web Apps before the React app loads.
- The 401 response override redirects to
  `/.auth/login/aad?post_login_redirect_uri=.referrer`, which starts Microsoft
  Entra sign-in and returns the browser to the originally requested route after a
  successful sign-in.
- Only the owner's work account should accept an invitation for the `owner` role.
  Other authenticated users cannot load the application or call its API.
- `/api/*` remains protected by Static Web Apps, and the Functions API still
  validates the Static Web Apps principal's provider (`aad`) and assigned
  `owner` role before calling Azure Maps.

### RBAC (managed identity to Azure Maps)

The Function App's system-assigned managed identity is granted, scoped to the
Azure Maps account only:

- **Azure Maps Search and Render Data Reader**, or an equivalent custom role with
  only the required render/search data actions.

The Function identity does not need **Azure Maps Contributor** or
`Microsoft.Maps/accounts/listSas/action`. The signed-in user receives no Azure Maps
role assignment; only the Function identity authenticates to Azure Maps, and only
after the application boundary validates the caller's Entra provider and assigned
`owner` role.

### Deployment

- `infra/main.bicep` provisions the Function App (system-assigned identity,
  Linux Consumption plan, Node 24 LTS runtime), a storage account for the Functions host (using an
  identity-based `AzureWebJobsStorage` connection, not a shared key), the
  Azure Maps Gen2 account, an Application Insights component wired to the
  Function App via `APPLICATIONINSIGHTS_CONNECTION_STRING`, the role
  assignments above, and the `userProvidedFunctionApps` link that makes the
  Function App the exclusive backend for `/api/*`.
- The Maps account sets `disableLocalAuth: true`. The Function requests Microsoft
  Entra tokens for `https://atlas.microsoft.com/.default`; no Maps account key or
  SAS token is read, generated, stored, or deployed.
- The host storage account disables shared-key access and sets public network
  access to `SecuredByPerimeter`. It is associated in enforced mode with a
  Network Security Perimeter profile. A permanent inbound subscription rule
  permits network access from Azure resources in the deployment subscription;
  Microsoft Entra authentication and the storage data-plane role assignments
  still determine which identities can access storage data.
- The host storage account name includes a stable resource-group-specific suffix
  because Azure Storage account names are globally unique.
- The GitHub OIDC deployment principal has the custom **Journey NSP Subscription
  Join** role at subscription scope. Its only action is
  `Microsoft.Network/networkSecurityPerimeters/joinPerimeterRule/action`, which
  authorizes the subscription referenced by the permanent perimeter rule. This
  role must be created and assigned once by a subscription administrator; the
  deployment workflow cannot grant itself subscription permissions.
- The API boundary (`enableApi`) defaults to `true` and can be disabled per
  deployment; linking a Functions backend requires the Standard plan, which
  `skuName` always is.
- `.github/workflows/azure-static-web-apps.yml` adds a `deploy_api` job that
  builds `api/` and deploys it with `Azure/functions-action@v1` after Bicep
  provisioning, before the Static Web App content deploy. The job discovers
  the GitHub-hosted runner's public IPv4 address, creates a uniquely named
  inbound `/32` rule on the storage perimeter, confirms authenticated Blob
  access, deploys the package, and removes the rule even when deployment fails.
- Because `AzureWebJobsStorage` is identity-based, `Azure/functions-action`
  deploys a Linux Consumption app by uploading the package zip to the Functions
  storage account from the runner with the **deploying** principal's own
  credentials, not the Function App's managed identity. `infra/main.bicep`
  therefore also grants **Storage Blob Data Contributor** on that storage
  account to `deployer().objectId`, the GitHub OIDC principal that runs the
  Bicep deployment. No extra secret or variable is needed; the object id comes
  from the deployment itself.
- Pull request previews do not include the API: Azure does not support linked
  Functions backends in Static Web Apps preview environments, so preview
  deployments only carry static content. `staticwebapp.config.json` excludes
  `/api/*` from the SPA `navigationFallback`, so those requests return 404
  rather than `index.html`, and the Map page reports that the Maps API is not
  deployed in the current environment instead of failing on an HTML body. Use
  the production site to exercise the map.

### Diagnostics

- `infra/main.bicep` provisions a dedicated Application Insights component
  (`<staticWebAppName>-appi`) and connects it to the Function App through the
  `APPLICATIONINSIGHTS_CONNECTION_STRING` application setting; function-level
  `context.warn` / `context.error` calls record the specific rejection reason
  (for example an invalid principal or Entra token acquisition failure) without
  logging the caller's identity beyond what Static Web Apps already includes in
  the principal.
- Use **Function App → Monitor** in the portal, or Application Insights **Logs**,
  filtered by `operation_Name == "mapsToken"`, to inspect recent calls.

### Token behavior

- `/api/maps/token` acquires a Microsoft Entra access token through
  `DefaultAzureCredential` using the Function App's managed identity and the
  `https://atlas.microsoft.com/.default` scope. It returns the access token, its
  expiry, and the non-secret Maps account client ID. The Web SDK obtains and renews
  tokens through this authenticated endpoint.
- A request without a valid assigned principal receives
  `403` and is rejected before any Azure Maps or Resource Manager call is made.
- Entra tokens do not provide SAS per-token rate caps. Control exposure with the
  protected endpoint, least-privilege Maps RBAC, Azure Maps service quotas, monitoring,
  and cost alerts; do not recreate rate limiting with retries or a shared credential.

### Costs

- Azure Functions on the Consumption (`Y1`) plan bills per execution; token
  issuance for a single user is negligible.
- Azure Maps Gen2 (`G2`) SKU bills per transaction; browser render and protected
  search calls authenticated with Microsoft Entra also count.
- The additional storage account uses the `Standard_LRS` tier at minimal cost.
- Network Security Perimeter has no separate hourly charge. Normal charges for
  the associated resources and diagnostic log ingestion still apply.
- Application Insights bills per ingested telemetry volume, which is minimal
  for a single-user API surface.

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
  publishes the application URL to the job summary and deployment record. Because
  the site is sign-in first, verification sends an anonymous request without
  following redirects and requires HTTP 302 to the sign-in endpoint.

Both deployment workflows also require anonymous `/api/maps/token` requests to
return HTTP 302. Their curl checks use `--max-redirs 0` so they inspect the
application's redirect response without following the interactive sign-in flow.

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

## Manual test deployment

The `Deploy test environment` GitHub Actions workflow (`.github/workflows/deploy-test.yml`)
is triggered only via **Run workflow** (`workflow_dispatch`), from any branch. It provisions
and deploys a full stack to the Static Web App identified by the `azure-test` GitHub
environment's `AZURE_STATIC_WEB_APP_NAME` variable — the same app previews target (see
"Preview environments" below):

1. A `plan` job resolves the `deploy_api` input (`auto`, `true`, or `false`):
   - `true` always builds and deploys the Functions API.
   - `false` skips the API build, the NSP access-rule steps, and the Functions deploy
     entirely, deploying static content only.
   - `auto` (the default) compares the current commit against the `head_sha` of the most
     recent **successful** `Deploy test environment` run (via the GitHub API) and deploys
     the API only if `api/`, `infra/`, `staticwebapp.config.json`, or the workflow file
     itself changed since then. If there is no previous successful run, or that commit is
     no longer reachable in history, it fails safe and deploys the API. The decision and
     the changed paths are written to the job summary.
2. Deploys `infra/main.bicep` with `environmentName=dev` and `enableApi=true` on every run
   (idempotent, so this always runs regardless of the `deploy_api` decision).
3. When the API is being deployed, builds and deploys the Functions package (`api/`) to the
   provisioned Function App.
4. Deploys the built static content to the test Static Web App's primary environment (not a
   PR preview slot), so the linked Function backend — when deployed — is active.
5. Publishes the application URL to the job summary and verifies that anonymous requests
   to the application root redirect to sign-in (302). When the API exists, it also checks
   `/api/maps/token` returns 302 and the Function App's default hostname rejects direct
   requests, mirroring the production workflow's verification steps.

The workflow uses the same temporary runner `/32` perimeter rule and guaranteed
cleanup as the production deployment, and reuses the `azure-test` GitHub environment's
OIDC login and resource group variable, so the test Static Web App must live in the same
resource group as the shared preview resource.

## Preview environments

Pull requests targeting `main` are published to a Static Web App preview resource,
identified by the `azure-test` GitHub environment's `AZURE_STATIC_WEB_APP_NAME` /
`AZURE_RESOURCE_GROUP` variables — the same test Static Web App the manual
`Deploy test environment` workflow deploys to. The workflow summary reports the preview
URL and the resolved test SWA name, and the `close_preview` job deletes the preview
environment when the pull request is closed. That resource must be on the Standard SKU
(see "Required configuration" above) because it also supports the linked Functions
backend used by manual test deployments.

Azure Static Web Apps only links a Functions backend to an app's **production**
environment; preview environments never get a working backend, regardless of which app
they hang off. So PR previews never have a working `/api/*` endpoint — validate anything
that needs the Functions API (Azure Maps token issuance, search) with a manual
`Deploy test environment` run instead.

## Production dispatch guard

`.github/workflows/azure-static-web-apps.yml` keeps `workflow_dispatch` as a trigger, but
a `guard` job fails immediately with an `::error::` annotation if it is dispatched from any
ref other than `refs/heads/main`, instead of silently skipping `infra`, `deploy_api`, and
`deploy`. `validate`, `infra`, `deploy_api`, and `deploy` all depend on `guard`. Use the
`Deploy test environment` workflow to test changes from a branch.

## Rollback

1. Identify the last known-good commit on `main`.
2. Revert the offending change (`git revert <sha>`) and merge it, or re-run the
   deploy workflow from the good commit using **Run workflow** on the
   `Deploy Azure Static Web App` workflow with that ref.
3. Re-running the workflow republishes the built assets; no infrastructure
   change is required because the Bicep template is idempotent.
4. Confirm the verification step reports HTTP 302 for the anonymous application
   request, then sign in and confirm the dashboard loads.

GitHub **Re-run jobs** uses the original run's commit. To deploy a different
commit, start a new workflow run and select the branch containing that commit.

`infra/main.bicep` is the infrastructure source of truth. When Bicep compilation
updates the committed `infra/main.json`, run `npx prettier --write infra/main.json`
before committing because the repository-wide formatting check includes generated
JSON.

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

| Symptom                                                                                    | Likely cause and action                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Azure login step fails                                                                     | Federated credential subject does not match the `main` branch. Re-check the app registration.                                                                                                                                                                                                |
| Bicep deployment fails on SKU                                                              | Standard allows a limited number of apps per subscription. Delete unused apps or request a subscription quota increase.                                                                                                                                                                      |
| Deploy step reports an invalid token                                                       | The Static Web App was recreated. Re-run the workflow so the token is read again.                                                                                                                                                                                                            |
| Verification receives a status other than HTTP 302                                         | Confirm the deployed config protects `/*`, inspect the response `Location` header, and confirm the workflow run uses the intended branch and commit.                                                                                                                                         |
| Routes return 404 on refresh                                                               | Check `staticwebapp.config.json` navigation fallback is still present.                                                                                                                                                                                                                       |
| Application routes do not redirect to Entra sign-in                                        | Confirm the catch-all `/*` route in `staticwebapp.config.json` still requires the `owner` role and the 401 override redirects to `/.auth/login/aad?post_login_redirect_uri=.referrer`.                                                                                                       |
| Sign-in succeeds but returns to the wrong page                                             | Confirm the 401 override still uses `post_login_redirect_uri=.referrer`; without it, Static Web Apps may return to the default post-login page instead of the originally requested deep link.                                                                                                |
| Sign-in completes and the application returns 403                                          | Authentication succeeded but the Static Web Apps principal lacks `owner`. Check `/.auth/me`, generate and accept an `owner` invitation for that Static Web App resource, then use `/.auth/logout` and sign in again. Entra consent alone does not assign the role.                           |
| Owner work account cannot sign in                                                          | Confirm Microsoft Entra ID was selected as the invitation provider and accept the generated invitation while signed in as the invited work account.                                                                                                                                          |
| `/api/*` returns 401                                                                       | The request has no authenticated Static Web Apps principal. Sign in through `/.auth/login/aad`; do not call the Function App's direct hostname.                                                                                                                                              |
| `/api/*` returns 403 while `/.auth/me` includes `owner`                                    | Confirm `clientPrincipal.identityProvider` is `aad`, sign out through `/.auth/logout`, and sign in again. If it persists, inspect the linked Function's rejection warning in Application Insights.                                                                                           |
| Azure Maps returns `LocalAuthDisabled`                                                     | A shared-key or SAS path is still deployed. Keep `disableLocalAuth: true` and replace that path with Microsoft Entra token acquisition through the Function managed identity.                                                                                                                |
| `/api/maps/token` fails to acquire an Entra token                                          | Confirm the Function has a system-assigned identity, the token scope is `https://atlas.microsoft.com/.default`, and the identity has the minimum render/search data role scoped to the Maps account.                                                                                         |
| Bicep deployment fails with `LinkedAuthorizationFailed` for `joinPerimeterRule/action`     | Assign the GitHub OIDC principal the custom **Journey NSP Subscription Join** role at subscription scope. The role must contain only `Microsoft.Network/networkSecurityPerimeters/joinPerimeterRule/action`; a subscription administrator must create and assign it.                         |
| Deploy Functions API fails with `This request is not authorized to perform this operation` | The deploying GitHub OIDC principal lacks data-plane access to the Functions storage account it uploads the package to. Re-run the workflow: the Bicep deployment creates the Storage Blob Data Contributor assignment for `deployer().objectId`, which can take a few minutes to propagate. |
| Function package upload reports a storage authorization error                              | Check that the workflow created its `github-<run-id>-<attempt>` inbound rule in the Network Security Perimeter profile and that the deploy identity still has Storage Blob Data Contributor on the host storage account.                                                                     |
| A temporary `github-*` perimeter rule remains after a cancelled workflow                   | Delete that exact rule with `az network perimeter profile access-rule delete --name <rule> --perimeter-name <perimeter> --profile-name function-storage --resource-group <resource-group> --yes`.                                                                                            |
| Direct calls to the Function App's `*.azurewebsites.net` hostname succeed anonymously      | The `userProvidedFunctionApps` link was removed or another identity provider was added to the Function App, disabling the automatic Static-Web-Apps-only restriction. Re-run the Bicep deployment and do not add another auth provider.                                                      |

## Routine operational checks

- Confirm the latest `main` run of both workflows is green.
- Open the application URL and check the dashboard loads.
- Review Azure resource tags and cost monthly.
- Keep dependencies current and re-run CI after upgrades.
