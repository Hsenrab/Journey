import { expect, test, type Page } from '@playwright/test'
import { DataSchema, type WaypointsData } from '../src/domain/visit'

async function isolate(
  page: Page,
  mode: 'production' | 'demo-cosmos' | 'demo-local' = 'demo-cosmos',
  role: 'admin' | 'viewer' = 'admin',
) {
  let data: WaypointsData = {
    challenges: [
      {
        challengeId: 'draft-challenge',
        title: 'Draft challenge',
        description: 'Fictional draft protection fixture',
        supportsActivityCategories: false,
      },
    ],
    waypoints: [
      {
        waypointId: 'draft-waypoint',
        title: 'Saved fixture waypoint',
        description: 'Saved fixture description',
        category: 'Walk',
        tags: ['fixture'],
        challengeIds: ['draft-challenge'],
        completion: { mode: 'count', target: 2 },
        referenceIds: ['guide-second', 'guide-first'],
        photoReferenceIds: ['photo-second', 'photo-first'],
      },
    ],
    activities: [],
    ideas: [],
    references: [
      { referenceId: 'guide-second', title: 'Second guide first', url: 'https://example.com/second' },
      { referenceId: 'guide-first', title: 'First guide second', url: 'https://example.com/first' },
    ],
    photoReferences: [
      {
        photoReferenceId: 'photo-second',
        title: 'Second photo first',
        url: 'https://example.com/second.jpg',
        altText: 'Second',
      },
      {
        photoReferenceId: 'photo-first',
        title: 'First photo second',
        url: 'https://example.com/first.jpg',
        altText: 'First',
      },
    ],
  }
  let writes = 0
  let fail = false
  let pending: Promise<void> | undefined
  await page.addInitScript(
    ({ selectedMode, fixture }) => {
      localStorage.clear()
      localStorage.setItem('journey-data-mode-v1', selectedMode)
      if (selectedMode === 'production') localStorage.setItem('waypoints-v1', JSON.stringify(fixture))
    },
    { selectedMode: mode, fixture: data },
  )
  await page.route('https://example.com/**', (route) => route.abort())
  await page.route('**/api/**', async (route) => {
    expect(route.request().url()).toContain('/api/journey/demo')
    if (route.request().method() === 'POST') {
      expect(role).toBe('admin')
      writes++
      if (pending) await pending
      if (fail) {
        await route.fulfill({ status: 400, json: { error: 'Deliberate Waypoint save failure' } })
        return
      }
      const body = route.request().postDataJSON()
      expect(body.operation).toBe('replace')
      data = DataSchema.parse(body.data)
    } else {
      expect(route.request().method()).toBe('GET')
    }
    await route.fulfill({ json: { data, etags: {}, role } })
  })
  return {
    writes: () => writes,
    failSave: (value: boolean) => {
      fail = value
    },
    holdSave: (value: Promise<void> | undefined) => {
      pending = value
    },
    data: async () => {
      if (mode !== 'production') return structuredClone(data)
      const stored = await page.evaluate(() => localStorage.getItem('waypoints-v1'))
      expect(stored).not.toBeNull()
      return DataSchema.parse(JSON.parse(stored!))
    },
  }
}

for (const width of [360, 1280]) {
  for (const mode of ['production', 'demo-cosmos'] as const) {
    test(`${width}px ${mode} unchanged, declined and confirmed Waypoint Cancel preserves data and context`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 })
      const fixture = await isolate(page, mode)
      const dialogs: string[] = []
      let discard = false
      page.on('dialog', async (dialog) => {
        dialogs.push(dialog.message())
        expect(dialog.message()).toBe('You have unsaved Waypoint changes. Discard them?')
        if (discard) await dialog.accept()
        else await dialog.dismiss()
      })
      await page.goto('/waypoints?challenge=draft-challenge')
      const before = await fixture.data()
      await page.getByRole('button', { name: 'Add waypoint', exact: true }).click()
      await page.getByRole('button', { name: 'Cancel', exact: true }).click()
      expect(dialogs).toHaveLength(0)
      await expect(page).toHaveURL(/\/waypoints\?challenge=draft-challenge$/)
      await page.getByRole('button', { name: 'Add waypoint', exact: true }).click()
      await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Abandoned add')
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await page.getByRole('tab', { name: 'Paste JSON' }).click()
      await page.getByLabel('Waypoint JSON', { exact: true }).fill('{invalid')
      await page.getByRole('button', { name: 'Load into form', exact: true }).click()
      const cancel = page.getByRole('button', { name: 'Cancel', exact: true })
      await cancel.focus()
      await cancel.press('Enter')
      expect(dialogs).toHaveLength(1)
      await expect(cancel).toBeFocused()
      await expect(page.getByRole('tab', { name: 'Paste JSON' })).toHaveAttribute('aria-selected', 'true')
      await expect(page.getByLabel('Waypoint JSON', { exact: true })).toHaveValue('{invalid')
      await expect(page.getByText('Invalid JSON. Paste a valid JSON object.', { exact: true })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await page.getByRole('tab', { name: 'Form', exact: true }).click()
      await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('Abandoned add')
      discard = true
      await cancel.click()
      expect(dialogs).toHaveLength(2)
      await expect(page).toHaveURL(/\/waypoints\?challenge=draft-challenge$/)
      await page.getByRole('button', { name: 'Add waypoint', exact: true }).click()
      await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('')
      await page.getByRole('tab', { name: 'Paste JSON' }).click()
      await expect(page.getByLabel('Waypoint JSON', { exact: true })).toHaveValue('')
      await cancel.click()
      expect(dialogs).toHaveLength(2)
      await page.locator('main a[href="/waypoints/draft-waypoint"]').click()
      await page.getByRole('button', { name: 'Edit waypoint', exact: true }).click()
      const titles = page.getByRole('textbox', { name: 'Title', exact: true })
      await titles.first().fill('Abandoned edit')
      const titleValues = async () => Promise.all((await titles.all()).map((title) => title.inputValue()))
      const retained = await titleValues()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await page.getByRole('tab', { name: 'Paste JSON' }).click()
      await expect(page.getByLabel('Waypoint JSON', { exact: true })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await page.getByRole('tab', { name: 'Form', exact: true }).click()
      discard = false
      await cancel.click()
      expect(dialogs).toHaveLength(3)
      expect(await titleValues()).toEqual(retained)
      discard = true
      await cancel.click()
      expect(dialogs).toHaveLength(4)
      await expect(page).toHaveURL(/\/waypoints\/draft-waypoint$/)
      await page.getByRole('button', { name: 'Edit waypoint', exact: true }).click()
      await expect(titles.first()).toHaveValue('Saved fixture waypoint')
      await titles.first().fill('Temporary edit')
      await titles.first().fill('Saved fixture waypoint')
      await cancel.click()
      expect(dialogs).toHaveLength(4)
      expect(await fixture.data()).toEqual(before)
      expect(fixture.writes()).toBe(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    })
  }

  for (const origin of ['add', 'edit'] as const) {
    test(`${width}px ${origin} pending save blocks Cancel, retains a failure and allows successful retry`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 })
      const fixture = await isolate(page)
      let dialogs = 0
      page.on('dialog', async (dialog) => {
        dialogs++
        expect(dialog.message()).toBe('You have unsaved Waypoint changes. Discard them?')
        await dialog.dismiss()
      })
      await page.goto(origin === 'add' ? '/waypoints?mode=add' : '/waypoints/draft-waypoint')
      if (origin === 'edit') await page.getByRole('button', { name: 'Edit waypoint', exact: true }).click()
      await page.getByRole('textbox', { name: 'Title', exact: true }).first().fill('Retained pending draft')
      if (origin === 'add') {
        await page.getByRole('textbox', { name: 'Description', exact: true }).fill('Fictional draft')
        await page.getByRole('textbox', { name: 'Category', exact: true }).fill('Walk')
      }
      let finish!: () => void
      fixture.holdSave(
        new Promise<void>((resolve) => {
          finish = resolve
        }),
      )
      fixture.failSave(true)
      try {
        await page.getByRole('button', { name: 'Save waypoint', exact: true }).click()
        const cancel = page.getByRole('button', { name: 'Cancel', exact: true })
        await expect(cancel).toBeDisabled()
        await expect(page.getByRole('textbox', { name: 'Title', exact: true }).first()).toBeDisabled()
        await expect(page.getByRole('button', { name: 'Saving...', exact: true })).toBeDisabled()
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
        await cancel.evaluate((button) => {
          button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
          button.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
        })
        await expect.poll(fixture.writes).toBe(1)
        expect(dialogs).toBe(0)
        finish()
        await expect(page.getByText(/Deliberate Waypoint save failure/)).toBeVisible()
        await expect(cancel).toBeEnabled()
        await expect(page.getByRole('textbox', { name: 'Title', exact: true }).first()).toHaveValue(
          'Retained pending draft',
        )
        await cancel.click()
        expect(dialogs).toBe(1)
        await expect(page.getByText(/Deliberate Waypoint save failure/)).toBeVisible()
        expect(fixture.writes()).toBe(1)
        fixture.failSave(false)
        fixture.holdSave(undefined)
        await page.getByRole('button', { name: 'Save waypoint', exact: true }).click()
        await expect(page.getByText('Waypoint saved.', { exact: true })).toBeVisible()
        await expect(cancel).toHaveCount(0)
        expect(fixture.writes()).toBe(2)
        expect((await fixture.data()).waypoints.some((waypoint) => waypoint.title === 'Retained pending draft')).toBe(
          true,
        )
      } finally {
        finish()
      }
    })
  }

  for (const mode of ['demo-cosmos', 'demo-local'] as const) {
    test(`${width}px ${mode} read-only browsing cannot open an editor from a direct add URL`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      const fixture = await isolate(page, mode, 'viewer')
      await page.goto('/waypoints?mode=add')
      await expect(page.getByRole('link', { name: 'Change the data mode in Settings' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Save waypoint', exact: true })).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Add waypoint', exact: true })).toHaveCount(0)
      await page.locator('main a[href^="/waypoints/"]').first().click()
      await expect(page.getByRole('button', { name: 'Edit waypoint', exact: true })).toHaveCount(0)
      expect(fixture.writes()).toBe(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    })
  }
}
