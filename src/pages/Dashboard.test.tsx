import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import Dashboard from './Dashboard'
import { JourneyProvider } from '../features/journey/JourneyContext'
import { locations } from '../data/locations'
import { save } from '../services/storage'

function renderDashboard() {
  return render(
    <JourneyProvider>
      <Dashboard />
    </JourneyProvider>,
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
      lyme: { status: 'silver', date: '2026-08-01', notes: '', photos: [] },
      'quarry-bank': { status: 'gold', date: '2026-08-01', notes: '', photos: [] },
      'hare-hill': { status: 'bronze', date: '2026-08-01', notes: '', photos: [] },
    })

    renderDashboard()

    expect(
      screen.getByText(`2 of ${locations.length} main experiences completed`, { exact: false }),
    ).toBeInTheDocument()
  })

  it('derives status counts per location', () => {
    save({
      lyme: { status: 'silver', date: '2026-08-01', notes: '', photos: [] },
    })

    const { getByText } = renderDashboard()

    const silverCard = getByText('Silver').closest('div')
    expect(silverCard).toHaveTextContent('1')

    const notStartedCard = getByText('Not Started').closest('div')
    expect(notStartedCard).toHaveTextContent(String(locations.length - 1))
  })
})
