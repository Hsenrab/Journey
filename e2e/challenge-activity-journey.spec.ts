import { expect, test, type Page } from '@playwright/test'
import { createJourneyTestData } from '../src/test/demoData'
import { createActivity, createDemoData, type WaypointsData } from '../src/domain/visit'

async function isolate(page: Page, role: 'admin' | 'viewer' = 'admin', partial = false) {
  let data = createJourneyTestData(partial)
  let writes = 0
  let reads = 0
  let failure = false
  let failSave = false
  let holdSave: Promise<void> | undefined
  await page.clock.setFixedTime(new Date('2026-10-26T12:00:00Z'))
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('journey-data-mode-v1', 'demo-cosmos')
  })
  await page.route('**/api/maps/**', (route) =>
    route.fulfill({ status: 403, json: { error: 'Maps are excluded from isolated journey acceptance.' } }),
  )
  await page.route('**/api/journey/**', async (route) => {
    if (route.request().method() === 'GET') {
      reads++
      if (failure) {
        await route.fulfill({ status: 503, json: { error: 'Deliberate fixture load failure' } })
        return
      }
    } else {
      writes++
      expect(role).toBe('admin')
      if (holdSave) await holdSave
      if (failSave) {
        await route.fulfill({ status: 409, json: { error: 'conflict' } })
        return
      }
      const body = route.request().postDataJSON()
      if (body.operation === 'delete') {
        expect(['challenge', 'waypoint']).toContain(body.type)
        if (body.type === 'challenge') {
          data = {
            ...data,
            challenges: data.challenges.filter((item) => item.challengeId !== body.id),
            waypoints: data.waypoints.map((item) => ({
              ...item,
              challengeIds: item.challengeIds.filter((id) => id !== body.id),
            })),
            activities: data.activities.map((item) => ({
              ...item,
              challengeId: item.challengeId === body.id ? undefined : item.challengeId,
            })),
          }
        } else {
          data = {
            ...data,
            waypoints: data.waypoints.filter((item) => item.waypointId !== body.id),
            ideas: data.ideas.map((item) => ({
              ...item,
              waypointIds: item.waypointIds.filter((id) => id !== body.id),
            })),
            activities: data.activities.map((item) => ({
              ...item,
              waypointId: item.waypointId === body.id ? undefined : item.waypointId,
            })),
          }
        }
      } else {
        expect(body.operation).toBe('replace')
        data = body.data
      }
    }
    const etags = Object.fromEntries(
      [
        ...data.challenges.map((item) => item.challengeId),
        ...data.waypoints.map((item) => item.waypointId),
        ...data.activities.map((item) => item.activityId),
      ].map((id) => [id, `etag-${writes}`]),
    )
    await route.fulfill({ json: { data, etags, role } })
  })
  return {
    reads: () => reads,
    writes: () => writes,
    data: () => data,
    setData: (next: WaypointsData) => {
      data = next
    },
    failLoad: () => {
      failure = true
    },
    failSave: (value: boolean) => {
      failSave = value
    },
    holdSave: (pending: Promise<void>) => {
      holdSave = pending
    },
  }
}

async function record(page: Page, name = 'A new visit') {
  await page.getByRole('button', { name: 'Log activity', exact: true }).click()
  const title = page.getByRole('textbox', { name: 'Activity title', exact: true })
  await expect(title).toBeFocused()
  await title.fill(name)
  await page.getByRole('textbox', { name: 'Postcode', exact: true }).fill('GL1 1AA')
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  )
}

for (const width of [360, 1280]) {
  for (const role of ['admin', 'viewer'] as const) {
    for (const partial of [false, true]) {
      test(`${width}px ${role} ${partial ? 'partial' : 'zero'} Challenge journey`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 })
        const fixture = await isolate(page, role, partial)
        await page.goto('/challenges')
        const card = page.getByRole('link', { name: 'Discovery Challenge', exact: true })
        await expect(card).toContainText(partial ? '50% complete' : '0% complete')
        await card.click()
        await expect(
          page.getByText(`${partial ? 1 : 0} of 2 waypoints completed (${partial ? 50 : 0}%).`, { exact: true }),
        ).toBeVisible()
        await expect(page.getByText(/Completion percentage counts completed Waypoints/)).toBeVisible()
        await expect(
          page.getByRole('link', { name: `Continue with ${partial ? 'Counted' : 'First'} Waypoint` }),
        ).toBeVisible()
        const order = await page.evaluate(() => {
          const members = document.querySelector('[aria-label="Member progress"]')
          const route = document.querySelector('[aria-label="GPX route actions"]')
          return !route || Boolean(members && members.compareDocumentPosition(route) & Node.DOCUMENT_POSITION_FOLLOWING)
        })
        expect(order).toBe(true)
        await noOverflow(page)
        await page.getByRole('link', { name: 'View waypoint', exact: true }).nth(1).click()
        await expect(page.getByRole('link', { name: 'Back to Discovery Challenge', exact: true })).toBeVisible()
        if (role === 'admin') {
          await record(page)
          await page.getByRole('button', { name: 'Save activity', exact: true }).click()
          const confirmation = page.getByRole('status', { name: 'Activity saved confirmation' })
          await expect(confirmation).toBeFocused()
          await expect(confirmation).toBeInViewport()
          await expect(page).toHaveURL(/\/waypoints\/counted$/)
          expect(fixture.writes()).toBe(1)
          const reads = fixture.reads()
          await confirmation.getByRole('link', { name: 'Back to Discovery Challenge', exact: true }).click()
          await expect(
            page.getByText(partial ? '2 of 2 waypoints completed (100%).' : '0 of 2 waypoints completed (0%).', {
              exact: true,
            }),
          ).toBeVisible()
          await expect(page.getByText(`Completion: ${partial ? 3 : 1} of 3 activities`, { exact: true })).toBeVisible()
          if (partial) await expect(page.getByRole('link', { name: /^Continue with/ })).toHaveCount(0)
          await page.getByRole('link', { name: 'Back to Dashboard', exact: true }).click()
          await expect(page.getByRole('link', { name: 'Discovery Challenge', exact: true })).toContainText(
            partial ? '100% complete' : '0% complete',
          )
          expect(fixture.reads()).toBe(reads)
        } else {
          await expect(
            page.getByRole('button', { name: /Log activity|Edit waypoint|Delete waypoint|Save/ }),
          ).toHaveCount(0)
          await expect(page.getByRole('link', { name: 'Change the data mode in Settings', exact: true })).toBeVisible()
          await page.getByRole('link', { name: 'Back to Discovery Challenge', exact: true }).click()
          await expect(page.getByRole('group', { name: 'GPX route actions' })).toHaveCount(0)
          await page.getByRole('link', { name: 'Back to Dashboard', exact: true }).click()
          expect(fixture.writes()).toBe(0)
        }
        await noOverflow(page)
      })
    }
  }

  test(`${width}px shared origin, direct entry, reload and truthful reassignment`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    const fixture = await isolate(page)
    await page.goto('/challenges/shared')
    await page.getByRole('link', { name: 'View waypoint', exact: true }).first().click()
    await expect(page.getByRole('link', { name: 'Back to Another Challenge' })).toBeVisible()
    await record(page)
    await page.getByRole('combobox', { name: 'Linked waypoint', exact: true }).fill('Counted')
    await page.getByRole('option', { name: 'Counted Waypoint', exact: true }).click()
    await page.getByRole('button', { name: 'Save activity', exact: true }).click()
    const confirmation = page.getByRole('status', { name: 'Activity saved confirmation' })
    await expect(confirmation).toBeFocused()
    await expect(confirmation).toContainText('This Activity does not contribute to Another Challenge.')
    await confirmation.getByRole('link', { name: 'Back to Another Challenge' }).click()
    await expect(page.getByText('0 of 2 waypoints completed (0%).', { exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'View waypoint', exact: true }).first().click()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'First Waypoint', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: /^Back to .*Challenge$/ })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Waypoints', exact: true }).last()).toBeVisible()
    await page.goto('/waypoints/counted')
    await expect(page.getByRole('link', { name: /^Back to .*Challenge$/ })).toHaveCount(0)
    expect(fixture.writes()).toBe(1)
  })

  test(`${width}px long recording, correction and measured Save reach`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    const fixture = await isolate(page)
    fixture.data().waypoints[0]!.title = 'First Waypoint with a long readable name '.repeat(6).trim()
    fixture.data().waypoints[0]!.description = 'A long description to exercise recording entry. '.repeat(90)
    fixture.data().activities = Array.from({ length: 40 }, (_, index) =>
      createActivity({
        activityId: `history-${index}`,
        name: `Earlier visit ${index}`,
        waypointId: 'once',
        date: '2026-08-01',
        location: { kind: 'postcode', postcode: 'GL1 1AA' },
      }),
    )
    await page.goto('/challenges/journey')
    await page.getByRole('link', { name: 'View waypoint', exact: true }).first().click()
    await page.getByRole('button', { name: 'Log activity', exact: true }).click()
    const title = page.getByRole('textbox', { name: 'Activity title', exact: true })
    await expect(title).toBeFocused()
    await expect(title).toBeInViewport()
    await page.getByRole('button', { name: 'Save activity', exact: true }).click()
    await expect(title).toHaveAttribute('aria-invalid', 'true')
    await title.fill('Corrected title')
    await title.press('Tab')
    await expect(title).toHaveAttribute('aria-invalid', 'false')
    const postcode = page.getByRole('textbox', { name: 'Postcode', exact: true })
    await expect(postcode).toHaveAttribute('aria-invalid', 'true')
    await postcode.fill('GL1 1AA')
    await postcode.press('Tab')
    await expect(postcode).toHaveAttribute('aria-invalid', 'false')
    await postcode.scrollIntoViewIfNeeded()
    const start = await page.evaluate(() => window.scrollY)
    const save = page.getByRole('button', { name: 'Save activity', exact: true })
    await save.scrollIntoViewIfNeeded()
    const additionalScroll = (await page.evaluate(() => window.scrollY)) - start
    expect(additionalScroll).toBeLessThanOrEqual(800)
    console.info(`Ordinary Save reach at ${width}px: ${additionalScroll}px additional scroll`)
    const box = await save.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.y).toBeGreaterThanOrEqual(64)
    expect(box!.y + box!.height).toBeLessThanOrEqual(800)
    await expect(page.getByRole('button', { name: 'References (optional)', exact: true })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    await noOverflow(page)
    expect(fixture.writes()).toBe(0)
    await save.focus()
    await save.press('Enter')
    await expect(page.getByRole('status', { name: 'Activity saved confirmation' })).toBeFocused()
    await page.getByRole('button', { name: 'Log activity', exact: true }).click()
    await expect(title).toBeFocused()
    await title.fill('Cancel this draft')
    const cancel = page.getByRole('button', { name: 'Cancel', exact: true })
    await cancel.focus()
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toBe('You have unsaved changes. Leave this page?')
      return dialog.accept()
    })
    await cancel.press('Enter')
    await expect(title).toHaveCount(0)
    await expect(page.getByRole('status', { name: 'Activity saved confirmation' })).toHaveCount(0)
    expect(fixture.writes()).toBe(1)
  })

  test(`${width}px dirty, pending and conflict outcomes retain input`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    const fixture = await isolate(page)
    await page.goto('/challenges/journey')
    await page.getByRole('link', { name: 'View waypoint', exact: true }).first().click()
    await record(page, 'Retain this draft')
    page.once('dialog', (dialog) => dialog.dismiss())
    await page.getByRole('link', { name: 'Back to Discovery Challenge' }).click()
    await expect(page.getByRole('textbox', { name: 'Activity title', exact: true })).toHaveValue('Retain this draft')
    let release!: () => void
    fixture.holdSave(
      new Promise<void>((resolve) => {
        release = resolve
      }),
    )
    fixture.failSave(true)
    await page.getByRole('button', { name: 'Save activity', exact: true }).click()
    await expect(page.getByText('Saving...', { exact: true }).first()).toBeVisible()
    await page.getByRole('link', { name: 'Back to Discovery Challenge' }).click()
    await expect(page).toHaveURL(/\/waypoints\/once$/)
    expect(fixture.writes()).toBe(1)
    release()
    await expect(page.getByText('Your data has changed in another session.', { exact: true })).toBeVisible()
    await expect(page.getByRole('status', { name: 'Activity saved confirmation' })).toHaveCount(0)
    const title = page.getByRole('textbox', { name: 'Activity title', exact: true })
    await title.fill('Correcting does not save')
    await title.press('Tab')
    await expect(page.getByText('Your data has changed in another session.', { exact: true })).toBeVisible()
    expect(fixture.writes()).toBe(1)
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('link', { name: 'Back to Discovery Challenge' }).click()
    await expect(page.getByText('0 of 2 waypoints completed (0%).', { exact: true })).toBeVisible()
  })

  test(`${width}px unlinked and same-Challenge destinations, count-one and above-target progress`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    const fixture = await isolate(page)
    await page.goto('/challenges/shared')
    for (const destination of ['unlinked', 'one-count', 'one-count', 'once']) {
      await page.getByRole('link', { name: 'View waypoint', exact: true }).first().click()
      await record(page, `Visit ${destination} ${fixture.writes()}`)
      const waypoint = page.getByRole('combobox', { name: 'Linked waypoint', exact: true })
      if (destination === 'unlinked') {
        await waypoint.clear()
        await waypoint.press('Tab')
      } else if (destination === 'one-count') {
        await waypoint.fill('Count target one')
        await page.getByRole('option', { name: 'Count target one', exact: true }).click()
      }
      await page.getByRole('button', { name: 'Save activity', exact: true }).click()
      const confirmation = page.getByRole('status', { name: 'Activity saved confirmation' })
      await expect(confirmation).toBeFocused()
      await expect(confirmation).toContainText(
        destination === 'unlinked'
          ? 'This Activity does not contribute to Another Challenge.'
          : 'This Activity contributes to Another Challenge.',
      )
      await confirmation.getByRole('link', { name: 'Back to Another Challenge', exact: true }).click()
      const completed = destination === 'unlinked' ? 0 : destination === 'once' ? 2 : 1
      await expect(
        page.getByText(`${completed} of 2 waypoints completed (${completed * 50}%).`, { exact: true }),
      ).toBeVisible()
      if (destination === 'one-count') {
        const count = fixture.writes() - 1
        await expect(page.getByText(`Completion: ${count} of 1 activity`, { exact: true })).toBeVisible()
      }
    }
    await expect(page.getByText('All waypoints complete.', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: /^Continue with/ })).toHaveCount(0)
    expect(fixture.writes()).toBe(4)
    await noOverflow(page)
  })

  test(`${width}px loaded Activity reassignment and deletion update both Challenges`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    const fixture = await isolate(page)
    await page.goto('/challenges/journey')
    await page.getByRole('link', { name: 'View waypoint', exact: true }).first().click()
    await record(page, 'Move this saved visit')
    await page.getByRole('button', { name: 'Save activity', exact: true }).click()
    await expect(page.getByRole('status', { name: 'Activity saved confirmation' })).toBeFocused()
    const reads = fixture.reads()
    await page.getByRole('link', { name: 'Move this saved visit', exact: true }).click()
    await expect(page.getByRole('link', { name: 'Back to Discovery Challenge' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Edit activity', exact: true }).click()
    await page.getByRole('combobox', { name: 'Linked waypoint', exact: true }).fill('Count target one')
    await page.getByRole('option', { name: 'Count target one', exact: true }).click()
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.getByText('Activity saved.', { exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Journey', exact: true }).click()
    await expect(page.getByRole('link', { name: 'Discovery Challenge', exact: true })).toContainText('0% complete')
    await expect(page.getByRole('link', { name: 'Another Challenge', exact: true })).toContainText('50% complete')
    await page.getByRole('link', { name: 'Another Challenge', exact: true }).click()
    await expect(page.getByText('1 of 2 waypoints completed (50%).', { exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'View waypoint', exact: true }).nth(1).click()
    await page.getByRole('link', { name: 'Move this saved visit', exact: true }).click()
    expect(fixture.reads()).toBe(reads)
    await page.getByRole('button', { name: 'Delete activity', exact: true }).first().click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page).toHaveURL(/\/waypoints\/one-count$/)
    await page.getByRole('link', { name: 'Journey', exact: true }).click()
    await expect(page.getByRole('link', { name: 'Another Challenge', exact: true })).toContainText('0% complete')
    expect(fixture.data().activities).toHaveLength(0)
    expect(fixture.writes()).toBe(3)
    expect(fixture.reads()).toBe(reads + 1) // Activity details explicitly reloads after deletion.
  })

  test(`${width}px loaded membership and record deletion invalidate old origins`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    const fixture = await isolate(page)
    for (const change of ['membership', 'challenge', 'waypoint']) {
      fixture.setData(createJourneyTestData())
      await page.goto('/challenges/journey')
      await page.getByRole('link', { name: 'View waypoint', exact: true }).first().click()
      await expect(page.getByRole('link', { name: 'Back to Discovery Challenge' })).toBeVisible()
      if (change === 'membership') {
        await page.getByRole('button', { name: 'Edit waypoint', exact: true }).click()
        await page.getByRole('button', { name: 'Discovery Challenge', exact: true }).press('Backspace')
        await page.getByRole('button', { name: 'Save waypoint', exact: true }).click()
        await expect(page.getByText('Waypoint saved.', { exact: true })).toBeVisible()
      } else if (change === 'challenge') {
        await page.getByRole('link', { name: 'Back to Discovery Challenge' }).click()
        page.once('dialog', (dialog) => dialog.accept())
        await page.getByRole('button', { name: 'Delete challenge', exact: true }).click()
        await expect(page).toHaveURL(/\/challenges$/)
        await page.goBack()
        await expect(page.getByText('Challenge not found.', { exact: true })).toBeVisible()
        await page.goBack()
      } else {
        await page.getByRole('button', { name: 'Delete waypoint', exact: true }).click()
        await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
        await expect(page).toHaveURL(/\/waypoints$/)
        await page.goBack()
        await expect(page.getByText('Waypoint not found.', { exact: true })).toBeVisible()
      }
      await expect(page.getByRole('link', { name: 'Back to Discovery Challenge' })).toHaveCount(0)
      await expect(page.getByRole('link', { name: 'Waypoints', exact: true }).last()).toBeVisible()
    }
    expect(fixture.writes()).toBe(3)
  })

  test(`${width}px changing the dataset invalidates matching IDs and keeps Demo local read-only`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    const fixture = await isolate(page)
    const demo = createDemoData()
    const matchingWaypoint = demo.waypoints.find((item) => item.waypointId === 'demo-foxglove-manor')!
    fixture.setData({
      ...fixture.data(),
      challenges: fixture
        .data()
        .challenges.map((item) => (item.challengeId === 'journey' ? { ...item, challengeId: 'national-trust' } : item)),
      waypoints: fixture.data().waypoints.map((item) => ({
        ...item,
        waypointId: item.waypointId === 'once' ? matchingWaypoint.waypointId : item.waypointId,
        challengeIds: item.challengeIds.map((id) => (id === 'journey' ? 'national-trust' : id)),
      })),
    })
    await page.goto('/challenges/national-trust')
    await page.getByRole('link', { name: 'View waypoint', exact: true }).first().click()
    if (width < 600) await page.getByRole('button', { name: 'open navigation' }).click()
    await page.getByRole('link', { name: 'Settings', exact: true }).click()
    await page.getByRole('combobox', { name: 'Data mode', exact: true }).click()
    await page.getByRole('option', { name: 'Demo local data', exact: true }).click()
    await page.goBack()
    await expect(page.getByRole('heading', { name: matchingWaypoint.title, exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to Discovery Challenge' })).toHaveCount(0)
    await expect(page.getByText('Read-only mode', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Change the data mode in Settings', exact: true })).toBeVisible()
    expect(fixture.writes()).toBe(0)
  })
}

test('complete/empty membership and read-only Demo load exception stay explicit', async ({ page }) => {
  const fixture = await isolate(page, 'viewer', true)
  fixture.setData({ ...fixture.data(), waypoints: [], activities: [] })
  await page.goto('/challenges/empty')
  await expect(page.getByText('No waypoints linked to this challenge.', { exact: true })).toBeVisible()
  await expect(page.getByText('0 of 0 waypoints completed (0%).', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /^Continue with/ })).toHaveCount(0)
  fixture.failLoad()
  await page.reload()
  await expect(page.getByText(/Demo Cosmos data could not be loaded, so bundled demo data is shown/)).toBeVisible()
  await expect(page.getByText('Challenge not found.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Save|Edit award|Delete challenge/ })).toHaveCount(0)
  expect(fixture.writes()).toBe(0)
})
