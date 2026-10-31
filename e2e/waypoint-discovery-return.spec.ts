import { expect, test, type Page } from '@playwright/test'
import { DataSchema, type WaypointsData } from '../src/domain/visit'

const area = `Fictional region ${'LongRegion'.repeat(7)}`
const title = `Garden through the woods ${'UnbrokenDestination'.repeat(7)}`

function discoveryData(): WaypointsData {
  return DataSchema.parse({
    challenges: [
      {
        challengeId: 'award',
        title: 'Award discovery',
        description: 'Fictional award challenge',
        supportsActivityCategories: true,
        awardDescriptions: { bronze: 'Afternoon', silver: 'Full day', gold: 'Overnight' },
      },
      {
        challengeId: 'ordinary',
        title: 'Ordinary discovery',
        description: 'Fictional ordinary challenge',
        supportsActivityCategories: false,
      },
    ],
    waypoints: Array.from({ length: 20 }, (_, index) => ({
      waypointId: `place-${index}`,
      title: index >= 18 ? title : `Garden ${String(index).padStart(2, '0')}`,
      description: 'Fictional comparison destination',
      category: 'Garden',
      tags: [],
      challengeIds: ['award', 'ordinary'],
      completion: index % 2 ? { mode: 'count', target: 3 } : { mode: 'once' },
      location: { addressOrRegion: area, latitude: 51, longitude: -2 },
      referenceIds: [],
      photoReferenceIds: [],
    })),
    activities: [],
    ideas: [],
    references: [],
    photoReferences: [],
  })
}

async function isolate(page: Page, role: 'admin' | 'viewer' = 'admin', mode = 'demo-cosmos') {
  let data = discoveryData()
  let writes = 0
  let failure = false
  let hold: Promise<void> | undefined
  let holdRead: Promise<void> | undefined
  let conflict = false
  await page.addInitScript((selected) => {
    localStorage.clear()
    localStorage.setItem('journey-data-mode-v1', selected)
  }, mode)
  await page.context().route('**/api/**', async (route) => {
    expect(route.request().url()).toMatch(/\/api\/journey\/(demo|production)$/)
    if (route.request().method() === 'POST') {
      expect(role).toBe('admin')
      writes++
      if (hold) await hold
      if (conflict) {
        await route.fulfill({ status: 409, json: { error: 'conflict' } })
        return
      }
      expect(route.request().postDataJSON().operation).toBe('replace')
      data = DataSchema.parse(route.request().postDataJSON().data)
    } else {
      expect(route.request().method()).toBe('GET')
      if (holdRead) await holdRead
    }
    if (failure) await route.fulfill({ status: 503, json: { error: 'Specific discovery load failure' } })
    else await route.fulfill({ json: { data, etags: {}, role } })
  })
  return {
    writes: () => writes,
    data: () => structuredClone(data),
    replace: (replacement: WaypointsData) => {
      data = DataSchema.parse(replacement)
    },
    fail: (value: boolean) => {
      failure = value
    },
    hold: (value: Promise<void> | undefined) => {
      hold = value
    },
    holdRead: (value: Promise<void> | undefined) => {
      holdRead = value
    },
    conflict: () => {
      conflict = true
    },
  }
}

async function choose(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

async function noOverflow(page: Page) {
  const size = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }))
  expect(size.content).toBeLessThanOrEqual(size.width)
}

async function settings(page: Page) {
  if (page.viewportSize()!.width === 360) await page.getByRole('button', { name: 'open navigation' }).click()
  await page.getByRole('link', { name: 'Settings', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible()
}

async function startActivity(page: Page) {
  await page.getByRole('button', { name: 'Log activity', exact: true }).click()
  await page.getByLabel('Activity title', { exact: true }).fill('Fictional progress')
  await choose(page, 'Award tier', 'Bronze')
}

test.describe('Waypoint discovery return', () => {
  for (const width of [360, 1280]) {
    for (const role of ['admin', 'viewer'] as const) {
      test(`${width}px ${role} restores criteria and exact focus through both returns`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 })
        const fixture = await isolate(page, role)
        await page.goto('/waypoints?challenge=award&status=not-started')
        await expect(page.getByRole('link', { name: 'Garden 00', exact: true })).toBeVisible()
        if (width === 1280) {
          expect((await page.getByRole('link', { name: 'Garden 00', exact: true }).boundingBox())!.y).toBeLessThan(800)
        }
        await noOverflow(page)
        await page.getByLabel('Search waypoints').fill('Garden')
        await choose(page, 'Sort', 'Last activity date')
        await page.getByRole('button', { name: 'More filters (0 active)' }).click()
        await choose(page, 'Area', area)
        await choose(page, 'Category', 'Garden')
        const selected = page.locator('a[href="/waypoints/place-19"]')
        const before = await page
          .locator('.MuiCardActionArea-root')
          .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')))
        expect((await selected.boundingBox())!.y).toBeGreaterThan(800)
        for (
          let count = 0;
          count < 30 && !(await selected.evaluate((node) => node === document.activeElement));
          count++
        )
          await page.keyboard.press('Tab')
        await expect(selected).toBeFocused()
        await page.keyboard.press('Enter')
        await expect(page.getByRole('heading', { name: title, exact: true, level: 1 })).toBeVisible()
        await page.getByRole('link', { name: 'Back to Waypoint results' }).click()
        await expect(selected).toBeFocused()
        await expect(selected).toBeInViewport()
        await expect(page.getByLabel('Search waypoints')).toHaveValue('Garden')
        await expect(page.getByRole('combobox', { name: 'Sort', exact: true })).toHaveText('Last activity date')
        await expect(page.getByRole('button', { name: 'More filters (2 active)' })).toBeVisible()
        expect(
          await page
            .locator('.MuiCardActionArea-root')
            .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href'))),
        ).toEqual(before)
        expect(await selected.evaluate((node) => getComputedStyle(node).outlineStyle)).not.toBe('none')
        const metadata = await selected.locator('p').evaluate((node) => ({
          width: node.clientWidth,
          contentWidth: node.scrollWidth,
        }))
        expect(metadata.contentWidth).toBeLessThanOrEqual(metadata.width)
        await noOverflow(page)
        await page.screenshot({ path: test.info().outputPath('focused-return.png') })
        await page.keyboard.press('Enter')
        await expect(page).toHaveURL(/\/waypoints\/place-19$/)
        await page.goBack()
        await expect(selected).toBeFocused()
        await expect(selected).toBeInViewport()
        await page.getByRole('button', { name: 'Clear filters' }).click()
        await expect(page.getByLabel('Search waypoints')).toHaveValue('')
        await expect(page.getByRole('button', { name: 'More filters (0 active)' })).toBeVisible()
        await expect(page).toHaveURL(/\/waypoints\?challenge=award$/)
        await expect(page.getByRole('combobox', { name: 'Sort', exact: true })).toHaveText('Last activity date')
        if (role === 'viewer') {
          await expect(page.getByText(/Your Journey access is viewer only/)).toBeVisible()
          await expect(page.getByRole('button', { name: 'Add waypoint' })).toHaveCount(0)
        }
        expect(fixture.writes()).toBe(0)
      })
    }
  }

  test('ordinary scope and exact punctuation remain a live shortlist, not saved defaults', async ({ page }) => {
    const fixture = await isolate(page)
    const data = fixture.data()
    data.waypoints[0]!.title = '  Caf\u00e9 & garden?  '
    fixture.replace(data)
    await page.goto('/waypoints?challenge=ordinary')
    await expect(page.getByRole('combobox', { name: 'Highest recorded award', exact: true })).toHaveCount(0)
    await page.getByLabel('Search waypoints').fill('  Caf\u00e9 & garden?  ')
    await page.locator('a[href="/waypoints/place-0"]').click()
    await page.getByRole('link', { name: 'Back to Waypoint results' }).click()
    await expect(page.getByLabel('Search waypoints')).toHaveValue('  Caf\u00e9 & garden?  ')
    await page.reload()
    await expect(page.getByLabel('Search waypoints')).toHaveValue('')
    await expect(page).toHaveURL(/challenge=ordinary$/)
    await page.locator('a[href="/waypoints/place-0"]').click()
    await page.reload()
    await expect(page.getByRole('link', { name: 'Back to Waypoint results' })).toHaveCount(0)
    expect(fixture.writes()).toBe(0)
  })

  for (const operation of ['award', 'add'] as const) {
    test(`${operation} query continuation resets after Settings dataset reversal and browser Back`, async ({
      page,
    }) => {
      const fixture = await isolate(page)
      await page.goto('/waypoints?challenge=award&status=not-started')
      await page.getByLabel('Search waypoints').fill('Garden')
      await page.locator('a[href="/waypoints/place-19"]').click()
      await page.getByRole('link', { name: 'Back to Waypoint results' }).click()
      if (operation === 'award') {
        await choose(page, 'Highest recorded award', 'All award tiers')
      } else {
        await page.getByRole('button', { name: 'Add waypoint', exact: true }).click()
        await page.getByRole('button', { name: 'Cancel', exact: true }).click()
      }
      await expect(page.getByLabel('Search waypoints')).toHaveValue('Garden')
      await settings(page)
      await choose(page, 'Data mode', 'Demo local data')
      await choose(page, 'Data mode', 'Demo Cosmos data')
      await expect(page.getByText('Demo Cosmos data loaded', { exact: true })).toBeVisible()
      await page.goBack()
      await expect(page).toHaveURL(/\/waypoints$/)
      await expect(page.getByLabel('Search waypoints')).toHaveValue('')
      await expect(page.getByRole('combobox', { name: 'Sort', exact: true })).toHaveText('Name')
      await expect(page.getByText(/Challenge scope:/)).toHaveCount(0)
      expect(fixture.writes()).toBe(0)
    })
  }

  test('reordering duplicate-title results focuses the exact current ID and completion after recording', async ({
    page,
  }) => {
    const fixture = await isolate(page)
    await page.goto('/waypoints?challenge=award')
    await choose(page, 'Sort', 'Last activity date')
    await page.locator('a[href="/waypoints/place-18"]').click()
    await startActivity(page)
    await page.getByRole('button', { name: 'Save activity', exact: true }).click()
    await expect(page.getByRole('status', { name: 'Activity saved confirmation' })).toBeFocused()
    await page.getByRole('link', { name: 'Back to Waypoint results' }).click()
    const selected = page.locator('a[href="/waypoints/place-18"]')
    await expect(selected).toBeFocused()
    await expect(selected).toContainText('Completion: Done')
    await expect(selected).toContainText('Highest recorded award: Bronze')
    await expect(page.locator('.MuiCardActionArea-root').first()).toHaveAttribute('href', '/waypoints/place-18')
    expect(fixture.writes()).toBe(1)
  })

  for (const change of ['nonmatching', 'deleted', 'scope', 'options'] as const) {
    test(`current ${change} data wins over the captured result after reload`, async ({ page }) => {
      const fixture = await isolate(page)
      await page.goto('/waypoints?challenge=award')
      await page.getByLabel('Search waypoints').fill('UnbrokenDestination')
      if (change === 'options') {
        await page.getByRole('button', { name: 'More filters (0 active)' }).click()
        await choose(page, 'Area', area)
      }
      await page.locator('a[href="/waypoints/place-19"]').click()
      await page.getByRole('button', { name: 'Edit waypoint' }).click()
      await page.getByLabel('Title', { exact: true }).fill('Unsaved refresh request')
      fixture.conflict()
      await page.getByRole('button', { name: 'Save waypoint' }).click()
      await expect(page.getByText('Your data has changed in another session.')).toBeVisible()
      const changed = fixture.data()
      if (change === 'deleted') changed.waypoints = changed.waypoints.filter((item) => item.waypointId !== 'place-19')
      if (change === 'nonmatching')
        changed.waypoints.find((item) => item.waypointId === 'place-19')!.title = 'Renamed destination'
      if (change === 'options')
        changed.waypoints.forEach((item) => {
          item.location = { ...item.location, addressOrRegion: 'New region' }
        })
      if (change === 'scope') {
        changed.challenges = changed.challenges.filter((item) => item.challengeId !== 'award')
        changed.waypoints.forEach((item) => {
          item.challengeIds = ['ordinary']
        })
      }
      fixture.replace(changed)
      await page.getByRole('button', { name: 'Reload latest' }).click()
      if (change === 'deleted') await expect(page.getByText('Waypoint not found.')).toBeVisible()
      await page.getByRole('link', { name: 'Back to Waypoint results' }).click()
      if (change === 'scope') {
        await expect(page.getByRole('alert')).toContainText('Challenge')
        await expect(page.getByText(/The Waypoint you opened/)).toHaveCount(0)
      } else {
        const explanation = page.getByRole('alert').filter({
          hasText:
            change === 'deleted'
              ? 'The Waypoint you opened is no longer available.'
              : 'The Waypoint you opened no longer matches these filters.',
        })
        await expect(explanation).toBeFocused()
        await expect(page.locator('a[href="/waypoints/place-19"]')).toHaveCount(0)
        if (change === 'options') {
          await page.getByRole('button', { name: 'More filters (1 active)' }).click()
          await expect(page.getByRole('combobox', { name: 'Area', exact: true })).toHaveText(
            `${area} (no current waypoints)`,
          )
        }
        await page.getByLabel('Search waypoints').fill('')
        await expect(page.getByLabel('Search waypoints')).toBeFocused()
        await expect(page.getByText(/The Waypoint you opened/)).toHaveCount(0)
      }
      expect(fixture.writes()).toBe(1) // The deliberate failed save, not navigation.
    })
  }

  test('loading, empty data, no matches and direct invalid scope are distinct', async ({ page }) => {
    const fixture = await isolate(page)
    let release!: () => void
    fixture.holdRead(
      new Promise<void>((resolve) => {
        release = resolve
      }),
    )
    await page.goto('/waypoints')
    try {
      await expect(page.getByText('Loading waypoints…')).toBeVisible()
      await expect(page.getByText(/The Waypoint you opened|No waypoints/)).toHaveCount(0)
    } finally {
      release()
    }
    await expect(page.getByRole('link', { name: 'Garden 00', exact: true })).toBeVisible()
    await page.getByLabel('Search waypoints').fill('No such result')
    await expect(page.getByText('No waypoints match your search and filters.')).toBeVisible()
    await page.goto('/waypoints?challenge=missing')
    await expect(page.getByRole('alert')).toContainText('Challenge')
    fixture.replace({ waypoints: [], challenges: [], activities: [], ideas: [], references: [], photoReferences: [] })
    await page.goto('/waypoints')
    await expect(page.getByText('No waypoints in this dataset.')).toBeVisible()
    expect(fixture.writes()).toBe(0)
  })

  test('effective Demo fallback invalidates the breadcrumb and old history without masking its warning', async ({
    page,
  }) => {
    const fixture = await isolate(page)
    await page.goto('/waypoints?challenge=award')
    await page.locator('a[href="/waypoints/place-19"]').click()
    await page.getByRole('button', { name: 'Edit waypoint' }).click()
    await page.getByLabel('Title', { exact: true }).fill('Conflict draft')
    fixture.conflict()
    await page.getByRole('button', { name: 'Save waypoint' }).click()
    await expect(page.getByRole('button', { name: 'Reload latest' })).toBeVisible()
    fixture.fail(true)
    await page.getByRole('button', { name: 'Reload latest' }).click()
    await expect(page.getByText('Waypoint not found.')).toBeVisible()
    await expect(page.getByRole('alert').filter({ hasText: 'Demo Cosmos data could not be loaded' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to Waypoint results' })).toHaveCount(0)
    await page.goBack()
    await expect(page).toHaveURL(/\/waypoints$/)
    await expect(page.getByRole('alert').filter({ hasText: 'Demo Cosmos data could not be loaded' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add waypoint' })).toHaveCount(0)
    fixture.fail(false)
    await settings(page)
    await expect(page.getByRole('alert')).toContainText('Specific discovery load failure')
    await choose(page, 'Data mode', 'Demo local data')
    await choose(page, 'Data mode', 'Demo Cosmos data')
    await page.goBack()
    await expect(page).toHaveURL(/\/waypoints$/)
    await expect(page.getByText(/Challenge scope:/)).toHaveCount(0)
  })

  for (const editor of ['Waypoint', 'Activity'] as const) {
    test(`dirty ${editor} return asks once and preserves failed input on decline`, async ({ page }) => {
      const fixture = await isolate(page)
      await page.goto('/waypoints?challenge=award')
      await page.locator('a[href="/waypoints/place-19"]').click()
      const activity = editor === 'Activity'
      await page.getByRole('button', { name: activity ? 'Log activity' : 'Edit waypoint', exact: true }).click()
      const input = page.getByLabel(activity ? 'Activity title' : 'Title', { exact: true })
      await input.fill('Retained draft')
      if (activity) {
        await page.getByRole('button', { name: 'Save activity', exact: true }).click()
        await expect(page.getByText('Select Bronze, Silver or Gold.')).toBeVisible()
      }
      let dialogs = 0
      page.once('dialog', async (dialog) => {
        dialogs++
        expect(dialog.message()).toBe('You have unsaved changes. Discard them and continue to Waypoint results?')
        await dialog.dismiss()
      })
      await page.getByRole('link', { name: 'Back to Waypoint results' }).click()
      await expect(input).toHaveValue('Retained draft')
      expect(dialogs).toBe(1)
      if (activity) await expect(page.getByText('Select Bronze, Silver or Gold.')).toBeVisible()
      page.once('dialog', async (dialog) => {
        dialogs++
        await dialog.accept()
      })
      await page.getByRole('link', { name: 'Back to Waypoint results' }).click()
      await expect(page.locator('a[href="/waypoints/place-19"]')).toBeFocused()
      expect(dialogs).toBe(2)
      expect(fixture.writes()).toBe(0)
    })
  }

  test('pending Activity blocks return and Settings, then fresh count/award results explain nonmatching filters', async ({
    page,
  }) => {
    const fixture = await isolate(page)
    await page.goto('/waypoints?challenge=award&status=not-started')
    await page.locator('a[href="/waypoints/place-19"]').click()
    await startActivity(page)
    let release!: () => void
    fixture.hold(
      new Promise<void>((resolve) => {
        release = resolve
      }),
    )
    await page.getByRole('button', { name: 'Save activity', exact: true }).click()
    try {
      await expect(page.getByRole('button', { name: 'Saving...', exact: true })).toBeVisible()
      await page.getByRole('link', { name: 'Back to Waypoint results' }).click()
      await expect(page).toHaveURL(/\/waypoints\/place-19$/)
      await page.getByRole('link', { name: 'Settings', exact: true }).first().click()
      await expect(page).toHaveURL(/\/waypoints\/place-19$/)
    } finally {
      release()
    }
    await expect(page.getByRole('status', { name: 'Activity saved confirmation' })).toBeFocused()
    await expect(page.getByText('Completion: 1 of 3 activities', { exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Back to Waypoint results' }).click()
    await expect(
      page.getByRole('alert').filter({ hasText: 'The Waypoint you opened no longer matches these filters.' }),
    ).toBeFocused()
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(page.locator('a[href="/waypoints/place-19"]')).toContainText('Completion: 1 of 3 activities')
    await expect(page.locator('a[href="/waypoints/place-19"]')).toContainText('Highest recorded award: Bronze')
    expect(fixture.writes()).toBe(1)
  })

  test('Demo local remains browsable and read-only through a keyboard return', async ({ page }) => {
    const fixture = await isolate(page, 'viewer', 'demo-local')
    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto('/waypoints')
    const selected = page.locator('.MuiCardActionArea-root').first()
    await expect(selected).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add waypoint' })).toHaveCount(0)
    await selected.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Log activity' })).toHaveCount(0)
    const back = page.getByRole('link', { name: 'Back to Waypoint results' })
    await page.keyboard.press('Tab')
    for (let count = 0; count < 30 && !(await back.evaluate((node) => node === document.activeElement)); count++)
      await page.keyboard.press('Tab')
    await expect(back).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(selected).toBeFocused()
    await noOverflow(page)
    expect(fixture.writes()).toBe(0)
  })

  test('a modified new-tab visit has no borrowed list origin', async ({ page, context }) => {
    const fixture = await isolate(page)
    await page.goto('/waypoints?challenge=award')
    await page.getByLabel('Search waypoints').fill('Garden')
    const popupPromise = context.waitForEvent('page')
    await page.locator('a[href="/waypoints/place-19"]').click({ modifiers: ['ControlOrMeta'] })
    const popup = await popupPromise
    try {
      await popup.waitForLoadState('domcontentloaded')
      await expect(popup.getByRole('heading', { name: title, exact: true, level: 1 })).toBeVisible()
      await expect(popup.getByRole('link', { name: 'Back to Waypoint results' })).toHaveCount(0)
      await expect(page.getByLabel('Search waypoints')).toHaveValue('Garden')
    } finally {
      await popup.close()
    }
    expect(fixture.writes()).toBe(0)
  })
})
