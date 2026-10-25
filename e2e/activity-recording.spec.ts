import { expect, test } from '@playwright/test'
import type { WaypointsData } from '../src/domain/visit'

function fixture(): WaypointsData {
  return {
    challenges: [],
    waypoints: [
      {
        waypointId: 'walk',
        title: 'Local walk',
        description: 'Fictional walk',
        category: 'Walk',
        tags: [],
        challengeIds: [],
        completion: { mode: 'once' },
        location: { latitude: 51, longitude: -2 },
        referenceIds: [],
        photoReferenceIds: [],
      },
    ],
    ideas: [
      {
        ideaId: 'picnic',
        title: 'Picnic idea',
        description: '',
        notes: '',
        waypointIds: ['walk'],
        planningState: 'active',
        difficulty: 1,
        referenceIds: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ],
    activities: [
      {
        activityId: 'existing',
        name: 'Earlier walk',
        date: '2026-01-01',
        ideaIds: [],
        location: { kind: 'coordinates', latitude: 51, longitude: -2 },
        notes: '',
        referenceIds: [],
        photoReferenceIds: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ],
    references: [],
    photoReferences: [],
  }
}

for (const width of [360, 1280]) {
  for (const journey of ['activities', 'waypoint', 'idea', 'edit'] as const) {
    test(`${journey} saves once with pending protection and explicit retry at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.clock.setFixedTime(new Date('2026-10-25T12:00:00Z'))
      await page.addInitScript(() => {
        localStorage.clear()
        localStorage.setItem('journey-data-mode-v1', 'demo-cosmos')
      })
      let data = fixture()
      let writes = 0
      let reads = 0
      let release: ((success: boolean) => void) | undefined
      const etags = () =>
        Object.fromEntries(
          [
            ...data.activities.map((item) => item.activityId),
            ...data.waypoints.map((item) => item.waypointId),
            ...data.ideas.map((item) => item.ideaId),
          ].map((id) => [id, `"etag-${writes}"`]),
        )
      await page.route('**/api/journey/demo', async (route) => {
        if (route.request().method() === 'GET') {
          reads++
          await route.fulfill({ json: { data, etags: etags(), role: 'admin' } })
          return
        }
        writes++
        const body = route.request().postDataJSON()
        expect(body.operation).toBe('replace')
        const success = await new Promise<boolean>((resolve) => {
          release = resolve
        })
        if (!success) {
          await route.fulfill({
            status: 400,
            json: {
              error: `Specific rejected save. ${'The recorded details need correction before saving. '.repeat(8)}`,
            },
          })
          return
        }
        data = body.data
        await route.fulfill({ json: { data, etags: etags() } })
      })
      await page.goto('/settings')
      if (width < 600) await page.getByRole('button', { name: 'open navigation' }).click()
      await page
        .getByRole('link', {
          name: journey === 'waypoint' ? 'Waypoints' : journey === 'idea' ? 'Ideas' : 'Activities',
          exact: true,
        })
        .click()
      if (journey !== 'activities') {
        await page
          .getByRole('link', {
            name: journey === 'waypoint' ? 'Local walk' : journey === 'idea' ? 'Picnic idea' : 'Earlier walk',
            exact: true,
          })
          .click()
      }
      await page
        .getByRole(journey === 'idea' ? 'link' : 'button', {
          name:
            journey === 'activities'
              ? 'Add activity'
              : journey === 'waypoint'
                ? 'Log activity'
                : journey === 'idea'
                  ? 'Log activity from this idea'
                  : 'Edit activity',
          exact: true,
        })
        .click()
      const title = page.getByLabel('Activity title', { exact: true })
      const recordedTitle =
        journey === 'edit' ? 'Earlier walk' : `Recorded walk ${'through the woods and beside the river '.repeat(8)}`
      if (journey !== 'edit') await title.fill(recordedTitle)
      if (journey === 'activities') await page.getByLabel('Postcode', { exact: true }).fill('GL1 1AA')
      const save = () =>
        page.getByRole('button', { name: journey === 'edit' ? 'Save changes' : 'Save activity', exact: true })
      await save().focus()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('status')).toHaveText('Saving...')
      await expect(title).toBeDisabled()
      await page.locator('form').evaluate((form) => {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      })
      const pendingUrl = page.url()
      await page.getByRole('link', { name: 'Journey', exact: true }).click()
      await expect(page).toHaveURL(pendingUrl)
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            window.addEventListener('popstate', () => resolve(), { once: true })
            window.history.back()
          }),
      )
      await expect(page).toHaveURL(pendingUrl)
      await expect.poll(() => writes).toBe(1)
      release!(false)
      await expect(page.getByRole('alert').filter({ hasText: 'Specific rejected save' })).toBeVisible()
      await expect(title).toHaveValue(recordedTitle)
      await save().click()
      await expect.poll(() => writes).toBe(2)
      release!(true)
      await expect(page.getByText('Activity saved.', { exact: journey !== 'idea' })).toBeVisible()
      expect(data.activities).toHaveLength(journey === 'edit' ? 1 : 2)
      expect(reads).toBe(1)
      if (journey === 'idea') {
        await expect(page).toHaveURL(/\/ideas\/picnic$/)
        const saved = data.activities.find((item) => item.activityId !== 'existing')!
        const savedLink = page.getByRole('alert').getByRole('link', { name: 'View activity', exact: true })
        await expect(savedLink).toHaveAttribute('href', `/activities/${saved.activityId}`)
        await expect.poll(() => page.evaluate(() => window.history.state.usr)).toBeNull()
        await savedLink.click()
        await expect(page).toHaveURL(new RegExp(`/activities/${saved.activityId}$`))
        await page.goBack()
        await expect(page).toHaveURL(/\/ideas\/picnic$/)
        await expect(page.getByText('Activity saved.', { exact: false })).toHaveCount(0)
      }
      if (width < 600) await page.getByRole('button', { name: 'open navigation' }).click()
      await page.getByRole('link', { name: 'Settings', exact: true }).click()
      await expect(page).toHaveURL(/\/settings$/)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    })
  }
}

test('UK date prefill and optional evidence correction work with a non-UK browser timezone', async ({ browser }) => {
  const context = await browser.newContext({ timezoneId: 'America/Los_Angeles', viewport: { width: 360, height: 800 } })
  const page = await context.newPage()
  try {
    await page.clock.setFixedTime(new Date('2026-07-15T23:30:00Z'))
    await page.addInitScript(() => {
      localStorage.clear()
      localStorage.setItem('journey-data-mode-v1', 'demo-cosmos')
    })
    await page.route('**/api/journey/demo', (route) =>
      route.fulfill({ json: { data: fixture(), etags: {}, role: 'admin' } }),
    )
    await page.goto('/activities?mode=add')
    await expect(page.getByLabel('Activity date', { exact: true })).toHaveValue('2026-07-16')
    const summary = page.getByRole('button', { name: /^References \(optional\)/ })
    await expect(summary).toHaveAttribute('aria-expanded', 'false')
    await summary.focus()
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Add reference', exact: true }).click()
    await summary.click()
    await page.getByLabel('Activity title', { exact: true }).fill('Walk')
    await page.getByLabel('Postcode', { exact: true }).fill('GL1 1AA')
    await page.getByRole('button', { name: 'Save activity' }).click()
    await expect(page.getByLabel('Reference title', { exact: true })).toBeFocused()
    await page.getByLabel('Reference title', { exact: true }).fill('Trail')
    await page.getByLabel('Reference URL', { exact: true }).fill('https://example.com/trail')
    await summary.click()
    await summary.press('Enter')
    await expect(page.getByLabel('Reference title', { exact: true })).toHaveValue('Trail')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  } finally {
    await context.close()
  }
})
