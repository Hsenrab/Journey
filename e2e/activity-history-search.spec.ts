import { expect, test, type Page } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { createActivity, createIdea, DataSchema, type WaypointsData } from '../src/domain/visit'

function historyData(): WaypointsData {
  return DataSchema.parse({
    challenges: [
      {
        challengeId: 'award',
        title: 'Award history',
        description: 'Fictional',
        supportsActivityCategories: true,
        awardDescriptions: { bronze: 'Afternoon', silver: 'Full day', gold: 'Overnight' },
      },
      {
        challengeId: 'ordinary',
        title: 'Ordinary history',
        description: 'Fictional',
        supportsActivityCategories: false,
      },
      { challengeId: 'empty', title: 'Empty history', description: 'Fictional', supportsActivityCategories: false },
    ],
    waypoints: [
      {
        waypointId: 'award-place',
        title: 'Botanical destination',
        description: 'Excluded description',
        category: 'Garden',
        tags: [],
        challengeIds: ['award'],
        completion: { mode: 'once' },
        referenceIds: [],
        photoReferenceIds: [],
      },
      {
        waypointId: 'ordinary-place',
        title: 'Riverside destination',
        description: 'Excluded description',
        category: 'Walk',
        tags: [],
        challengeIds: ['ordinary'],
        completion: { mode: 'once' },
        referenceIds: [],
        photoReferenceIds: [],
      },
      {
        waypointId: 'long-place',
        title: 'UnbrokenDestination'.repeat(12),
        description: 'Excluded description',
        category: 'Walk',
        tags: [],
        challengeIds: ['ordinary'],
        completion: { mode: 'once' },
        referenceIds: [],
        photoReferenceIds: [],
      },
    ],
    activities: Array.from({ length: 30 }, (_, index) =>
      createActivity({
        activityId: `experience-${index}`,
        name:
          index < 2
            ? 'Morning walk'
            : index === 3
              ? 'Garden outside scope'
              : index === 29
                ? 'UnbrokenExperience'.repeat(12)
                : `Experience ${index}`,
        notes:
          index === 0
            ? `${'x'.repeat(150)} botanical garden`
            : index === 1
              ? 'Garden in the afternoon'
              : index === 29
                ? 'UnbrokenNotes'.repeat(12)
                : `Saved notes ${index}`,
        waypointId:
          index < 2 ? 'award-place' : index === 2 ? 'ordinary-place' : index === 29 ? 'long-place' : undefined,
        category: index === 0 ? 'bronze' : index === 1 ? 'gold' : undefined,
        date: index < 2 ? '2026-08-01' : `2026-08-${String((index % 28) + 1).padStart(2, '0')}`,
        location:
          index === 0
            ? { kind: 'postcode', postcode: 'GL1 1AA', latitude: 51.987654, longitude: -2 }
            : { kind: 'coordinates', latitude: 51, longitude: -2 },
        ideaIds: index === 0 ? ['idea-1', 'idea-2'] : [],
        referenceIds: index === 0 ? ['r2', 'r1'] : [],
        photoReferenceIds: index === 0 ? ['p2', 'p1'] : [],
        recordedTrack:
          index === 0
            ? {
                type: 'MultiLineString',
                coordinates: [
                  [
                    [-2, 51],
                    [-2.01, 51.01],
                  ],
                ],
              }
            : undefined,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: `2026-08-${index === 1 ? '02' : '01'}T00:00:00.000Z`,
      }),
    ),
    ideas: ['idea-1', 'idea-2'].map((ideaId) =>
      createIdea({
        ideaId,
        title: `Excluded ${ideaId}`,
        planningState: 'active',
        difficulty: 1,
        waypointIds: ['award-place'],
      }),
    ),
    references: [
      { referenceId: 'r1', title: 'First reference', url: 'https://evidence.invalid/first' },
      { referenceId: 'r2', title: 'Second reference', url: 'https://evidence.invalid/second' },
    ],
    photoReferences: [
      { photoReferenceId: 'p1', title: 'First photo', url: 'https://evidence.invalid/first.png' },
      { photoReferenceId: 'p2', title: 'Broken photo', url: 'https://evidence.invalid/broken.png' },
    ],
  })
}

async function isolate(page: Page, role: 'admin' | 'viewer' = 'admin', mode = 'demo-cosmos') {
  let data = historyData()
  let reads = 0
  let writes = 0
  let evidence = 0
  let failed = false
  let conflict = false
  let heldRead: Promise<void> | undefined
  let heldWrite: Promise<void> | undefined
  await page.addInitScript((selected) => {
    localStorage.clear()
    localStorage.setItem('journey-data-mode-v1', selected)
  }, mode)
  await page.context().route('**/api/**', async (route) => {
    expect(route.request().url()).toMatch(/\/api\/journey\/(demo|production)$/)
    const method = route.request().method()
    if (method === 'GET') {
      reads++
      if (heldRead) await heldRead
    } else {
      expect(role).toBe('admin')
      writes++
      if (heldWrite) await heldWrite
      if (conflict) {
        await route.fulfill({ status: 409, json: { error: 'conflict' } })
        return
      }
      const body = route.request().postDataJSON()
      if (method === 'DELETE') {
        expect(body.operation).toBe('delete')
        expect(body.type).toBe('activity')
        data = DataSchema.parse({ ...data, activities: data.activities.filter((item) => item.activityId !== body.id) })
      } else {
        expect(method).toBe('POST')
        expect(body.operation).toBe('replace')
        data = DataSchema.parse(body.data)
      }
    }
    if (failed) await route.fulfill({ status: 503, json: { error: 'Specific history load failure' } })
    else
      await route.fulfill({
        json: {
          data,
          role,
          etags: Object.fromEntries(data.activities.map((item) => [item.activityId, '"fixture"'])),
        },
      })
  })
  await page.context().route('https://evidence.invalid/**', async (route) => {
    evidence++
    if (route.request().url().endsWith('broken.png')) await route.abort()
    else
      await route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
          'base64',
        ),
      })
  })
  return {
    counts: () => ({ reads, writes, evidence }),
    data: () => structuredClone(data),
    replace: (value: WaypointsData) => {
      data = DataSchema.parse(value)
    },
    fail: (value: boolean) => {
      failed = value
    },
    conflict: (value: boolean) => {
      conflict = value
    },
    holdRead: (value: Promise<void> | undefined) => {
      heldRead = value
    },
    holdWrite: (value: Promise<void> | undefined) => {
      heldWrite = value
    },
  }
}

async function ids(page: Page) {
  return page
    .locator('a.MuiCardActionArea-root')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')!.split('/').pop()))
}

async function choose(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

async function keyboardFocus(page: Page, locator: ReturnType<Page['getByRole']>) {
  for (let count = 0; count < 80; count++) {
    if (await locator.evaluate((node) => node === document.activeElement)) return
    await page.keyboard.press('Tab')
  }
  await expect(locator).toBeFocused()
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
    true,
  )
  const widths = await page
    .locator('a.MuiCardActionArea-root .MuiTypography-root')
    .evaluateAll((nodes) => nodes.map((node) => ({ width: node.clientWidth, content: node.scrollWidth })))
  for (const size of widths) expect(size.content).toBeLessThanOrEqual(size.width)
}

async function measure(page: Page, query: string, expected: string[], clear = false) {
  return page.getByLabel('Search activities').evaluate(
    async (input, options) => {
      if (!(input instanceof HTMLInputElement)) throw new Error('Search is not an input.')
      return new Promise<number>((resolve, reject) => {
        let started = 0
        const finish = () => {
          const found = [...document.querySelectorAll('a.MuiCardActionArea-root')].map((node) =>
            node.getAttribute('href')!.split('/').pop(),
          )
          const noMatch = `No activities match "${options.query.trim()}".`
          const correctFeedback =
            options.expected.length === 0
              ? document.body.textContent!.includes(noMatch)
              : !document.body.textContent!.includes('No activities match "')
          if (
            started &&
            input.value === options.query &&
            JSON.stringify(found) === JSON.stringify(options.expected) &&
            correctFeedback
          ) {
            const elapsed = performance.now() - started
            observer.disconnect()
            clearTimeout(timeout)
            resolve(elapsed)
          }
        }
        const observer = new MutationObserver(finish)
        observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true })
        const timeout = setTimeout(() => {
          observer.disconnect()
          reject(new Error('Correct Activity IDs/feedback did not settle within 1,000 ms.'))
        }, 1000)
        if (options.clear) {
          const button = [...document.querySelectorAll('button')].find(
            (node) => node.getAttribute('aria-label') === 'Clear search' || node.textContent?.trim() === 'Clear search',
          )
          if (!button) throw new Error('Clear search action is missing.')
          button.addEventListener(
            'click',
            () => {
              started = performance.now()
            },
            { once: true },
          )
          button.click()
        } else {
          input.addEventListener(
            'input',
            () => {
              started = performance.now()
            },
            { once: true },
          )
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, options.query)
          input.dispatchEvent(new Event('input', { bubbles: true }))
        }
        finish()
      })
    },
    { query, expected, clear },
  )
}

test.describe('Activity history search', () => {
  for (const width of [360, 1280]) {
    for (const role of ['admin', 'viewer'] as const) {
      test(`${width}px ${role}: keyboard, exact IDs, wrapping and measured feedback`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 })
        const fixture = await isolate(page, role)
        await page.goto('/activities')
        const input = page.getByLabel('Search activities')
        await expect(input).toBeVisible()
        await expect(page.locator('a.MuiCardActionArea-root')).toHaveCount(30)
        const initial = await ids(page)
        const before = fixture.counts()
        if (width === 1280)
          expect((await page.locator('a.MuiCardActionArea-root').first().boundingBox())!.y).toBeLessThan(800)
        await keyboardFocus(page, input)
        await page.keyboard.type('garden walk')
        await expect(page.getByRole('link', { name: 'Morning walk' })).toHaveCount(2)
        expect(await ids(page)).toEqual(['experience-1', 'experience-0'])
        await page.keyboard.press('Tab')
        await expect(page.getByRole('button', { name: 'Clear search' })).toBeFocused()
        await expect
          .poll(() =>
            page.getByRole('button', { name: 'Clear search' }).evaluate((node) => getComputedStyle(node).outlineStyle),
          )
          .toBe('solid')
        await page.keyboard.press('Enter')
        await expect(input).toBeFocused()
        expect(await ids(page)).toEqual(initial)
        const matching = await measure(page, 'garden walk', ['experience-1', 'experience-0'])
        const noMatch = await measure(page, 'missing words', [])
        const clearing = await measure(page, '', initial, true)
        for (const elapsed of [matching, noMatch, clearing]) expect(elapsed).toBeLessThanOrEqual(1000)
        const latencyPath = test.info().outputPath('query-latency.json')
        await writeFile(latencyPath, JSON.stringify({ width, role, matching, noMatch, clearing }, null, 2))
        await test.info().attach('query-latency.json', { path: latencyPath, contentType: 'application/json' })
        await expect(input).toBeFocused()
        await page.keyboard.type('garden walk')
        const selected = page.locator('a[href="/activities/experience-1"]')
        await keyboardFocus(page, selected)
        await expect(selected).toBeFocused()
        await expect
          .poll(() =>
            selected
              .locator('.MuiCardActionArea-focusHighlight')
              .evaluate((node) => Number.parseFloat(getComputedStyle(node).opacity)),
          )
          .toBeGreaterThan(0)
        expect(fixture.counts()).toEqual(before)
        await page.keyboard.press('Enter')
        await expect(page).toHaveURL(/\/activities\/experience-1$/)
        await expect(page.getByRole('heading', { name: 'Morning walk', level: 1 })).toBeVisible()
        await expect(page.getByRole('link', { name: 'Botanical destination', exact: true })).toHaveAttribute(
          'href',
          '/waypoints/award-place',
        )
        if (role === 'viewer') await expect(page.getByRole('button', { name: 'Edit activity' })).toHaveCount(0)
        await page.goBack()
        await expect(input).toHaveValue('')
        await page.goForward()
        await page.goBack()
        await expect(input).toHaveValue('')
        await input.fill('unbroken')
        await expect(page.locator('a.MuiCardActionArea-root')).toHaveCount(1)
        await noOverflow(page)
        await keyboardFocus(page, page.getByRole('button', { name: 'Clear search' }))
        await expect
          .poll(() =>
            page.getByRole('button', { name: 'Clear search' }).evaluate((node) => getComputedStyle(node).outlineStyle),
          )
          .toBe('solid')
        await page.screenshot({ path: test.info().outputPath(`search-${width}-${role}.png`) })
        await input.fill('UnbrokenQuery'.repeat(30))
        const feedback = page.getByText(`No activities match "${'UnbrokenQuery'.repeat(30)}".`)
        await expect(feedback).toBeVisible()
        expect(await feedback.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
        await noOverflow(page)
        await page.reload()
        await expect(input).toHaveValue('')
      })
    }
  }

  test('four fields, all-word rules, excluded text and scopes retain exact identities', async ({ page }) => {
    const fixture = await isolate(page)
    await page.goto('/activities?challenge=award')
    const input = page.getByLabel('Search activities')
    for (const query of ['walk garden', 'GARDEN WALK', 'botanical walk', 'garden garden walk']) {
      await input.fill(query)
      await expect(page.locator('a.MuiCardActionArea-root')).toHaveCount(2)
      expect(await ids(page)).toEqual(['experience-1', 'experience-0'])
    }
    await input.fill('GL1')
    expect(await ids(page)).toEqual(['experience-0'])
    await input.fill('51.00000')
    expect(await ids(page)).toEqual(['experience-1'])
    for (const query of ['Excluded idea', '51.987654', 'First reference', '*', '"garden"']) {
      await input.fill(query)
      await expect(page.getByText(`No activities match "${query}".`)).toBeVisible()
    }
    await input.fill('walk garden')
    await choose(page, 'Recorded award', 'Bronze')
    await expect.poll(() => ids(page)).toEqual(['experience-0'])
    await choose(page, 'Recorded award', 'Gold')
    await expect(input).toHaveValue('walk garden')
    await expect.poll(() => ids(page)).toEqual(['experience-1'])
    await choose(page, 'Recorded award', 'Silver')
    await expect(page.getByText('No activities in this scope.')).toBeVisible()
    await choose(page, 'Recorded award', 'All recorded awards')
    await page.getByRole('button', { name: 'Clear search' }).click()
    await expect(input).toBeFocused()
    await expect.poll(() => ids(page)).toEqual(['experience-1', 'experience-0'])
    expect(fixture.counts()).toEqual({ reads: 1, writes: 0, evidence: 0 })
  })

  for (const scope of ['empty', 'ordinary&award=gold', 'missing']) {
    test(`scope feedback stays truthful for ${scope}`, async ({ page }) => {
      await isolate(page)
      await page.goto(`/activities?challenge=${scope}`)
      if (scope === 'empty') {
        await page.getByLabel('Search activities').fill('absent')
        await expect(page.getByText('No activities in this scope.')).toBeVisible()
      } else {
        await expect(page.getByRole('alert')).toBeVisible()
        await expect(page.getByLabel('Search activities')).toHaveCount(0)
      }
      await expect(page.locator('a.MuiCardActionArea-root')).toHaveCount(0)
      await expect(page.getByText(/No activities match/)).toHaveCount(0)
    })
  }

  test('empty data and held loading do not become query no-match', async ({ page }) => {
    const fixture = await isolate(page)
    fixture.replace({ ...fixture.data(), activities: [] })
    let release!: () => void
    fixture.holdRead(
      new Promise<void>((resolve) => {
        release = resolve
      }),
    )
    await page.goto('/activities')
    await expect(page.getByText('Loading activities…')).toBeVisible()
    await expect(page.getByText('No activities logged yet.')).toHaveCount(0)
    release()
    await expect(page.getByText('No activities logged yet.')).toBeVisible()
    await page.getByLabel('Search activities').fill('absent')
    await expect(page.getByText('No activities logged yet.')).toBeVisible()
  })

  test('search opens ordered evidence and preserves supported edit/delete truth', async ({ page }) => {
    const fixture = await isolate(page)
    await page.goto('/activities')
    await page.getByLabel('Search activities').fill('GL1')
    await page.locator('a[href="/activities/experience-0"]').click()
    await expect(page.getByRole('button', { name: /Show photo 1: Broken photo/ })).toBeVisible()
    expect(await page.getByRole('heading', { name: /^(First|Second) reference$/ }).allTextContents()).toEqual([
      'Second reference',
      'First reference',
    ])
    await expect(page.getByRole('link', { name: 'View recorded track on map' })).toHaveAttribute(
      'href',
      '/map?activityId=experience-0',
    )
    await expect(page.getByRole('link', { name: 'Excluded idea-1', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Excluded idea-2', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Next photo', exact: true }).click()
    await expect(page.getByRole('img', { name: 'First photo', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Edit activity' }).click()
    await expect(page.getByLabel('Reference title').first()).toHaveValue('Second reference')
    await page.getByLabel('Activity title', { exact: true }).fill('Renamed saved experience')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Activity saved.')).toBeVisible()
    await page.goBack()
    await expect(page.getByLabel('Search activities')).toHaveValue('')
    await page.getByLabel('Search activities').fill('renamed')
    expect(await ids(page)).toEqual(['experience-0'])
    await page.locator('a[href="/activities/experience-0"]').click()
    await page.getByRole('button', { name: 'Delete activity', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page).toHaveURL(/\/waypoints\/award-place$/)
    await page.goto('/activities')
    await page.getByLabel('Search activities').fill('renamed')
    await expect(page.getByText('No activities match "renamed".')).toBeVisible()
    expect(fixture.data().activities.some((item) => item.activityId === 'experience-0')).toBe(false)
    expect(fixture.counts().writes).toBe(2)
  })

  test('failed drafts, same-mode reload, effective fallback and recovery stay distinct', async ({ page }) => {
    const fixture = await isolate(page)
    await page.goto('/activities')
    const input = page.getByLabel('Search activities')
    await input.fill('unsaved clue')
    await page.getByRole('button', { name: 'Add activity' }).click()
    await page.getByLabel('Activity title', { exact: true }).fill('unsaved clue')
    await choose(page, 'Location type', 'Latitude and longitude')
    await page.getByLabel('Latitude', { exact: true }).fill('51')
    await page.getByLabel('Longitude', { exact: true }).fill('-2')
    fixture.conflict(true)
    await page.getByRole('button', { name: 'Save activity' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Your data has changed in another session.' })).toBeVisible()
    await expect(page.getByLabel('Activity title', { exact: true })).toHaveValue('unsaved clue')
    await expect(page.getByText('No activities match "unsaved clue".')).toBeVisible()
    fixture.replace({
      ...fixture.data(),
      waypoints: fixture
        .data()
        .waypoints.map((item) =>
          item.waypointId === 'award-place' ? { ...item, title: 'Renamed destination' } : item,
        ),
    })
    await page.getByRole('button', { name: 'Reload latest' }).click()
    await expect(input).toHaveValue('unsaved clue')
    await input.fill('renamed walk')
    await expect(page.locator('a.MuiCardActionArea-root')).toHaveCount(2)
    await page.getByRole('button', { name: 'Add activity' }).click()
    await page.getByLabel('Activity title', { exact: true }).fill('Another failed draft')
    await choose(page, 'Location type', 'Latitude and longitude')
    await page.getByLabel('Latitude', { exact: true }).fill('51')
    await page.getByLabel('Longitude', { exact: true }).fill('-2')
    await page.getByRole('button', { name: 'Save activity' }).click()
    fixture.fail(true)
    await page.getByRole('button', { name: 'Reload latest' }).click()
    await expect(page.getByText(/Demo Cosmos could not be loaded/)).toBeVisible()
    await expect(input).toHaveValue('')
    await expect(page.getByRole('button', { name: 'Add activity' })).toHaveCount(0)
    await input.fill('local fallback query')
    fixture.fail(false)
    fixture.conflict(false)
    await page.getByRole('button', { name: 'Reload latest' }).click()
    await expect(input).toHaveValue('')
    await expect(page.locator('a.MuiCardActionArea-root')).toHaveCount(30)
    expect(fixture.data().activities.some((item) => item.name === 'unsaved clue')).toBe(false)
  })

  test('Add/Cancel, guarded navigation and selected modes preserve the agreed query lifetime', async ({ page }) => {
    const fixture = await isolate(page)
    await page.goto('/activities')
    const input = page.getByLabel('Search activities')
    await input.fill('garden walk')
    await page.getByRole('button', { name: 'Add activity' }).click()
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(input).toHaveValue('garden walk')
    await page.getByRole('button', { name: 'Add activity' }).click()
    await page.getByLabel('Activity title', { exact: true }).fill('Supported independent save')
    let dialogs = 0
    page.once('dialog', async (dialog) => {
      dialogs++
      await dialog.dismiss()
    })
    await page.getByRole('link', { name: 'Settings', exact: true }).first().click()
    await expect(input).toHaveValue('garden walk')
    await expect(page.getByLabel('Activity title', { exact: true })).toHaveValue('Supported independent save')
    expect(dialogs).toBe(1)
    await choose(page, 'Location type', 'Latitude and longitude')
    await page.getByLabel('Latitude', { exact: true }).fill('51')
    await page.getByLabel('Longitude', { exact: true }).fill('-2')
    let release!: () => void
    fixture.holdWrite(
      new Promise<void>((resolve) => {
        release = resolve
      }),
    )
    await page.getByRole('button', { name: 'Save activity' }).click()
    await expect.poll(() => fixture.counts().writes).toBe(1)
    await page.getByRole('link', { name: 'Settings', exact: true }).first().click()
    await expect(input).toHaveValue('garden walk')
    release()
    await expect(page.getByText('Activity saved.')).toBeVisible()
    await expect(input).toHaveValue('garden walk')
    expect(await ids(page)).toEqual(['experience-1', 'experience-0'])
    await page.getByRole('link', { name: 'Settings', exact: true }).first().click()
    await choose(page, 'Data mode', 'Demo local data')
    await page.getByRole('link', { name: 'Activities', exact: true }).first().click()
    await expect(input).toHaveValue('')
    await input.fill('local query')
    await page.getByRole('link', { name: 'Settings', exact: true }).first().click()
    await choose(page, 'Data mode', 'Demo Cosmos data')
    await page.getByRole('link', { name: 'Activities', exact: true }).first().click()
    await expect(input).toHaveValue('')
    await expect(page.locator('a.MuiCardActionArea-root')).toHaveCount(31)
  })

  for (const width of [360, 1280]) {
    test(`${width}px Demo local supports keyboard search without editing`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      const fixture = await isolate(page, 'viewer', 'demo-local')
      await page.goto('/activities')
      const input = page.getByLabel('Search activities')
      await expect(input).toBeVisible()
      await expect(page.getByRole('button', { name: 'Add activity' })).toHaveCount(0)
      await expect(page.getByText(/Demo local data is bundled sample data/)).toBeVisible()
      await keyboardFocus(page, input)
      await page.keyboard.type('missing experience')
      await keyboardFocus(page, page.getByRole('button', { name: 'Clear search' }))
      await page.keyboard.press('Enter')
      await expect(input).toBeFocused()
      await noOverflow(page)
      expect(fixture.counts()).toEqual({ reads: 0, writes: 0, evidence: 0 })
    })
  }
})
