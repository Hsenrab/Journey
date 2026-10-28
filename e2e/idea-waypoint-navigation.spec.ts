import { expect, test, type Locator, type Page } from '@playwright/test'
import { createDemoData, DataSchema, type WaypointsData } from '../src/domain/visit'

const destinationTitle = `Shared destination through the woods ${'UnbrokenDestination'.repeat(10)}`

function navigationData(): WaypointsData {
  return {
    challenges: [],
    waypoints: ['first', 'second', 'elsewhere'].map((waypointId) => ({
      waypointId,
      title: waypointId === 'elsewhere' ? 'Other destination' : destinationTitle,
      description: 'Fictional destination',
      category: 'Walk',
      tags: [],
      challengeIds: [],
      completion: { mode: 'once' },
      location: { latitude: 51, longitude: -2 },
      referenceIds: [],
      photoReferenceIds: [],
    })),
    ideas: [
      {
        ideaId: 'navigation-idea',
        title: 'Destination planning idea',
        description: 'Fictional inspiration',
        notes: '',
        waypointIds: ['second', 'first'],
        planningState: 'someday',
        difficulty: 1,
        referenceIds: [],
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
      },
    ],
    activities: ['elsewhere', undefined].map((waypointId, index) => ({
      activityId: `usage-${index}`,
      name: `Recorded experience ${index}`,
      waypointId,
      ideaIds: ['navigation-idea'],
      date: '2026-08-05',
      location: { kind: 'coordinates', latitude: 51, longitude: -2 },
      notes: '',
      referenceIds: [],
      photoReferenceIds: [],
      createdAt: '2026-08-05T00:00:00Z',
      updatedAt: '2026-08-05T00:00:00Z',
    })),
    references: [],
    photoReferences: [],
  }
}

async function isolate(
  page: Page,
  role: 'admin' | 'viewer' = 'admin',
  mode: 'demo-cosmos' | 'demo-local' = 'demo-cosmos',
) {
  let data = navigationData()
  let writes = 0
  let fail = false
  let pending: Promise<void> | undefined
  await page.addInitScript((selectedMode) => {
    localStorage.clear()
    localStorage.setItem('journey-data-mode-v1', selectedMode)
  }, mode)
  await page.route('**/api/**', async (route) => {
    expect(mode).toBe('demo-cosmos')
    expect(route.request().url()).toContain('/api/journey/demo')
    if (route.request().method() === 'POST') {
      expect(role).toBe('admin')
      writes++
      if (pending) await pending
      if (fail) {
        await route.fulfill({ status: 400, json: { error: 'Deliberate Idea save failure' } })
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
    data: () => structuredClone(data),
    replace: (replacement: WaypointsData) => {
      data = DataSchema.parse(replacement)
    },
    writes: () => writes,
    failSave: (value: boolean) => {
      fail = value
    },
    holdSave: (value: Promise<void> | undefined) => {
      pending = value
    },
  }
}

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  )
}

async function tabTo(page: Page, link: Locator) {
  for (let count = 0; count < 40; count++) {
    await page.keyboard.press('Tab')
    if (await link.evaluate((element) => element === document.activeElement)) break
  }
  await expect(link).toBeFocused()
  expect(
    await link.evaluate((element) => {
      const style = getComputedStyle(element)
      return (style.outlineStyle !== 'none' && style.outlineWidth !== '0px') || style.boxShadow !== 'none'
    }),
  ).toBe(true)
}

test.describe('Idea-to-Waypoint navigation', () => {
  for (const width of [360, 1280]) {
    for (const role of ['admin', 'viewer'] as const) {
      test(`${width}px ${role} browses destinations and usage without writing`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 })
        const fixture = await isolate(page, role)
        const before = fixture.data()
        await page.goto('/ideas/navigation-idea')
        await expect(page.getByRole('heading', { name: 'Destination planning idea', level: 1 })).toBeVisible()
        const section = page.getByRole('region', { name: 'Linked waypoints' })
        const links = section.getByRole('link')
        await expect(links).toHaveText([destinationTitle, destinationTitle])
        await expect(links.nth(0)).toHaveAttribute('href', '/waypoints/second')
        await expect(links.nth(1)).toHaveAttribute('href', '/waypoints/first')
        await expect(page.getByText('Linked waypoints are planning associations.')).toBeVisible()
        await expect(page.getByText('Usage counts activities that explicitly used this idea.')).toBeVisible()
        await expect(page.getByText('Used in 2 activities')).toBeVisible()
        await expect(page.getByText('Planning state: Someday')).toBeVisible()
        await expect(section.getByRole('link', { name: 'Other destination', exact: true })).toHaveCount(0)
        if (role === 'viewer') {
          await expect(page.getByText(/Your Journey access is viewer only/)).toBeVisible()
          await expect(page.getByRole('button', { name: 'Edit idea' })).toHaveCount(0)
          await expect(page.getByRole('button', { name: 'Delete idea' })).toHaveCount(0)
          await expect(page.getByRole('link', { name: 'Log activity from this idea' })).toHaveCount(0)
        } else {
          await expect(page.getByRole('link', { name: 'Log activity from this idea' })).toHaveAttribute(
            'href',
            '/activities?mode=add&idea=navigation-idea',
          )
        }
        await expectNoOverflow(page)
        await tabTo(page, links.nth(0))
        await page.screenshot({ path: test.info().outputPath('focused-destinations.png'), fullPage: true })
        await page.keyboard.press('Enter')
        await expect(page).toHaveURL(/\/waypoints\/second$/)
        await page.goBack()
        await links.nth(1).click()
        await expect(page).toHaveURL(/\/waypoints\/first$/)
        await page.goBack()
        await page.getByRole('link', { name: 'View activity', exact: true }).nth(0).click()
        await expect(page).toHaveURL(/\/activities\/usage-0$/)
        await page.goBack()
        await expect(page.getByText('Used in 2 activities')).toBeVisible()
        expect(fixture.writes()).toBe(0)
        expect(fixture.data()).toEqual(before)
      })
    }

    test(`${width}px admin retains plain names through editing, failure and retry`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      const fixture = await isolate(page)
      await page.goto('/ideas/navigation-idea')
      await page.getByRole('button', { name: 'Edit idea' }).click()
      const section = page.getByRole('region', { name: 'Linked waypoints' })
      await expect(section.getByRole('link')).toHaveCount(0)
      await expect(section.getByText(destinationTitle, { exact: true })).toHaveCount(2)
      await page.getByLabel('Title', { exact: true }).fill('Retained idea draft')
      await expectNoOverflow(page)
      page.once('dialog', async (dialog) => {
        expect(dialog.message()).toBe('You have unsaved changes. Leave this page?')
        await dialog.dismiss()
      })
      await page.getByRole('button', { name: 'Cancel', exact: true }).click()
      await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Retained idea draft')
      await expect(section.getByRole('link')).toHaveCount(0)
      expect(fixture.writes()).toBe(0)
      page.once('dialog', async (dialog) => {
        await dialog.accept()
      })
      await page.getByRole('button', { name: 'Cancel', exact: true }).click()
      await expect(section.getByRole('link')).toHaveCount(2)
      await page.getByRole('button', { name: 'Edit idea' }).click()
      await page.getByLabel('Title', { exact: true }).fill('Saved idea draft')
      const selection = page.getByRole('combobox', { name: 'Linked waypoints' })
      await selection.click()
      await selection.press('Backspace')
      await selection.press('Escape')
      let release: (() => void) | undefined
      fixture.holdSave(
        new Promise<void>((resolve) => {
          release = resolve
        }),
      )
      fixture.failSave(true)
      await page.getByRole('button', { name: 'Save changes', exact: true }).click()
      await expect.poll(() => fixture.writes()).toBe(1)
      await expect(section.getByRole('link')).toHaveCount(0)
      await expectNoOverflow(page)
      release!()
      await expect(page.getByRole('alert').filter({ hasText: 'Deliberate Idea save failure' })).toBeVisible()
      await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Saved idea draft')
      await expect(section.getByRole('link')).toHaveCount(0)
      await expectNoOverflow(page)
      await section.scrollIntoViewIfNeeded()
      await page.screenshot({ path: test.info().outputPath('editing-destinations.png'), fullPage: true })
      fixture.holdSave(undefined)
      fixture.failSave(false)
      await page.getByRole('button', { name: 'Save changes', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Edit idea' })).toBeVisible()
      await expect(section.getByRole('link')).toHaveCount(1)
      await expect(section.getByRole('link')).toHaveAttribute('href', '/waypoints/first')
      await expect(page.getByRole('link', { name: 'Log activity from this idea' })).toHaveAttribute(
        'href',
        '/activities?mode=add&idea=navigation-idea&waypoint=first',
      )
      expect(fixture.data().ideas[0]!.waypointIds).toEqual(['first'])
      expect(fixture.writes()).toBe(2)
    })

    test(`${width}px standalone, single destination and removed records remain explicit`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      const fixture = await isolate(page)
      const data = fixture.data()
      data.ideas[0]!.waypointIds = []
      data.activities = []
      fixture.replace(data)
      await page.goto('/ideas/navigation-idea')
      const section = page.getByRole('region', { name: 'Linked waypoints' })
      await expect(section.getByText('No waypoints linked to this idea.')).toBeVisible()
      await expect(section.getByRole('link')).toHaveCount(0)
      await expect(page.getByText('Not used', { exact: true })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Log activity from this idea' })).toHaveAttribute(
        'href',
        '/activities?mode=add&idea=navigation-idea',
      )
      data.ideas[0]!.waypointIds = ['first']
      fixture.replace(data)
      await page.reload()
      await expect(section.getByRole('link')).toHaveCount(1)
      await section.getByRole('link').click()
      await expect(page).toHaveURL(/\/waypoints\/first$/)
      data.waypoints = data.waypoints.filter((waypoint) => waypoint.waypointId !== 'first')
      data.ideas[0]!.waypointIds = []
      fixture.replace(data)
      await page.reload()
      await expect(page.getByText('Waypoint not found.', { exact: true })).toBeVisible()
      data.ideas = []
      fixture.replace(data)
      await page.goto('/ideas/navigation-idea')
      await expect(page.getByText('Idea not found.', { exact: true })).toBeVisible()
      expect(fixture.writes()).toBe(0)
    })

    test(`${width}px Demo local destination browsing stays read-only`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      const fixture = await isolate(page, 'viewer', 'demo-local')
      const idea = createDemoData().ideas.find((item) => item.waypointIds.length > 0)!
      await page.goto(`/ideas/${idea.ideaId}`)
      await expect(page.getByText(/Demo local data is bundled sample data/)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Edit idea' })).toHaveCount(0)
      await expect(page.getByRole('link', { name: 'Log activity from this idea' })).toHaveCount(0)
      await expectNoOverflow(page)
      await page.getByRole('region', { name: 'Linked waypoints' }).getByRole('link').nth(0).click()
      await expect(page).toHaveURL(new RegExp(`/waypoints/${idea.waypointIds[0]}$`))
      expect(fixture.writes()).toBe(0)
    })
  }
})
