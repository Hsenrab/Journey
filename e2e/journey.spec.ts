import { expect, test } from '@playwright/test'

test.describe('activity management flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear())
  })

  test('creates a linked categorized activity from waypoint details', async ({ page }) => {
    await page.goto('/waypoints')
    await page.getByLabel('Search waypoints').fill('Chedworth')
    await page.getByRole('link', { name: 'Chedworth Roman Villa' }).click()

    await page.getByRole('button', { name: 'Log activity' }).click()
    await expect(page.getByLabel('Latitude')).toHaveValue('51.783')
    await page.getByRole('combobox', { name: 'Activity category' }).click()
    await page.getByRole('option', { name: 'Gold' }).click()
    await page.getByLabel('Description / notes').fill('Excellent day')
    await page.getByRole('button', { name: 'Save activity' }).click()

    await expect(page.getByText('Activity saved.')).toBeVisible()
    await expect(page.getByText('Award tier: Gold')).toBeVisible()

    await page.getByRole('link', { name: '2026' }).first().click()
    await expect(page.getByRole('heading', { name: /\d{1,4}[/-]\d{1,2}[/-]\d{1,4}/ })).toBeVisible()
    await expect(page.getByText('Chedworth Roman Villa').first()).toBeVisible()
  })

  test('creates unlinked activity, edits it, and deletes it', async ({ page }) => {
    await page.goto('/activities')
    await page.getByRole('button', { name: 'Add activity' }).click()
    await page.getByLabel('Postcode').fill('GL1 1AA')
    await page.getByLabel('Description / notes').fill('Unlinked activity')
    await page.getByRole('button', { name: 'Save activity' }).click()

    await expect(page.getByText('Activity saved.')).toBeVisible()
    await page.getByRole('link', { name: '2026' }).first().click()

    await expect(page.getByText('No photos linked to this activity.')).toBeVisible()
    await expect(page.getByText('No references linked to this activity.')).toBeVisible()

    await page.getByRole('button', { name: 'Edit activity' }).click()
    await page.getByRole('button', { name: 'Add reference' }).click()
    await page.getByLabel('Reference title').fill('External article')
    await page.getByLabel('Reference URL').fill('https://example.com/article')
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page.getByText('Activity updated.')).toBeVisible()
    await expect(page.getByText('External article')).toBeVisible()

    await page.getByRole('button', { name: 'Delete activity' }).first().click()
    await page.getByRole('button', { name: 'Delete' }).click()

    await expect(page).toHaveURL(/\/activities$/)
  })

  test('shows an optional linked GPX track on its Challenge map without changing completion', async ({ page }) => {
    await page.route('**/api/maps/token', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ token: 'test-token', clientId: 'test-client' }),
      }),
    )
    await page.route('**/*.atlas.microsoft.com/**', (route) => route.abort())
    await page.goto('/waypoints')
    await page.getByLabel('Search waypoints').fill('Chedworth')
    await page.getByRole('link', { name: 'Chedworth Roman Villa' }).click()
    await page.getByRole('button', { name: 'Log activity' }).click()
    await page.getByRole('combobox', { name: 'Activity category' }).click()
    await page.getByRole('option', { name: 'Gold' }).click()
    await page.locator('input[type="file"]').setInputFiles({
      name: 'walk.gpx',
      mimeType: 'application/gpx+xml',
      buffer: Buffer.from(
        '<gpx><trk><trkseg><trkpt lat="51.78" lon="-1.92"/><trkpt lat="51.79" lon="-1.93"/></trkseg></trk></gpx>',
      ),
    })
    await expect(page.getByRole('button', { name: 'Remove GPX track' })).toBeVisible()
    await page.getByRole('button', { name: 'Save activity' }).click()
    await expect(page.getByText('Activity saved.')).toBeVisible()
    await expect(page.getByText('Completion: Done', { exact: true })).toBeVisible()

    await page.getByRole('link', { name: 'Progress', exact: true }).click()
    await page.getByRole('link', { name: 'National Trust', exact: true }).click()
    await expect(page.getByText('No planned GPX route attached.')).toBeVisible()
    const tracks = page.getByRole('checkbox', { name: 'Show recorded Activity tracks (1)' })
    await expect(tracks).toBeChecked()
    await expect(page.getByLabel('Recorded Activity tracks', { exact: true })).toBeVisible()
    await tracks.uncheck()
    await expect(page.getByLabel('Recorded Activity tracks', { exact: true })).not.toBeVisible()
    await tracks.check()
    await expect(page.getByLabel('Recorded Activity tracks', { exact: true })).toBeVisible()
  })
})
