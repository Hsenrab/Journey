import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import Dashboard from './Dashboard'
import { JourneyProvider } from '../features/journey/JourneyContext'
import { locations } from '../data/locations'
import { save } from '../services/storage'

function renderDashboard() {
  return render(
    <MemoryRouter>
      <JourneyProvider>
        <Dashboard />
      </JourneyProvider>
    </MemoryRouter>,
  )
}

describe('Dashboard', () => {
  beforeEach(() => localStorage.clear())

  it('shows zero progress when no visits are recorded', () => {
    renderDashboard()
    expect(
      screen.getByText(`0 of ${locations.length} main experiences completed`, { exact: false }),
    ).toBeInTheDocument()
  })

  it('counts silver and gold visits as complete, but not bronze', () => {
    save({
      'chedworth-roman-villa': { status: 'silver', date: '2026-08-01', notes: '', photos: [] },
      'dyrham-park': { status: 'gold', date: '2026-08-01', notes: '', photos: [] },
      hidcote: { status: 'bronze', date: '2026-08-01', notes: '', photos: [] },
    })

    renderDashboard()

    expect(
      screen.getByText(`2 of ${locations.length} main experiences completed`, { exact: false }),
    ).toBeInTheDocument()
  })

  it('derives status counts per location', () => {
    save({
      'chedworth-roman-villa': { status: 'silver', date: '2026-08-01', notes: '', photos: [] },
    })

    const { getByRole } = renderDashboard()

    const silverCard = getByRole('heading', { name: 'Silver' }).closest('div')
    expect(silverCard).toHaveTextContent('1')

    const notStartedCard = getByRole('heading', { name: 'Not Started' }).closest('div')
    expect(notStartedCard).toHaveTextContent(String(locations.length - 1))
  })
})
