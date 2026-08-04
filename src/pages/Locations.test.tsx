import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import Locations from './Locations'
import { JourneyProvider } from '../features/journey/JourneyContext'
import { save } from '../services/storage'
import type { AwardedStatus, Visit } from '../domain/visit'

function visit(locationId: string, status: AwardedStatus): Visit {
  return {
    visitId: `${locationId}-${status}`,
    locationId,
    status,
    date: '2026-08-01',
    notes: '',
    photos: [],
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  }
}

function renderLocations() {
  return render(
    <MemoryRouter>
      <JourneyProvider>
        <Locations />
      </JourneyProvider>
    </MemoryRouter>,
  )
}

describe('Locations', () => {
  beforeEach(() => localStorage.clear())

  it('lists every location by default', () => {
    renderLocations()
    expect(screen.getByText('Lyme')).toBeInTheDocument()
    expect(screen.getByText('Dunham Massey')).toBeInTheDocument()
  })

  it('filters by search term across name, county and type', async () => {
    const user = userEvent.setup()
    renderLocations()

    await user.type(screen.getByLabelText('Search locations'), 'garden')

    expect(screen.getByText('Lyme')).toBeInTheDocument()
    expect(screen.getByText('Hare Hill')).toBeInTheDocument()
    expect(screen.queryByText('Nether Alderley Mill')).not.toBeInTheDocument()
  })

  it('filters by status', async () => {
    save({ visits: [visit('lyme', 'gold')] })
    const user = userEvent.setup()
    renderLocations()

    await user.click(screen.getAllByRole('combobox')[0])
    await user.click(screen.getByRole('option', { name: 'Gold' }))

    expect(screen.getByText('Lyme')).toBeInTheDocument()
    expect(screen.queryByText('Dunham Massey')).not.toBeInTheDocument()
  })

  it('sorts by name ascending by default', () => {
    renderLocations()
    const names = screen.getAllByRole('heading', { level: 6 }).map((el) => el.textContent)
    const sorted = [...names].sort((a, b) => (a ?? '').localeCompare(b ?? ''))
    expect(names).toEqual(sorted)
  })

  it('re-sorts the list when switching to progress order', async () => {
    save({ visits: [visit('nether-alderley-mill', 'gold'), visit('dunham-massey', 'silver')] })
    const user = userEvent.setup()
    renderLocations()

    const namesByName = screen.getAllByRole('heading', { level: 6 }).map((el) => el.textContent)

    await user.click(screen.getAllByRole('combobox')[1])
    await user.click(screen.getByRole('option', { name: 'Progress' }))

    const namesByProgress = screen.getAllByRole('heading', { level: 6 }).map((el) => el.textContent)
    expect(namesByProgress).not.toEqual(namesByName)
    expect([...namesByProgress].sort()).toEqual([...namesByName].sort())
  })
})
