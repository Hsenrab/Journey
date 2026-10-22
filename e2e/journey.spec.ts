import { expect, test } from '@playwright/test'
import type { WaypointsData } from '../src/domain/visit'

test('remote Waypoint locations resolve, retain failed drafts, clear and honor manual coordinates', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('journey-data-mode-v1', 'demo-cosmos')
  })
  let data: WaypointsData = {
    waypoints: [],
    challenges: [],
    ideas: [],
    activities: [],
    references: [],
    photoReferences: [],
  }
  const writes: WaypointsData[] = []
  await page.route('**/api/journey/**', async (route) => {
    expect(route.request().url()).toContain('/api/journey/demo')
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON()
      expect(body.operation).toBe('replace')
      writes.push(structuredClone(body.data))
      if (writes.length === 2) {
        await route.fulfill({ status: 400, json: { error: 'No position found for Changed place' } })
        return
      }
      data = body.data
      const location = data.waypoints[0].location
      if (location && location.latitude === undefined) {
        location.latitude = writes.length === 1 ? 51 : 52
        location.longitude = -2
      }
    }
    await route.fulfill({
      json: { data, etags: { [data.waypoints[0]?.waypointId ?? 'empty']: 'saved' }, role: 'admin' },
    })
  })
  await page.goto('/waypoints')
  await page.getByRole('button', { name: 'Add waypoint', exact: true }).click()
  await page.getByLabel('Title', { exact: true }).fill('Remote Waypoint')
  await page.getByLabel('Description', { exact: true }).fill('Synthetic browser test')
  await page.getByRole('textbox', { name: 'Category', exact: true }).fill('Walk')
  await page.getByLabel('Place name', { exact: true }).fill('Original place')
  await page.getByRole('button', { name: 'Save waypoint', exact: true }).click()
  await expect(page.getByText('Waypoint saved.', { exact: true })).toBeVisible()
  expect(writes[0].waypoints[0].location).toEqual({ placeName: 'Original place' })
  await page.getByRole('link', { name: 'Remote Waypoint', exact: true }).click()
  await page.getByRole('button', { name: 'Edit waypoint', exact: true }).click()
  await expect(page.getByLabel('Latitude')).toHaveValue('51')
  await page.getByLabel('Place name').fill('Changed place')
  await page.getByRole('button', { name: 'Save waypoint', exact: true }).click()
  await expect(page.getByText(/No position found for Changed place/)).toBeVisible()
  expect(writes[1].waypoints[0].location).toEqual({ placeName: 'Changed place' })
  await expect(page.getByLabel('Place name')).toHaveValue('Changed place')
  await expect(page.getByLabel('Latitude')).toHaveValue('51')
  await expect(page.getByText('Waypoint saved.', { exact: true })).toHaveCount(0)
  expect(writes).toHaveLength(2)
  await page.getByRole('button', { name: 'Save waypoint', exact: true }).click()
  await expect(page.getByText('Waypoint saved.', { exact: true })).toBeVisible()
  expect(writes).toHaveLength(3)
  await page.getByRole('button', { name: 'Edit waypoint', exact: true }).click()
  await expect(page.getByLabel('Latitude')).toHaveValue('52')
  await page.getByLabel('Place name').fill('')
  await page.getByRole('button', { name: 'Save waypoint', exact: true }).click()
  await expect(page.getByText('Waypoint saved.', { exact: true })).toBeVisible()
  expect(writes[3].waypoints[0].location).toBeUndefined()
  await page.getByRole('button', { name: 'Edit waypoint', exact: true }).click()
  await page.getByLabel('Place name').fill('Manual place')
  await page.getByLabel('Latitude').fill('53')
  await page.getByLabel('Longitude').fill('-3')
  await page.getByRole('button', { name: 'Save waypoint', exact: true }).click()
  await expect(page.getByText('Waypoint saved.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Edit waypoint', exact: true }).click()
  await page.getByLabel('Place name').fill('Another manual place')
  await page.getByLabel('Latitude').fill('54')
  await page.getByRole('button', { name: 'Save waypoint', exact: true }).click()
  await expect(page.getByText('Waypoint saved.', { exact: true })).toBeVisible()
  expect(writes[5].waypoints[0].location).toEqual({ placeName: 'Another manual place', latitude: 54, longitude: -3 })
  expect(await page.evaluate(() => localStorage.getItem('waypoints-v1'))).toBeNull()
})

test.describe('remote data-mode switching', () => {
  test('guards editor drafts and keeps a remote save locked across page unmount', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear()
      localStorage.setItem('journey-data-mode-v1', 'demo-cosmos')
    })
    let data: WaypointsData = {
      waypoints: [],
      challenges: [],
      ideas: [],
      activities: [],
      references: [],
      photoReferences: [],
    }
    let releaseSave!: () => void
    const heldSave = new Promise<void>((resolve) => {
      releaseSave = resolve
    })
    let writeStarted!: () => void
    const writing = new Promise<void>((resolve) => {
      writeStarted = resolve
    })
    let reads = 0
    const writes: string[] = []
    await page.route('**/api/journey/**', async (route) => {
      expect(route.request().url()).toContain('/api/journey/demo')
      if (route.request().method() === 'POST') {
        writes.push(route.request().url())
        writeStarted()
        await heldSave
        data = route.request().postDataJSON().data
      } else reads += 1
      await route.fulfill({ json: { data, etags: {}, role: 'admin' } })
    })
    await page.goto('/ideas')
    await page.getByRole('button', { name: 'Add idea' }).click()
    await page.getByLabel('Title', { exact: true }).fill('Unsaved remote idea')
    const editorUrl = page.url()
    let prompts = 0
    page.once('dialog', async (dialog) => {
      prompts += 1
      await dialog.dismiss()
    })
    await page.getByRole('link', { name: 'Settings', exact: true }).click()
    await expect(page).toHaveURL(editorUrl)
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Unsaved remote idea')
    expect(await page.evaluate(() => localStorage.getItem('journey-data-mode-v1'))).toBe('demo-cosmos')
    page.once('dialog', async (dialog) => {
      prompts += 1
      await dialog.accept()
    })
    await page.getByRole('link', { name: 'Settings', exact: true }).click()
    await expect(page).toHaveURL(/\/settings$/)
    page.on('dialog', async (dialog) => {
      prompts += 1
      await dialog.dismiss()
    })
    await page.getByRole('combobox', { name: 'Data mode' }).click()
    await page.getByRole('option', { name: 'Demo local data', exact: true }).click()
    expect(prompts).toBe(2)
    await page.getByRole('combobox', { name: 'Data mode' }).click()
    await page.getByRole('option', { name: 'Demo Cosmos data', exact: true }).click()
    await page.getByRole('link', { name: 'Ideas', exact: true }).click()
    await page.getByRole('button', { name: 'Add idea' }).click()
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('')
    await page.getByLabel('Title', { exact: true }).fill('Held remote save')
    await page.getByRole('button', { name: 'Save idea', exact: true }).click()
    await writing
    // Unrelated navigation is deliberately outside the new discard guard.
    await page.getByRole('link', { name: 'Activities', exact: true }).click()
    await page.getByRole('link', { name: 'Settings', exact: true }).click()
    const selector = page.getByRole('combobox', { name: 'Data mode' })
    await expect(selector).toHaveAttribute('aria-disabled', 'true')
    const readsWhilePending = reads
    expect(await page.evaluate(() => localStorage.getItem('journey-data-mode-v1'))).toBe('demo-cosmos')
    releaseSave()
    await expect(selector).not.toHaveAttribute('aria-disabled', 'true')
    expect(reads).toBe(readsWhilePending)
    expect(writes).toHaveLength(1)
    await selector.click()
    await page.getByRole('option', { name: 'Demo local data', exact: true }).click()
    expect(await page.evaluate(() => localStorage.getItem('journey-data-mode-v1'))).toBe('demo-local')
    expect(prompts).toBe(2)
    expect(await page.evaluate(() => localStorage.getItem('waypoints-v1'))).toBeNull()
  })
})

test.describe('activity management flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear()
      window.localStorage.setItem(
        'waypoints-v1',
        JSON.stringify({
          waypoints: [
            {
              waypointId: 'e2e-waypoint',
              title: 'Example Waypoint',
              description: 'A waypoint created for the end-to-end test.',
              category: 'Walk',
              tags: [],
              challengeIds: ['e2e-challenge'],
              completion: { mode: 'once' },
              location: { latitude: 51.783, longitude: -1.92 },
              referenceIds: [],
              photoReferenceIds: [],
            },
          ],
          challenges: [
            {
              challengeId: 'e2e-challenge',
              title: 'Example Challenge',
              description: 'A challenge created for the end-to-end test.',
              waypointIds: ['e2e-waypoint'],
              supportsActivityCategories: true,
            },
          ],
          ideas: [],
          activities: [],
          references: [],
          photoReferences: [],
        }),
      )
    })
  })

  test('creates a linked categorized activity from waypoint details', async ({ page }) => {
    await page.goto('/waypoints')
    await page.getByLabel('Search waypoints').fill('Example Waypoint')
    await page.getByRole('link', { name: 'Example Waypoint' }).click()

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
    await expect(page.getByText('Example Waypoint').first()).toBeVisible()
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
    await page.getByLabel('Search waypoints').fill('Example Waypoint')
    await page.getByRole('link', { name: 'Example Waypoint' }).click()
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
    await page.getByRole('link', { name: 'Example Challenge', exact: true }).click()
    await expect(page.getByLabel('Challenge map legend', { exact: true })).not.toContainText('Planned route')
    const tracks = page.getByRole('checkbox', { name: 'Show recorded Activity tracks (1)' })
    await expect(tracks).toBeChecked()
    await expect(page.getByLabel('Recorded Activity tracks', { exact: true })).toBeVisible()
    await tracks.uncheck()
    await expect(page.getByLabel('Recorded Activity tracks', { exact: true })).not.toBeVisible()
    await tracks.check()
    await expect(page.getByLabel('Recorded Activity tracks', { exact: true })).toBeVisible()
  })
})
