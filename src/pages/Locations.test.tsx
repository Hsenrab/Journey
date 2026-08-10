import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import Locations from './Locations'
import { WaypointsProvider } from '../features/journey/JourneyContext'
import { createDefaultData, save } from '../services/storage'
import type { Activity } from '../domain/visit'

function activity(waypointId: string, category: 'bronze' | 'silver' | 'gold'): Activity {
  return {
    activityId: `${waypointId}-${category}`,
    waypointId,
    challengeId: 'national-trust',
    date: '2026-08-01',
    category,
    location: { kind: 'postcode', postcode: waypointId },
    notes: '',
    referenceIds: [],
    photoReferenceIds: [],
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  }
}

function renderLocations(initialEntries: string[] = ['/waypoints']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <WaypointsProvider>
        <Locations />
      </WaypointsProvider>
    </MemoryRouter>,
  )
}

describe('Locations', () => {
  beforeEach(() => localStorage.clear())

  it('lists every waypoint by default', () => {
    renderLocations()
    expect(screen.getByText('Stourhead')).toBeInTheDocument()
    expect(screen.getByText('Dyrham Park')).toBeInTheDocument()
  })

  it('filters by search term across title, area and category', async () => {
    const user = userEvent.setup()
    renderLocations()

    await user.type(screen.getByLabelText('Search waypoints'), 'garden')

    expect(screen.getByText('Westbury Court Garden')).toBeInTheDocument()
    expect(screen.getByText('Hidcote')).toBeInTheDocument()
    expect(screen.queryByText('Corfe Castle')).not.toBeInTheDocument()
  })

  it('filters by status', async () => {
    save({ ...createDefaultData(), activities: [activity('stourhead', 'gold')] })
    const user = userEvent.setup()
    renderLocations()

    await user.click(screen.getAllByRole('combobox')[0])
    await user.click(screen.getByRole('option', { name: 'Gold' }))

    expect(screen.getByText('Stourhead')).toBeInTheDocument()
    expect(screen.queryByText('Dyrham Park')).not.toBeInTheDocument()
  })

  it('applies the status filter from a URL query parameter', () => {
    save({ ...createDefaultData(), activities: [activity('stourhead', 'gold')] })
    renderLocations(['/waypoints?status=gold'])

    expect(screen.getByText('Stourhead')).toBeInTheDocument()
    expect(screen.queryByText('Dyrham Park')).not.toBeInTheDocument()
  })

  it('sorts by name ascending by default', () => {
    renderLocations()
    const names = screen.getAllByRole('heading', { level: 6 }).map((el) => el.textContent)
    const sorted = [...names].sort((a, b) => (a ?? '').localeCompare(b ?? ''))
    expect(names).toEqual(sorted)
  })

  it('re-sorts the list when switching to progress order', async () => {
    save({ ...createDefaultData(), activities: [activity('may-hill', 'gold'), activity('dyrham-park', 'silver')] })
    const user = userEvent.setup()
    renderLocations()

    const namesByName = screen.getAllByRole('heading', { level: 6 }).map((el) => el.textContent)

    await user.click(screen.getAllByRole('combobox')[1])
    await user.click(screen.getByRole('option', { name: 'Progress' }))

    const namesByProgress = screen.getAllByRole('heading', { level: 6 }).map((el) => el.textContent)
    expect(namesByProgress).not.toEqual(namesByName)
    expect([...namesByProgress].sort()).toEqual([...namesByName].sort())
  })

  it('sorts by distance, travel time and last activity date', async () => {
    save({ ...createDefaultData(), activities: [activity('stourhead', 'gold')] })
    const user = userEvent.setup()
    renderLocations()

    const namesByName = screen.getAllByRole('heading', { level: 6 }).map((el) => el.textContent)

    await user.click(screen.getAllByRole('combobox')[1])
    await user.click(screen.getByRole('option', { name: 'Distance (nearest first)' }))
    const namesByDistance = screen.getAllByRole('heading', { level: 6 }).map((el) => el.textContent)
    expect([...namesByDistance].sort()).toEqual([...namesByName].sort())

    await user.click(screen.getAllByRole('combobox')[1])
    await user.click(screen.getByRole('option', { name: 'Travel time' }))
    const namesByTravel = screen.getAllByRole('heading', { level: 6 }).map((el) => el.textContent)
    expect([...namesByTravel].sort()).toEqual([...namesByName].sort())

    await user.click(screen.getAllByRole('combobox')[1])
    await user.click(screen.getByRole('option', { name: 'Last activity date' }))
    const namesByLastActivity = screen.getAllByRole('heading', { level: 6 }).map((el) => el.textContent)
    expect([...namesByLastActivity].sort()).toEqual([...namesByName].sort())
  })

  it('filters by area and category', async () => {
    const user = userEvent.setup()
    renderLocations()

    await user.click(screen.getAllByRole('combobox')[3])
    await user.click(screen.getByRole('option', { name: 'Gloucestershire' }))
    expect(screen.queryByText('Stourhead')).not.toBeInTheDocument()

    await user.click(screen.getAllByRole('combobox')[3])
    await user.click(screen.getByRole('option', { name: 'All areas' }))

    await user.click(screen.getAllByRole('combobox')[4])
    await user.click(screen.getByRole('option', { name: 'Garden' }))
    expect(screen.getByText('Westbury Court Garden')).toBeInTheDocument()
  })
})
