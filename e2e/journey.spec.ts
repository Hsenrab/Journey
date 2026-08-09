import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

const waypointCount = (
  JSON.parse(readFileSync(new URL('../src/data/locations.json', import.meta.url), 'utf8')) as unknown[]
).length

test.describe('waypoints flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear())
  })

  test('records an activity and sees it reflected across the app', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Waypoints' })).toBeVisible()

    await page.getByLabel('Search waypoints').fill('Chedworth')
    await expect(page.getByText('Chedworth Roman Villa', { exact: true })).toBeVisible()
    await expect(page.getByText('Dyrham Park')).not.toBeVisible()

    await page.getByRole('link', { name: 'View waypoint' }).click()
    await expect(page.getByRole('heading', { name: 'Chedworth Roman Villa' })).toBeVisible()

    await page.getByText('Bronze', { exact: true }).click()
    await page.getByRole('option', { name: 'Gold' }).click()
    await page.getByLabel('Notes').fill('A brilliant day out')
    await page.getByRole('button', { name: 'Save activity' }).click()
    await expect(page.getByText('Activity saved.')).toBeVisible()

    await page.getByRole('link', { name: '← All waypoints' }).click()
    await expect(
      page
        .getByRole('heading', { name: 'Chedworth Roman Villa' })
        .locator('xpath=ancestor::*[contains(@class, "MuiCard-root")]'),
    ).toContainText('Gold')

    await page.getByRole('link', { name: 'Challenges' }).click()
    await expect(page.getByText(`1 of ${waypointCount} waypoints completed`)).toBeVisible()
  })

  test('shows a not found message for an unknown waypoint', async ({ page }) => {
    await page.goto('/waypoints/does-not-exist')
    await expect(page.getByText('Waypoint not found.')).toBeVisible()
  })
})
