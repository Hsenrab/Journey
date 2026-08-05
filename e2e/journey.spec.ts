import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { parseLocations } from '../src/domain/location'

const locations = parseLocations(
  JSON.parse(readFileSync(fileURLToPath(new URL('../src/data/locations.json', import.meta.url)), 'utf8')),
)
const [first, second] = locations

test.describe('main journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear())
  })

  test('records a visit and sees it reflected across the app', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByText(`0 of ${locations.length} main experiences completed`)).toBeVisible()

    await page.getByRole('link', { name: 'Locations' }).click()
    await expect(page.getByRole('heading', { name: 'Locations' })).toBeVisible()

    await page.getByLabel('Search locations').fill(first.name)
    await expect(page.getByText(first.name, { exact: true })).toBeVisible()
    await expect(page.getByText(second.name)).toHaveCount(0)

    await page.getByRole('link', { name: 'View details' }).click()
    await expect(page.getByRole('heading', { name: first.name })).toBeVisible()

    await page.getByText('Bronze', { exact: true }).click()
    await page.getByRole('option', { name: 'Gold' }).click()
    await page.getByLabel('Notes').fill('A brilliant day out')
    await page.getByRole('button', { name: 'Save visit' }).click()
    await expect(page.getByText('Visit saved.')).toBeVisible()

    await page.getByRole('link', { name: '← All locations' }).click()
    await expect(page.getByText('Gold', { exact: true })).toBeVisible()

    await page.getByRole('link', { name: 'Dashboard' }).click()
    await expect(page.getByText(`1 of ${locations.length} main experiences completed`)).toBeVisible()
  })

  test('shows a not found message for an unknown location', async ({ page }) => {
    await page.goto('/locations/does-not-exist')
    await expect(page.getByText('Location not found.')).toBeVisible()
  })
})
