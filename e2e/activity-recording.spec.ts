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
  test(`Activity evidence keeps persisted order after save and reload at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.addInitScript(() => {
      localStorage.clear()
      localStorage.setItem('journey-data-mode-v1', 'demo-cosmos')
    })
    let data = fixture()
    data.references = [
      { referenceId: 'r1', title: 'First reference', url: 'https://example.com/first' },
      { referenceId: 'r2', title: 'Second reference', url: 'https://example.com/second' },
    ]
    data.photoReferences = [
      { photoReferenceId: 'p1', title: 'First photo', url: 'https://example.com/first.jpg' },
      { photoReferenceId: 'p2', title: 'Second photo', url: 'https://example.com/second.jpg' },
    ]
    data.activities[0]!.referenceIds = ['r2', 'r1']
    data.activities[0]!.photoReferenceIds = ['p2', 'p1']
    let writes = 0
    let reads = 0
    await page.route('**/api/journey/demo', async (route) => {
      if (route.request().method() === 'GET') {
        reads++
        await route.fulfill({ json: { data, etags: {}, role: 'admin' } })
        return
      }
      const body = route.request().postDataJSON()
      expect(body.operation).toBe('replace')
      writes++
      data = body.data
      await route.fulfill({ json: { data, etags: {} } })
    })
    await page.route('https://example.com/**', (route) =>
      route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="navy"/></svg>',
      }),
    )
    await page.goto('/activities/existing')
    const cards = page.getByRole('heading', { name: /^(First|Second|Added) reference$/ })
    const thumbnails = page.getByRole('group', { name: 'Photo thumbnails' }).getByRole('button')
    await expect(cards).toHaveText(['Second reference', 'First reference'])
    await expect(thumbnails).toHaveText(['Second photo', 'First photo'])
    await expect(page.getByRole('img', { name: 'Second photo', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Edit activity', exact: true }).click()
    await expect(page.getByLabel('Reference title', { exact: true }).nth(0)).toHaveValue('Second reference')
    await expect(page.getByLabel('Photo title', { exact: true }).nth(0)).toHaveValue('Second photo')
    await page.getByRole('button', { name: 'Move reference 2 up', exact: true }).click()
    await page.getByRole('button', { name: 'Add reference', exact: true }).click()
    await page.getByLabel('Reference title', { exact: true }).nth(2).fill('Added reference')
    await page.getByLabel('Reference URL', { exact: true }).nth(2).fill('https://example.com/added')
    await page.getByRole('button', { name: 'Move reference 3 up', exact: true }).click()
    await page.getByRole('button', { name: 'Move photo 2 up', exact: true }).click()
    await page.getByRole('button', { name: 'Add photo reference', exact: true }).click()
    await page.getByLabel('Photo title', { exact: true }).nth(2).fill('Added photo')
    await page.getByLabel('Photo URL', { exact: true }).nth(2).fill('https://example.com/added.jpg')
    await page.getByRole('button', { name: 'Move photo 3 up', exact: true }).click()
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.getByText('Activity saved.', { exact: true })).toBeVisible()
    const referenceTitles = ['First reference', 'Added reference', 'Second reference']
    const photoTitles = ['First photo', 'Added photo', 'Second photo']
    expect(writes).toBe(1)
    expect(
      data.activities[0]!.referenceIds.map((id) => data.references.find((item) => item.referenceId === id)!.title),
    ).toEqual(referenceTitles)
    expect(
      data.activities[0]!.photoReferenceIds.map(
        (id) => data.photoReferences.find((item) => item.photoReferenceId === id)!.title,
      ),
    ).toEqual(photoTitles)
    await expect(cards).toHaveText(referenceTitles)
    await expect(thumbnails).toHaveText(photoTitles)
    await page.reload()
    await expect(cards).toHaveText(referenceTitles)
    await expect(thumbnails).toHaveText(photoTitles)
    expect(reads).toBe(2)
    await expect(page.getByRole('img', { name: 'First photo', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Next photo', exact: true }).click()
    await expect(page.getByRole('img', { name: 'Added photo', exact: true })).toBeVisible()
    await thumbnails.nth(2).click()
    await expect(page.getByRole('img', { name: 'Second photo', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Edit activity', exact: true }).click()
    for (let index = 0; index < referenceTitles.length; index++) {
      await expect(page.getByLabel('Reference title', { exact: true }).nth(index)).toHaveValue(referenceTitles[index]!)
      await expect(page.getByLabel('Photo title', { exact: true }).nth(index)).toHaveValue(photoTitles[index]!)
    }
  })

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
      const save = () =>
        page.getByRole('button', { name: journey === 'edit' ? 'Save changes' : 'Save activity', exact: true })
      await title.fill('')
      await save().click()
      await expect(title).toHaveAttribute('aria-invalid', 'true')
      const recordedTitle =
        journey === 'edit' ? 'Earlier walk' : `Recorded walk ${'through the woods and beside the river '.repeat(8)}`
      await title.fill(recordedTitle)
      await title.press('Tab')
      await expect(title).toHaveAttribute('aria-invalid', 'false')
      expect(writes).toBe(0)
      if (journey === 'activities') await page.getByLabel('Postcode', { exact: true }).fill('GL1 1AA')
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
      await title.fill('')
      await title.press('Tab')
      await title.fill(recordedTitle)
      await title.press('Tab')
      await expect(title).toHaveAttribute('aria-invalid', 'false')
      await expect(page.getByRole('alert').filter({ hasText: 'Specific rejected save' })).toBeVisible()
      expect(writes).toBe(1)
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
        await expect(page.getByRole('heading', { name: recordedTitle, exact: true, level: 1 })).toBeVisible()
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
