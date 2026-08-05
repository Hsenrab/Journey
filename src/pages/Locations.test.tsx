import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import Locations from './Locations'
import { JourneyProvider } from '../features/journey/JourneyContext'
import { locations } from '../data/locations'
import { save } from '../services/storage'

const [first, second] = locations
const gardens = locations.filter((location) =>
  `${location.name} ${location.area} ${location.category}`.toLowerCase().includes('garden'),
)
const nonGarden = locations.find((location) => !gardens.includes(location))!

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
    expect(screen.getAllByRole('heading', { level: 6 })).toHaveLength(locations.length)
    expect(screen.getByText(first.name)).toBeInTheDocument()
    expect(screen.getByText(second.name)).toBeInTheDocument()
  })

  it('filters by search term across name, county and type', async () => {
    const user = userEvent.setup()
    renderLocations()

    await user.type(screen.getByLabelText('Search locations'), 'garden')

    for (const location of gardens) {
      expect(screen.getByText(location.name)).toBeInTheDocument()
    }
    expect(screen.queryByText(nonGarden.name)).not.toBeInTheDocument()
  })

  it('filters by status', async () => {
    save({ [first.locationId]: { status: 'gold', date: '2026-08-01', notes: '', photos: [] } })
    const user = userEvent.setup()
    renderLocations()

    await user.click(screen.getAllByRole('combobox')[0])
    await user.click(screen.getByRole('option', { name: 'Gold' }))

    expect(screen.getByText(first.name)).toBeInTheDocument()
    expect(screen.queryByText(second.name)).not.toBeInTheDocument()
  })

  it('sorts by name ascending by default', () => {
    renderLocations()
    const names = screen.getAllByRole('heading', { level: 6 }).map((el) => el.textContent)
    const sorted = [...names].sort((a, b) => (a ?? '').localeCompare(b ?? ''))
    expect(names).toEqual(sorted)
  })

  it('re-sorts the list when switching to progress order', async () => {
    save({
      [locations[locations.length - 1].locationId]: { status: 'gold', date: '2026-08-01', notes: '', photos: [] },
      [second.locationId]: { status: 'silver', date: '2026-08-01', notes: '', photos: [] },
    })
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
