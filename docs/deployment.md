# Deployment and operations

## Hosting

The app is a static Vite build (HTML, CSS, JS only) hosted on **Azure Static Web Apps**. There is
no backend or API. `staticwebapp.config.json` rewrites unknown paths to `/index.html` so that
client-side routes such as `/locations/dunham-massey` load correctly on refresh.

The Azure resources are defined as code in `infra/main.bicep` and deployed by the workflow, so the
hosting environment can be recreated from the repository.

## Environments

| Environment  | Trigger                  | Purpose                            |
| ------------ | ------------------------ | ---------------------------------- |
| `azure-prod` | Pushes to `main`         | The live site                      |
| `azure-test` | Pushes to other branches | Verifying changes before they land |

Environments are GitHub Actions environments; each supplies its own Azure target and credentials.

## Configuration

The app itself needs no runtime configuration or environment variables — no API keys, no endpoints
and no secrets are bundled into the build. Deployment configuration lives in the GitHub environment:

- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` — federated (OIDC) credentials used to log in to Azure.
- `AZURE_RESOURCE_GROUP`, `AZURE_STATIC_WEB_APP_NAME` — the deployment target.
- `GH_ACTIONS_ADMIN_TOKEN` (optional) — a fine-grained PAT with `Secrets: write` if the workflow should also store the Static Web Apps token as a repository secret.

Never commit credentials; store them only as GitHub environment or repository secrets.

## Deploying

1. Push the branch (or merge to `main` for production).
2. `.github/workflows/azure-static-web-apps.yml` runs:
   - the `infra` job logs in to Azure with OIDC, deploys `infra/main.bicep`, and reads the Static Web Apps deployment token from the deployment output;
   - the `deploy` job installs dependencies, builds with `npm run build`, and uploads the `dist` output using that token.
3. Check the workflow run is green and open the site to confirm the change.

`workflow_dispatch` can be used to re-run a deployment manually without a new commit.

## Rollback

The build is produced from the repository, so rolling back means redeploying a known-good commit:

- Re-run the workflow for the last successful commit from the Actions UI, or
- Revert the offending commit on `main` and let the workflow deploy the reverted state.

Because there is no server-side data, a rollback cannot lose anyone's visit records.

## Backup

- **Application:** the Git repository is the source of truth for code, data list and infrastructure.
- **User data:** visit records live only in each user's browser. They are not part of any server
  backup and cannot be restored by an operator. Users must export a JSON backup from **Settings**
  themselves; see [data.md](data.md).

## Troubleshooting

| Symptom                                       | Likely cause and action                                                                               |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Azure login step fails                        | Missing or wrong `AZURE_*` secrets, or the federated credential does not trust this repo/environment. |
| Bicep deployment fails                        | Resource group missing or insufficient permissions on the subscription.                               |
| Deploy step fails with an authorisation error | The deployment token was not produced by the `infra` job; check that job's output.                    |
| Build fails                                   | Reproduce locally with `npm ci && npm run build`; fix type or test errors before redeploying.         |
| 404 on refreshing a deep link                 | `staticwebapp.config.json` missing from the build output.                                             |
| Site looks stale after deploy                 | Browser or CDN cache; hard-refresh and confirm the workflow deployed the expected commit.             |
| A user has lost their data                    | Expected if browser storage was cleared; restore from their own exported JSON backup.                 |

## Operational checks

After every deployment:

- The workflow run completed successfully for the expected commit.
- The Dashboard loads and shows the location counts.
- A deep link such as `/locations/dunham-massey` loads directly without a 404.
- Saving a visit persists after a page reload.
- Export from **Settings** downloads a valid JSON file, and restoring it succeeds.

Periodically: confirm the Azure Static Web App resource is healthy in the portal, that federated
credentials and any PAT have not expired, and that dependencies are up to date.
