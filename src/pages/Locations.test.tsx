import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import Locations from './Locations'
import { JourneyProvider } from '../features/journey/JourneyContext'
import { save } from '../services/storage'

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
    expect(screen.getByText('May Hill')).toBeInTheDocument()
    expect(screen.getByText('Dyrham Park')).toBeInTheDocument()
  })

  it('filters by search term across name, area and category', async () => {
    const user = userEvent.setup()
    renderLocations()

    await user.type(screen.getByLabelText('Search locations'), 'garden')

    expect(screen.getByText('Hidcote')).toBeInTheDocument()
    expect(screen.getByText('Westbury Court Garden')).toBeInTheDocument()
    expect(screen.queryByText('May Hill')).not.toBeInTheDocument()
  })

  it('filters by status', async () => {
    save({ 'may-hill': { status: 'gold', date: '2026-08-01', notes: '', photos: [] } })
    const user = userEvent.setup()
    renderLocations()

    await user.click(screen.getByRole('combobox', { name: 'Status' }))
    await user.click(screen.getByRole('option', { name: 'Gold' }))

    expect(screen.getByText('May Hill')).toBeInTheDocument()
    expect(screen.queryByText('Dyrham Park')).not.toBeInTheDocument()
  })

  it('sorts by name ascending by default', () => {
    renderLocations()
    const names = screen.getAllByRole('heading', { level: 6 }).map((el) => el.textContent)
    const sorted = [...names].sort((a, b) => (a ?? '').localeCompare(b ?? ''))
    expect(names).toEqual(sorted)
  })

  it('re-sorts the list when switching to progress order', async () => {
    save({
      'westbury-court-garden': { status: 'gold', date: '2026-08-01', notes: '', photos: [] },
      'dyrham-park': { status: 'silver', date: '2026-08-01', notes: '', photos: [] },
    })
    const user = userEvent.setup()
    renderLocations()

    const namesByName = screen.getAllByRole('heading', { level: 6 }).map((el) => el.textContent)

    await user.click(screen.getByRole('combobox', { name: 'Sort' }))
    await user.click(screen.getByRole('option', { name: 'Progress' }))

    const namesByProgress = screen.getAllByRole('heading', { level: 6 }).map((el) => el.textContent)
    expect(namesByProgress).not.toEqual(namesByName)
    expect([...namesByProgress].sort()).toEqual([...namesByName].sort())
  })
})
