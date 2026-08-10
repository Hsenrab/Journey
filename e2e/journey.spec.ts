import { expect, test } from '@playwright/test'

test.describe('activity management flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear())
  })

  test('creates a linked categorized activity from waypoint details', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Search waypoints').fill('Chedworth')
    await page.getByRole('link', { name: 'View waypoint' }).click()

    await page.getByRole('button', { name: 'Add activity' }).click()
    await page.getByLabel('Postcode').fill('GL54 3LJ')
    await page.getByRole('combobox', { name: 'Activity category' }).click()
    await page.getByRole('option', { name: 'Gold' }).click()
    await page.getByLabel('Description / notes').fill('Excellent day')
    await page.getByRole('button', { name: 'Save activity' }).click()

    await expect(page.getByText('Activity saved.')).toBeVisible()
    await expect(page.getByText('Category summary: Gold')).toBeVisible()

    await page.getByRole('link', { name: '2026' }).first().click()
    await expect(page.getByRole('heading', { name: /2026-.*Chedworth Roman Villa/ })).toBeVisible()
  })

  test('creates unlinked activity, edits it, and deletes it', async ({ page }) => {
    await page.goto('/activities')
    await page.getByRole('button', { name: 'Add activity' }).click()
    await page.getByLabel('Postcode').fill('GL1 1AA')
    await page.getByLabel('Description / notes').fill('Unlinked activity')
    await page.getByRole('button', { name: 'Save activity' }).click()

    await expect(page.getByText('Activity saved.')).toBeVisible()
    await page.getByRole('link', { name: /2026-/ }).first().click()

    await expect(page.getByText('No photos linked to this activity.')).toBeVisible()
    await expect(page.getByText('No references linked to this activity.')).toBeVisible()

    await page.getByRole('button', { name: 'Edit activity' }).click()
    await page.getByRole('button', { name: 'Add reference' }).click()
    await page.getByLabel('Reference title').fill('External article')
    await page.getByLabel('Reference URL').fill('https://example.com/article')
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page.getByText('Activity updated.')).toBeVisible()
    await expect(page.getByText('External article')).toBeVisible()

    await page.getByRole('button', { name: 'Delete activity' }).first().click()
    await page.getByRole('button', { name: 'Delete' }).click()

    await expect(page).toHaveURL(/\/activities$/)
  })
})
