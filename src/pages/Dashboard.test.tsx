import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import Dashboard from './Dashboard'
import { JourneyProvider } from '../features/journey/JourneyContext'
import { locations } from '../data/locations'
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
    save({ visits: [visit('lacock-abbey', 'silver'), visit('stourhead', 'gold'), visit('cliveden', 'bronze')] })

    renderDashboard()

    expect(
      screen.getByText(`2 of ${locations.length} main experiences completed`, { exact: false }),
    ).toBeInTheDocument()
  })

  it('derives status counts per location', () => {
    save({ visits: [visit('lacock-abbey', 'silver')] })

    const { getByText } = renderDashboard()

    const silverCard = getByText('Silver').closest('div')
    expect(silverCard).toHaveTextContent('1')

    const notStartedCard = getByText('Not Started').closest('div')
    expect(notStartedCard).toHaveTextContent(String(locations.length - 1))
  })
})
