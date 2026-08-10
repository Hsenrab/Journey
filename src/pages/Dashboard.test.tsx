import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import Dashboard from './Dashboard'
import { WaypointsProvider } from '../features/journey/JourneyContext'
import { createDefaultData, save } from '../services/storage'
import type { Activity } from '../domain/visit'

const lacockId = 'lacock-abbey-fox-talbot-museum-and-village'

function activity(waypointId: string, status: 'bronze' | 'silver' | 'gold'): Activity {
  return {
    activityId: `${waypointId}-${status}`,
    waypointId,
    challengeId: 'national-trust',
    date: '2026-08-01',
    status,
    location: { placeName: waypointId },
    notes: '',
    photos: [],
    referenceIds: [],
    photoReferenceIds: [],
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  }
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <WaypointsProvider>
        <Dashboard />
      </WaypointsProvider>
    </MemoryRouter>,
  )
}

describe('Dashboard', () => {
  beforeEach(() => localStorage.clear())

  it('shows one clear National Trust Challenge header', () => {
    renderDashboard()
    expect(screen.getAllByText('National Trust Challenge', { exact: true })).toHaveLength(1)
  })

  it('shows zero progress when no activities are recorded', () => {
    const seed = createDefaultData()
    renderDashboard()
    expect(screen.getByText('0% complete')).toBeInTheDocument()
    expect(screen.getByText(`0 of ${seed.waypoints.length} waypoints completed`, { exact: false })).toBeInTheDocument()
  })

  it('counts completed waypoints when any activity exists (including bronze)', () => {
    const seed = createDefaultData()
    save({
      ...seed,
      activities: [activity(lacockId, 'silver'), activity('stourhead', 'gold'), activity('cliveden', 'bronze')],
    })

    renderDashboard()

    expect(screen.getByText(`3 of ${seed.waypoints.length} waypoints completed`, { exact: false })).toBeInTheDocument()
  })

  it('derives status counts per waypoint and links each to a filtered Waypoints view', () => {
    save({ ...createDefaultData(), activities: [activity(lacockId, 'silver')] })

    const { getByRole } = renderDashboard()

    const silverCard = getByRole('heading', { name: 'Silver' }).closest('div')
    expect(silverCard).toHaveTextContent('1')

    expect(getByRole('link', { name: 'Bronze 0' })).toHaveAttribute('href', '/waypoints?status=bronze')
    expect(getByRole('link', { name: 'Silver 1' })).toHaveAttribute('href', '/waypoints?status=silver')
    expect(getByRole('link', { name: 'Gold 0' })).toHaveAttribute('href', '/waypoints?status=gold')
  })

  it('formats recent activity dates for the user locale', () => {
    save({ ...createDefaultData(), activities: [activity(lacockId, 'silver')] })

    renderDashboard()

    expect(screen.getByText(new Date('2026-08-01T00:00:00').toLocaleDateString(), { exact: false })).toBeInTheDocument()
  })

  it('makes recent-waypoint rows keyboard accessible links to the waypoint', () => {
    save({ ...createDefaultData(), activities: [activity(lacockId, 'silver')] })

    const { getByRole } = renderDashboard()

    expect(getByRole('link', { name: /Lacock Abbey/ })).toHaveAttribute('href', `/waypoints/${lacockId}`)
  })
})
