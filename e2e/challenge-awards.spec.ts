import { expect, test, type Page } from '@playwright/test'
import { createAwardTestData, createDemoTestData } from '../src/test/demoData'

async function isolate(page: Page, role: 'admin' | 'viewer', ordinaryOnly = false) {
  let data = createAwardTestData()
  if (ordinaryOnly)
    data = {
      ...data,
      challenges: data.challenges.map((item) => ({
        ...item,
        supportsActivityCategories: false,
        awardDescriptions: undefined,
      })),
      activities: data.activities.map((item) => ({ ...item, category: undefined })),
    }
  let writes = 0
  const etags = () =>
    Object.fromEntries(
      [
        ...data.challenges.map((item) => item.challengeId),
        ...data.waypoints.map((item) => item.waypointId),
        ...data.activities.map((item) => item.activityId),
        ...data.ideas.map((item) => item.ideaId),
      ].map((id) => [id, `etag-${writes}`]),
    )
  await page.clock.setFixedTime(new Date('2026-10-25T12:00:00Z'))
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('journey-data-mode-v1', 'demo-cosmos')
  })
  await page.route('**/api/journey/**', async (route) => {
    if (route.request().method() !== 'GET') {
      writes++
      expect(role).toBe('admin')
      const body = route.request().postDataJSON()
      if (body.operation === 'delete' && body.type === 'challenge') {
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
        expect(body.operation).toBe('replace')
        data = body.data
      }
    }
    await route.fulfill({ json: { data, etags: etags(), role } })
  })
  await page.route('**/api/maps/**', (route) =>
    route.fulfill({
      status: 403,
      json: { error: 'Maps are excluded from this isolated award fixture.' },
    }),
  )
  return { writes: () => writes, data: () => data }
}

for (const width of [360, 1280]) {
  test(`explicit scheme creation and contextual JSON awards at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    const fixture = await isolate(page, 'admin')
    fixture.data().ideas.push({
      ideaId: 'award-idea',
      title: 'Explore the shared Waypoint',
      description: '',
      notes: '',
      waypointIds: ['award-w1'],
      planningState: 'active',
      difficulty: 1,
      referenceIds: [],
      createdAt: '2026-08-01T00:00:00Z',
      updatedAt: '2026-08-01T00:00:00Z',
    })
    await page.goto('/challenges')
    await page.getByRole('button', { name: 'Add challenge', exact: true }).click()
    await expect(page.getByRole('checkbox', { name: 'Use Bronze, Silver and Gold awards' })).not.toBeChecked()
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Deliberate award scheme')
    await page
      .getByRole('textbox', { name: 'Description', exact: true })
      .fill('A fictional scheme with user-written criteria.')
    await page.getByRole('checkbox', { name: 'Use Bronze, Silver and Gold awards' }).check()
    await page.getByRole('button', { name: 'Save challenge', exact: true }).click()
    for (const tier of ['Bronze', 'Silver', 'Gold']) {
      await expect(page.getByText(`${tier} explanation is required.`, { exact: true })).toBeVisible()
      await page.getByRole('textbox', { name: `${tier} explanation` }).fill(`${tier} deliberate guidance`)
    }
    expect(fixture.writes()).toBe(0)
    await page.getByRole('button', { name: 'Save challenge', exact: true }).click()
    await expect(page.getByText('Challenge saved.', { exact: true })).toBeVisible()
    expect(
      fixture.data().challenges.find((item) => item.title === 'Deliberate award scheme')!.awardDescriptions,
    ).toEqual({
      bronze: 'Bronze deliberate guidance',
      silver: 'Silver deliberate guidance',
      gold: 'Gold deliberate guidance',
    })
    await page.goto('/activities?mode=add&waypoint=award-w1&idea=award-idea')
    await expect(page.getByText('Award Challenge A award explanations')).toBeVisible()
    await expect(page.getByText('Award Challenge B award explanations')).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Award tier' })).not.toContainText(/Bronze|Silver|Gold/)
    await page.getByRole('textbox', { name: 'Activity title' }).fill('Keep my draft')
    const json = {
      name: 'Explicit JSON visit',
      date: '2026-08-01',
      notes: '',
      location: { kind: 'coordinates', latitude: 51, longitude: -2 },
      references: [],
      photoReferences: [],
    }
    await page.getByRole('tab', { name: 'Paste JSON' }).click()
    await page.getByRole('textbox', { name: 'Activity JSON', exact: true }).fill(JSON.stringify(json))
    await page.getByRole('button', { name: 'Load into form', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'requires a Bronze, Silver or Gold award' })).toBeVisible()
    await page.getByRole('tab', { name: 'Form', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Activity title' })).toHaveValue('Keep my draft')
    await page.getByRole('tab', { name: 'Paste JSON' }).click()
    await page
      .getByRole('textbox', { name: 'Activity JSON', exact: true })
      .fill(JSON.stringify({ ...json, category: 'gold' }))
    await page.getByRole('button', { name: 'Load into form', exact: true }).click()
    await page.getByRole('button', { name: 'Save activity', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Explore the shared Waypoint', exact: true })).toBeVisible()
    await expect(page.getByRole('alert').filter({ hasText: 'Activity saved.' })).toBeVisible()
    expect(fixture.data().activities.find((item) => item.name === 'Explicit JSON visit')).toMatchObject({
      category: 'gold',
      waypointId: 'award-w1',
      ideaIds: ['award-idea'],
    })
    await page.goto('/activities?mode=add&waypoint=ordinary-w')
    await page.getByRole('tab', { name: 'Paste JSON' }).click()
    await page
      .getByRole('textbox', { name: 'Activity JSON', exact: true })
      .fill(JSON.stringify({ ...json, category: 'gold' }))
    await page.getByRole('button', { name: 'Load into form', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'does not support awards' })).toBeVisible()
    expect(fixture.writes()).toBe(2)
  })
  for (const role of ['admin', 'viewer'] as const) {
    test(`exact award distributions, drill-downs and empty-filter recovery for ${role} at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 })
      const fixture = await isolate(page, role)
      await page.goto('/challenges/award-a')
      await expect(page.getByText('Award Challenge A award explanations')).toBeVisible()
      await expect(page.getByText(/Award Challenge A: 3 waypoints, 4 activities/)).toBeVisible()
      for (const [tier, count] of [
        ['Bronze', 0],
        ['Silver', 1],
        ['Gold', 1],
        ['No award recorded', 1],
      ] as const) {
        await page
          .getByRole('link', {
            name: `Award Challenge A, highest ${tier}, ${count} waypoint${count === 1 ? '' : 's'}`,
            exact: true,
          })
          .click()
        await expect(page.locator('.MuiCard-root')).toHaveCount(count)
        await expect(page.getByRole('combobox', { name: 'Highest recorded award', exact: true })).toBeVisible()
        if (count === 0) {
          await expect(page.getByText('No waypoints match your search and filters.')).toBeVisible()
          await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
          await expect(page.locator('.MuiCard-root')).toHaveCount(3)
        }
        await page.getByRole('link', { name: 'Back to Award Challenge A Statistics', exact: true }).click()
      }
      for (const [tier, count] of [
        ['Bronze', 2],
        ['Silver', 1],
        ['Gold', 1],
      ] as const) {
        await page
          .getByRole('link', {
            name: `Award Challenge A, recorded ${tier}, ${count} activit${count === 1 ? 'y' : 'ies'}`,
            exact: true,
          })
          .click()
        await expect(page.locator('.MuiCard-root')).toHaveCount(count)
        await expect(page.getByText(`Recorded award: ${tier}`, { exact: true })).toHaveCount(count)
        await page.getByRole('link', { name: 'Back to Award Challenge A Statistics', exact: true }).click()
      }
      const goldLink = page.getByRole('link', { name: 'Award Challenge A, highest Gold, 1 waypoint', exact: true })
      await goldLink.focus()
      await expect(goldLink).toBeFocused()
      await goldLink.press('Enter')
      await expect(page.getByRole('heading', { name: 'Shared Award Waypoint', exact: true })).toBeVisible()
      await page.getByRole('textbox', { name: 'Search waypoints' }).fill('no matching record')
      await expect(page.getByRole('combobox', { name: 'Highest recorded award' })).toBeVisible()
      await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
      await expect(page.locator('.MuiCard-root')).toHaveCount(3)
      await page.goto('/challenges')
      await expect(
        page.getByRole('link', { name: 'All eligible Waypoints, recorded Bronze, 2 activities', exact: true }),
      ).toBeVisible()
      await page.goto('/challenges/empty')
      await expect(page.getByText('No waypoints linked to this challenge.', { exact: true })).toBeVisible()
      await expect(
        page.getByRole('link', { name: 'Empty Award Challenge, highest No award recorded, 0 waypoints', exact: true }),
      ).toBeVisible()
      await expect(
        page.getByRole('link', { name: 'Empty Award Challenge, recorded Gold, 0 activities', exact: true }),
      ).toBeVisible()
      await page.goto('/challenges/ordinary')
      await expect(page.getByRole('heading', { name: 'Waypoints by highest recorded award' })).toHaveCount(0)
      await expect(page.getByText(/Highest recorded award:/)).toHaveCount(0)
      if (role === 'viewer') {
        await expect(page.getByRole('button', { name: 'Edit award settings' })).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'Delete challenge' })).toHaveCount(0)
      }
      await page.goto('/map')
      await expect(page.getByRole('combobox', { name: 'Progress status', exact: true })).toBeVisible()
      await expect(page.getByRole('combobox', { name: 'Highest recorded award', exact: true })).toBeVisible()
      await page.goto('/settings')
      await expect(page.getByText(/Most Challenges do not use awards/)).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      expect(fixture.writes()).toBe(0)
    })
  }

  test(`recording and correcting awards updates loaded member and Activity totals at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    const fixture = await isolate(page, 'admin')
    await page.goto('/challenges/award-a')
    const member = page
      .locator('.MuiCard-root')
      .filter({ has: page.getByRole('heading', { name: 'Unvisited Award Waypoint', exact: true }) })
    await member.getByRole('link', { name: 'View waypoint', exact: true }).click()
    await page.getByRole('button', { name: 'Log activity', exact: true }).click()
    await page.getByRole('textbox', { name: 'Activity title' }).fill('First Gold visit')
    await expect(page.getByRole('combobox', { name: 'Award tier' })).not.toContainText('Gold')
    await page.getByRole('combobox', { name: 'Award tier' }).click()
    await page.getByRole('option', { name: 'Gold', exact: true }).click()
    await page.getByRole('combobox', { name: 'Location type' }).click()
    await page.getByRole('option', { name: 'Latitude and longitude', exact: true }).click()
    await page.getByLabel('Latitude', { exact: true }).fill('51')
    await page.getByLabel('Longitude', { exact: true }).fill('-2')
    await page.getByRole('button', { name: 'Save activity', exact: true }).click()
    await expect(page.getByText('Activity saved.', { exact: true })).toBeVisible()
    await expect(page.getByText('Highest recorded award: Gold', { exact: true })).toBeVisible()
    expect(fixture.writes()).toBe(1)
    await page.goBack()
    await expect(
      page.getByRole('link', { name: 'Award Challenge A, highest Gold, 2 waypoints', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Award Challenge A, recorded Gold, 2 activities', exact: true }),
    ).toBeVisible()
    await page.goto('/activities/award-visit-1')
    await page.getByRole('button', { name: 'Edit activity', exact: true }).click()
    await expect(page.getByRole('combobox', { name: 'Award tier' })).toHaveText('Gold')
    await page.getByRole('textbox', { name: 'Activity title' }).fill('Corrected overnight visit')
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Edit activity', exact: true })).toBeVisible()
    expect(fixture.data().activities.find((item) => item.activityId === 'award-visit-1')!.category).toBe('gold')
    await page.getByRole('button', { name: 'Edit activity', exact: true }).click()
    await page.getByRole('combobox', { name: 'Award tier' }).click()
    await page.getByRole('option', { name: 'Bronze', exact: true }).click()
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Edit activity', exact: true })).toBeVisible()
    await page.goto('/challenges/award-a')
    await expect(
      page.getByRole('link', { name: 'Award Challenge A, highest Bronze, 1 waypoint', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Award Challenge A, recorded Gold, 1 activity', exact: true }),
    ).toBeVisible()
    const goldVisit = fixture.data().activities.find((item) => item.name === 'First Gold visit')!
    await page.goto(`/activities/${goldVisit.activityId}`)
    await page.getByRole('button', { name: 'Delete activity', exact: true }).click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Unvisited Award Waypoint', exact: true })).toBeVisible()
    await page.goto('/challenges/award-a')
    await expect(
      page.getByRole('link', { name: 'Award Challenge A, highest Gold, 0 waypoints', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Award Challenge A, highest No award recorded, 1 waypoint', exact: true }),
    ).toBeVisible()
    await expect(page.getByText('Completion: 1 of 3 activities', { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  })

  test(`invalidating settings preserve the draft and perform no writes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    const fixture = await isolate(page, 'admin')
    await page.goto('/challenges/award-a')
    await page.getByRole('button', { name: 'Edit award settings', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Use Bronze, Silver and Gold awards' }).uncheck()
    await page.getByRole('button', { name: 'Save award settings', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'silver-visit' })).toBeVisible()
    await expect(page.getByRole('checkbox', { name: 'Use Bronze, Silver and Gold awards' })).not.toBeChecked()
    expect(fixture.writes()).toBe(0)
    await page.getByRole('button', { name: 'Cancel award settings' }).click()
    await page.goto('/challenges/ordinary')
    await page.getByRole('button', { name: 'Edit award settings', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Use Bronze, Silver and Gold awards' }).check()
    for (const tier of ['Bronze', 'Silver', 'Gold'])
      await page.getByRole('textbox', { name: `${tier} explanation` }).fill(`${tier} explicit guidance`)
    await page.getByRole('button', { name: 'Save award settings', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'ordinary-visit' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Gold explanation' })).toHaveValue('Gold explicit guidance')
    expect(fixture.writes()).toBe(0)
    await page.goto('/waypoints?challenge=award-a&status=platinum')
    await expect(page.getByRole('alert').filter({ hasText: 'Invalid highest-award filter' })).toBeVisible()
    await expect(page.locator('.MuiCard-root')).toHaveCount(0)
  })

  test(`shared Challenge removal and awarded Waypoint protection at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    const fixture = await isolate(page, 'admin')
    await page.goto('/challenges/award-b')
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Delete challenge', exact: true }).click()
    await expect(page).toHaveURL(/\/challenges$/)
    expect(fixture.writes()).toBe(1)
    expect(fixture.data().activities.filter((item) => item.category === 'gold')).toHaveLength(1)
    await page.goto('/waypoints/award-w1')
    await page.getByRole('button', { name: 'Delete waypoint', exact: true }).click()
    await expect(page.getByText(/This Waypoint has recorded awards and cannot be deleted/)).toBeVisible()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'award-visit-0' })).toBeVisible()
    expect(fixture.writes()).toBe(1)
    expect(fixture.data().waypoints.some((item) => item.waypointId === 'award-w1')).toBe(true)
  })

  test(`deliberate destination correction preserves history on cancellation and save failure at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 })
    const fixture = await isolate(page, 'admin')
    await page.goto('/activities/award-visit-1')
    await page.getByRole('button', { name: 'Edit activity', exact: true }).click()
    const waypoint = page.getByRole('combobox', { name: 'Linked waypoint' })
    await waypoint.fill('Ordinary Waypoint')
    await page.getByRole('option', { name: 'Ordinary Waypoint', exact: true }).click()
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.getByRole('checkbox', { name: 'I confirm removal of the recorded award' })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(fixture.writes()).toBe(0)
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    expect(fixture.data().activities.find((item) => item.activityId === 'award-visit-1')!.category).toBe('gold')
    await page.getByRole('button', { name: 'Edit activity', exact: true }).click()
    await page.getByRole('combobox', { name: 'Linked waypoint' }).fill('Ordinary Waypoint')
    await page.getByRole('option', { name: 'Ordinary Waypoint', exact: true }).click()
    await page.getByRole('checkbox', { name: 'I confirm removal of the recorded award' }).check()
    await page.route(
      '**/api/journey/**',
      async (route) => {
        expect(route.request().method()).toBe('POST')
        await route.fulfill({ status: 409, json: { error: 'conflict' } })
      },
      { times: 1 },
    )
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Your data has changed in another session.' })).toBeVisible()
    await expect(page.getByRole('checkbox', { name: 'I confirm removal of the recorded award' })).toBeChecked()
    expect(fixture.data().activities.find((item) => item.activityId === 'award-visit-1')!.category).toBe('gold')
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Edit activity', exact: true })).toBeVisible()
    expect(fixture.data().activities.find((item) => item.activityId === 'award-visit-1')).toMatchObject({
      waypointId: 'ordinary-w',
    })
    expect(fixture.data().activities.find((item) => item.activityId === 'award-visit-1')!.category).toBeUndefined()
    expect(fixture.writes()).toBe(1)
    await page.goto('/challenges/award-a')
    await expect(
      page.getByRole('link', { name: 'Award Challenge A, highest Gold, 0 waypoints', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Award Challenge A, highest Bronze, 1 waypoint', exact: true }),
    ).toBeVisible()
  })

  test(`ordinary-only datasets have no award browsing controls at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    const fixture = await isolate(page, 'viewer', true)
    await page.goto('/challenges')
    await expect(page.getByRole('heading', { name: 'Waypoints by highest recorded award' })).toHaveCount(0)
    await page.goto('/waypoints')
    await expect(page.getByRole('combobox', { name: 'Highest recorded award' })).toHaveCount(0)
    await expect(page.getByText(/Highest recorded award:/)).toHaveCount(0)
    await page.goto('/activities')
    await expect(page.getByRole('combobox', { name: 'Recorded award' })).toHaveCount(0)
    await expect(page.getByText(/Recorded award:/)).toHaveCount(0)
    await page.goto('/map')
    await expect(page.getByRole('combobox', { name: 'Progress status', exact: true })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Highest recorded award', exact: true })).toHaveCount(0)
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: 'Gold', exact: true })).toHaveCount(0)
    expect(fixture.writes()).toBe(0)
  })

  test(`long explanations remain readable and Demo-local browsing stays read-only at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    const fixture = await isolate(page, 'admin')
    await page.goto('/challenges/award-a')
    await page.getByRole('button', { name: 'Edit award settings', exact: true }).click()
    const longExplanation = 'An overnight visit with a full day exploring the Waypoint. '.repeat(12)
    await page.getByRole('textbox', { name: 'Gold explanation' }).fill(longExplanation)
    await page.getByRole('button', { name: 'Save award settings', exact: true }).click()
    await expect(page.getByText('Award settings saved. Recorded levels are unchanged.', { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await page.addInitScript(() => localStorage.setItem('journey-data-mode-v1', 'demo-local'))
    await page.goto('/waypoints')
    await expect(page.getByRole('button', { name: 'Add waypoint', exact: true })).toHaveCount(0)
    await page.goto('/activities')
    await expect(page.getByRole('button', { name: 'Add activity', exact: true })).toHaveCount(0)
    await page.goto('/challenges')
    await expect(page.getByRole('button', { name: 'Add challenge', exact: true })).toHaveCount(0)
    const ordinary = createDemoTestData().challenges.find((item) => !item.supportsActivityCategories)!
    await page.goto(`/challenges/${ordinary.challengeId}`)
    await expect(page.getByText(/Highest recorded award:/)).toHaveCount(0)
    await page.goto('/map')
    await expect(page.getByRole('combobox', { name: 'Progress status', exact: true })).toBeVisible()
    await page.goto('/settings')
    await expect(page.getByRole('button', { name: 'Clear data', exact: true })).toBeDisabled()
    expect(fixture.writes()).toBe(1)
  })
}
