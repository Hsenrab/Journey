import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { createDefaultData, save } from '../services/storage'
import type { Waypoint } from '../domain/visit'

afterEach(cleanup)

const customWaypoint = (waypointId: string, title: string): Waypoint => ({
  waypointId,
  title,
  description: `${title} description`,
  category: 'Walking route',
  tags: [],
  challengeIds: ['custom-challenge'],
  completion: { mode: 'once' },
  location: { placeName: title, addressOrRegion: 'Test area', latitude: 51.86, longitude: -2.22 },
  referenceIds: [],
  photoReferenceIds: [],
})

function saveTestData() {
  save({
    ...createDefaultData(),
    waypoints: [customWaypoint('test-path', 'Pinewood Path'), customWaypoint('test-garden', 'Riverside Garden')],
    challenges: [
      {
        challengeId: 'custom-challenge',
        title: 'Personal goals',
        description: 'A custom challenge for these tests.',
        waypointIds: ['test-path', 'test-garden'],
        supportsActivityCategories: true,
      },
    ],
  })
}

describe('landing route', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.pushState({}, '', '/')
  })
  afterEach(cleanup)

  it('opens on the progress dashboard', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Challenges' })).toBeInTheDocument()
    expect(screen.getByText('No challenges are available yet.')).toBeInTheDocument()
    expect(screen.queryByText('National Trust')).not.toBeInTheDocument()
  })

  it('keeps /waypoints reachable as its own route', () => {
    window.history.pushState({}, '', '/waypoints')
    render(<App />)

    expect(screen.getByLabelText('Search waypoints')).toBeInTheDocument()
  })
})

describe('waypoint list', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.pushState({}, '', '/waypoints')
  })
  afterEach(cleanup)

  it('filters waypoints by a search term', async () => {
    const user = userEvent.setup()
    saveTestData()
    render(<App />)

    await user.type(screen.getByLabelText('Search waypoints'), 'Pinewood')

    expect(screen.getByText('Pinewood Path')).toBeInTheDocument()
    expect(screen.queryByText('Riverside Garden')).not.toBeInTheDocument()
  })

  it('shows custom waypoint details without catalogue travel metadata', async () => {
    saveTestData()
    render(<App />)

    expect(screen.getAllByText('Walking route · Test area')).toHaveLength(2)
    expect(screen.queryByText(/miles from Brockworth|min drive|Drive time/)).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Maximum driving distance' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Drive time (where available)' })).not.toBeInTheDocument()
  })
})

describe('activity logging', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.pushState({}, '', '/waypoints')
  })

  const logActivity = async (user: ReturnType<typeof userEvent.setup>, level: string, date: string) => {
    await user.click(screen.getByRole('button', { name: 'Log activity' }))
    await user.click(screen.getByRole('combobox', { name: 'Activity category' }))
    await user.click(screen.getByRole('option', { name: level }))
    fireEvent.change(screen.getByLabelText('Activity date'), { target: { value: date } })
    await user.click(screen.getByRole('button', { name: 'Save activity' }))
  }

  // This test performs two full activity-logging flows plus a re-render, which is
  // consistently close to the default 10s timeout on slower/loaded CI runners.
  it('records activities, keeps history and derives the highest status', async () => {
    const user = userEvent.setup()
    saveTestData()
    render(<App />)

    await user.click(screen.getByRole('link', { name: 'Pinewood Path' }))

    await logActivity(user, 'Gold', '2026-08-01')
    expect(screen.getByText('Activity saved.')).toBeInTheDocument()
    expect(screen.getByText('Award tier: Gold')).toBeInTheDocument()

    await logActivity(user, 'Bronze', '2026-08-02')
    expect(screen.getByText(new Date('2026-08-01T00:00:00').toLocaleDateString())).toBeInTheDocument()
    expect(screen.getByText(new Date('2026-08-02T00:00:00').toLocaleDateString())).toBeInTheDocument()
    expect(screen.getByText('Award tier: Gold')).toBeInTheDocument()

    cleanup()
    render(<App />)
    await user.click(within(screen.getByTestId('detail-breadcrumbs')).getByRole('link', { name: 'Waypoints' }))
    await user.click(screen.getByRole('link', { name: 'Pinewood Path' }))
    expect(screen.getByText('Award tier: Gold')).toBeInTheDocument()
  }, 20000)
})
