import { expect, test, type Page } from '@playwright/test'
import { createActivity, DataSchema, type WaypointsData } from '../src/domain/visit'

const waypointTitle = `Fictional Map destination ${'LongDestination'.repeat(8)}`
const activityTitle = `Fictional Map activity ${'LongActivity'.repeat(8)}`

function fixtureData(): WaypointsData {
  return DataSchema.parse({
    challenges: [
      {
        challengeId: 'ordinary',
        title: 'Ordinary Map challenge',
        description: 'Synthetic Map challenge',
        supportsActivityCategories: false,
      },
    ],
    waypoints: [
      {
        waypointId: 'map-place',
        title: waypointTitle,
        description: 'Synthetic Map destination',
        category: 'Garden',
        tags: [],
        challengeIds: ['ordinary'],
        completion: { mode: 'once' },
        location: { latitude: 51.86, longitude: -2.22 },
        referenceIds: [],
        photoReferenceIds: [],
      },
    ],
    activities: [
      createActivity({
        activityId: 'map-activity',
        name: activityTitle,
        waypointId: 'map-place',
        date: '2026-08-01',
        location: { kind: 'coordinates', latitude: 51.86, longitude: -2.22 },
      }),
    ],
    ideas: [],
    references: [],
    photoReferences: [],
  })
}

async function isolate(page: Page, role: 'admin' | 'viewer', mode = 'demo-cosmos', empty = false) {
  const data = fixtureData()
  if (empty) {
    data.waypoints = []
    data.activities = []
  }
  let searches = 0
  let writes = 0
  await page.addInitScript((selected) => {
    localStorage.clear()
    localStorage.setItem('journey-data-mode-v1', selected)
  }, mode)
  await page.context().route('**/api/**', async (route) => {
    if (route.request().method() !== 'GET') writes++
    expect(route.request().method()).toBe('GET')
    const url = new URL(route.request().url())
    if (url.pathname === '/api/maps/token') {
      await route.fulfill({
        status: 404,
        contentType: 'text/plain',
        body: 'Maps rendering unavailable in this controlled test.',
      })
    } else if (url.pathname === '/api/maps/search') {
      searches++
      await route.fulfill({
        json: { results: [{ address: { freeformAddress: 'Fictional origin' }, position: { lat: 51.86, lon: -2.22 } }] },
      })
    } else {
      expect(url.pathname).toMatch(/^\/api\/journey\/(demo|production)$/)
      await route.fulfill({ json: { data, etags: {}, role } })
    }
  })
  return { searches: () => searches, writes: () => writes }
}

async function noOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }))
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport)
}

async function start(page: Page, width: number, kind: 'waypoint' | 'activity') {
  await page.goto('/map')
  await expect(page.getByText(/Map access is unavailable in this environment/)).toBeVisible()
  if (kind === 'activity') await page.getByRole('tab', { name: 'Activities', exact: true }).click()
  await page.getByRole('textbox', { name: 'Nearby origin', exact: true }).fill('Fictional origin')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  if (width === 360) await page.getByRole('button', { name: 'List', exact: true }).click()
}

async function settings(page: Page, width: number) {
  if (width === 360) await page.getByRole('button', { name: 'open navigation' }).click()
  await page.getByRole('link', { name: 'Settings', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible()
}

async function chooseMode(page: Page, label: string) {
  await page.getByRole('combobox', { name: 'Data mode', exact: true }).click()
  await page.getByRole('option', { name: label, exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Data mode', exact: true })).toHaveText(label)
}

test.describe('Map exploration return', () => {
  test.beforeEach(() => {
    test.info().annotations.push({
      type: 'Maps evidence',
      description:
        'Controlled API/list/layout evidence with explicitly unavailable Maps rendering; not live camera/marker/cluster acceptance.',
    })
  })

  for (const width of [360, 1280]) {
    for (const role of ['admin', 'viewer'] as const) {
      for (const kind of ['waypoint', 'activity'] as const) {
        test(`${width}px ${role} ${kind} returns through breadcrumb and browser Back`, async ({ page }) => {
          await page.setViewportSize({ width, height: 800 })
          const fixture = await isolate(page, role)
          await start(page, width, kind)
          const list = page.getByLabel(kind === 'waypoint' ? 'Nearest visible waypoints' : 'Nearest activities', {
            exact: true,
          })
          const result = list.locator(
            `a[href="/${kind === 'waypoint' ? 'waypoints/map-place' : 'activities/map-activity'}"]`,
          )
          await expect(result).toBeVisible()
          await expect(result).toHaveAccessibleName(new RegExp(kind === 'waypoint' ? waypointTitle : activityTitle))
          await page.getByRole('textbox', { name: 'Nearby origin', exact: true }).fill('Edited unresolved text')
          await noOverflow(page)
          for (const back of ['breadcrumb', 'browser']) {
            await result.focus()
            await page.keyboard.press('Enter')
            await expect(page.getByRole('link', { name: 'Back to Map', exact: true })).toBeVisible()
            if (role === 'viewer') {
              await expect(page.getByText('Read-only mode', { exact: true })).toBeVisible()
              await expect(
                page.getByRole('button', { name: kind === 'waypoint' ? 'Log activity' : 'Edit activity', exact: true }),
              ).toHaveCount(0)
            }
            await noOverflow(page)
            if (back === 'breadcrumb') {
              await page.getByRole('link', { name: 'Back to Map', exact: true }).focus()
              await page.keyboard.press('Enter')
            } else await page.goBack()
            await expect(page.getByRole('textbox', { name: 'Nearby origin', exact: true })).toHaveValue(
              'Edited unresolved text',
            )
            await expect(
              page.getByRole('tab', { name: kind === 'waypoint' ? 'Waypoints' : 'Activities', exact: true }),
            ).toHaveAttribute('aria-selected', 'true')
            await expect(result).toBeFocused()
            await expect(result).toBeInViewport()
            await noOverflow(page)
            if (role === 'viewer' && kind === 'waypoint' && back === 'breadcrumb') {
              await page.screenshot({ path: test.info().outputPath(`map-return-${width}.png`), fullPage: true })
            }
          }
          expect(fixture.searches()).toBe(1)
          expect(fixture.writes()).toBe(0)
        })
      }
    }

    test(`${width}px Demo local retains read-only nearby return`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      const fixture = await isolate(page, 'viewer', 'demo-local')
      await start(page, width, 'waypoint')
      const result = page
        .getByLabel('Nearest visible waypoints', { exact: true })
        .locator('a[href="/waypoints/demo-foxglove-manor"]')
      await result.click()
      await expect(
        page.getByText('Demo local data is bundled sample data, so it cannot be changed.', { exact: false }),
      ).toBeVisible()
      await expect(page.getByRole('button', { name: 'Log activity', exact: true })).toHaveCount(0)
      await page.getByRole('link', { name: 'Back to Map', exact: true }).click()
      await expect(result).toBeFocused()
      await noOverflow(page)
      expect(fixture.searches()).toBe(1)
      expect(fixture.writes()).toBe(0)
    })

    test(`${width}px dataset away-and-back permanently resets exploration`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      const fixture = await isolate(page, 'admin')
      await start(page, width, 'waypoint')
      await page
        .getByLabel('Nearest visible waypoints', { exact: true })
        .locator('a[href="/waypoints/map-place"]')
        .click()
      await settings(page, width)
      await chooseMode(page, 'Demo local data')
      await chooseMode(page, 'Demo Cosmos data')
      await page.goBack()
      await page.getByRole('link', { name: 'Back to Map', exact: true }).click()
      await expect(page).toHaveURL(/\/map$/)
      await expect(
        page.getByText('Map exploration was reset because the dataset changed.', { exact: true }),
      ).toBeVisible()
      await expect(page.getByRole('textbox', { name: 'Nearby origin', exact: true })).toHaveValue('')
      await noOverflow(page)
      expect(fixture.searches()).toBe(1)
      expect(fixture.writes()).toBe(0)
    })
  }

  test('empty current data stays distinct from unavailable Maps rendering', async ({ page }) => {
    const fixture = await isolate(page, 'viewer', 'demo-cosmos', true)
    await start(page, 1280, 'waypoint')
    await expect(page.getByText('No visible waypoints.', { exact: true })).toBeVisible()
    await expect(page.getByText(/Map access is unavailable in this environment/)).toBeVisible()
    await expect(page.getByLabel('Nearest visible waypoints', { exact: true }).getByRole('link')).toHaveCount(0)
    expect(fixture.searches()).toBe(1)
    expect(fixture.writes()).toBe(0)
  })
})
