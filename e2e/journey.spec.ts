import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

const locationCount = (
  JSON.parse(readFileSync(new URL('../src/data/locations.json', import.meta.url), 'utf8')) as unknown[]
).length

test.describe('main journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear())
  })

  test('records a visit and sees it reflected across the app', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByText(`0 of ${locationCount} main experiences completed`)).toBeVisible()

    await page.getByRole('link', { name: 'Locations' }).click()
    await expect(page.getByRole('heading', { name: 'Locations' })).toBeVisible()

    await page.getByLabel('Search locations').fill('Chedworth')
    await expect(page.getByText('Chedworth Roman Villa', { exact: true })).toBeVisible()
    await expect(page.getByText('Dyrham Park')).not.toBeVisible()

    await page.getByRole('link', { name: 'View details' }).click()
    await expect(page.getByRole('heading', { name: 'Chedworth Roman Villa' })).toBeVisible()

    await page.getByText('Bronze', { exact: true }).click()
    await page.getByRole('option', { name: 'Gold' }).click()
    await page.getByLabel('Notes').fill('A brilliant day out')
    await page.getByRole('button', { name: 'Save visit' }).click()
    await expect(page.getByText('Visit saved.')).toBeVisible()

    await page.getByRole('link', { name: '← All locations' }).click()
    await expect(
      page
        .getByRole('heading', { name: 'Chedworth Roman Villa' })
        .locator('xpath=ancestor::*[contains(@class, "MuiCard-root")]'),
    ).toContainText('Gold')

    await page.getByRole('link', { name: 'Dashboard' }).click()
    await expect(page.getByText(`1 of ${locationCount} main experiences completed`)).toBeVisible()
  })

  test('shows a not found message for an unknown location', async ({ page }) => {
    await page.goto('/locations/does-not-exist')
    await expect(page.getByText('Location not found.')).toBeVisible()
  })
})
