import { expect, test } from '@playwright/test'

test.describe('activity management flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => window.localStorage.clear())
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

  test('attaches and removes a GPX track without changing the activity location', async ({ page }) => {
    const gpx = '<gpx><trk><trkseg><trkpt lat="51" lon="-2"/><trkpt lat="52" lon="-3"/></trkseg></trk></gpx>'
    await page.goto('/activities')
    await page.getByRole('button', { name: 'Add activity' }).click()
    await page.getByLabel('Postcode').fill('GL1 1AA')
    await page.getByLabel('Description / notes').fill('Keep these notes')
    await page.getByLabel('GPX track file').setInputFiles({
      name: 'invalid.gpx',
      mimeType: 'application/gpx+xml',
      buffer: Buffer.from('<gpx/>'),
    })
    await expect(page.getByText('GPX must contain a recorded track with at least two points.')).toBeVisible()
    await expect(page.getByLabel('Description / notes')).toHaveValue('Keep these notes')
    await page.getByLabel('GPX track file').setInputFiles({
      name: 'walk.gpx',
      mimeType: 'application/gpx+xml',
      buffer: Buffer.from(gpx),
    })
    await expect(page.getByText('Attached track: walk.gpx')).toBeVisible()
    await page.getByRole('button', { name: 'Save activity' }).click()
    await page.getByRole('link', { name: '2026' }).first().click()
    await expect(page.getByRole('link', { name: 'View track on map' })).toHaveAttribute('href', /\/map\?track=/)
    await expect(page.getByText('Postcode: GL1 1AA')).toBeVisible()

    await page.reload()
    await expect(page.getByText('Recorded GPX track: walk.gpx')).toBeVisible()
    await page.getByRole('button', { name: 'Edit activity' }).click()
    await page.getByRole('button', { name: 'Remove GPX track' }).click()
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('link', { name: 'View track on map' })).toHaveCount(0)
  })
})
