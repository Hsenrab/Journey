import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import ChallengeDetails from './ChallengeDetails'
import { WaypointsProvider } from '../features/journey/JourneyContext'
import { createDefaultData, load, save } from '../services/storage'
import type { Activity } from '../domain/visit'

const lacockId = 'lacock-abbey-fox-talbot-museum-and-village'

function activity(waypointId: string, category: 'bronze' | 'silver' | 'gold'): Activity {
  return {
    activityId: `${waypointId}-${category}`,
    ideaIds: [],
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

function renderDashboard(challengeId = 'national-trust') {
  return render(
    <MemoryRouter initialEntries={[`/challenges/${challengeId}`]}>
      <WaypointsProvider>
        <Routes>
          <Route path="/challenges" element={<div>Challenges list</div>} />
          <Route path="/challenges/:challengeId" element={<ChallengeDetails />} />
        </Routes>
      </WaypointsProvider>
    </MemoryRouter>,
  )
}

describe('ChallengeDetails', () => {
  beforeEach(() => localStorage.clear())

  it('shows the selected challenge as ordinary data with a breadcrumb back to challenges', () => {
    renderDashboard()
    expect(screen.getByRole('heading', { level: 1, name: 'National Trust' })).toBeInTheDocument()
    expect(within(screen.getByTestId('detail-breadcrumbs')).getByRole('link', { name: 'Challenges' })).toHaveAttribute(
      'href',
      '/challenges',
    )
    expect(screen.getByRole('link', { name: 'View waypoints' })).toHaveAttribute(
      'href',
      '/waypoints?challenge=national-trust',
    )
    expect(screen.getByRole('link', { name: 'Add waypoint' })).toHaveAttribute(
      'href',
      '/waypoints?mode=add&challenge=national-trust',
    )
  })

  it('reports an unknown challenge explicitly', () => {
    renderDashboard('missing')
    expect(screen.getByText('Challenge not found.')).toBeInTheDocument()
  })

  it('shows progress for a custom challenge without activity categories', () => {
    const seed = createDefaultData()
    save({
      ...seed,
      waypoints: seed.waypoints.map((waypoint) =>
        waypoint.waypointId === lacockId
          ? { ...waypoint, challengeIds: [...waypoint.challengeIds, 'custom'] }
          : waypoint,
      ),
      challenges: [
        ...seed.challenges,
        {
          challengeId: 'custom',
          title: 'Custom challenge',
          description: 'A user-defined challenge.',
          waypointIds: [lacockId],
          supportsActivityCategories: false,
        },
      ],
    })

    renderDashboard('custom')

    expect(screen.getByRole('heading', { level: 1, name: 'Custom challenge' })).toBeInTheDocument()
    expect(screen.getByText('0 of 1 waypoints completed', { exact: false })).toBeInTheDocument()
    expect(screen.queryByText('Activity categories')).not.toBeInTheDocument()
  })

  it('edits a challenge without changing its waypoint links', async () => {
    const user = userEvent.setup()
    const before = createDefaultData().challenges[0]!
    renderDashboard()

    await user.click(screen.getByRole('button', { name: 'Edit challenge' }))
    await user.clear(screen.getByLabelText('Title'))
    await user.type(screen.getByLabelText('Title'), 'National Trust places')
    await user.click(screen.getByRole('button', { name: 'Save challenge' }))

    expect(screen.getByText('Challenge saved.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'National Trust places' })).toBeInTheDocument()
    expect(load().challenges[0]).toEqual({ ...before, title: 'National Trust places' })
  })

  it('reports an edit that would invalidate categorized activities', async () => {
    save({ ...createDefaultData(), activities: [activity(lacockId, 'gold')] })
    const user = userEvent.setup()
    renderDashboard()

    await user.click(screen.getByRole('button', { name: 'Edit challenge' }))
    await user.click(screen.getByLabelText('Supports Bronze, Silver and Gold activity categories'))
    await user.click(screen.getByRole('button', { name: 'Save challenge' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Activity categories cannot be turned off')
    expect(load().challenges[0]?.supportsActivityCategories).toBe(true)
  })

  it('explains destructive effects and deletes a challenge after confirmation', async () => {
    const seed = createDefaultData()
    save({ ...seed, activities: [activity(lacockId, 'gold')] })
    const user = userEvent.setup()
    renderDashboard()

    await user.click(screen.getByRole('button', { name: 'Delete challenge' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete challenge?' })
    expect(dialog).toHaveTextContent(`removes it from ${seed.waypoints.length} waypoints`)
    expect(dialog).toHaveTextContent('Bronze, Silver or Gold categories will be cleared from 1 of your activities')

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(load().challenges).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Delete challenge' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('Challenges list')).toBeInTheDocument()
    const saved = load()
    expect(saved.challenges).toEqual([])
    expect(saved.waypoints).toHaveLength(seed.waypoints.length)
    expect(saved.waypoints.every((waypoint) => waypoint.challengeIds.length === 0)).toBe(true)
    expect(saved.activities[0]).toEqual(expect.objectContaining({ waypointId: lacockId }))
    expect(saved.activities[0]).not.toHaveProperty('category')
    expect(saved.activities[0]).not.toHaveProperty('challengeId')
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

    expect(getByRole('link', { name: 'Bronze: 0 waypoints' })).toHaveAttribute(
      'href',
      '/waypoints?challenge=national-trust&status=bronze',
    )
    expect(getByRole('link', { name: 'Silver: 1 waypoint' })).toHaveAttribute(
      'href',
      '/waypoints?challenge=national-trust&status=silver',
    )
    expect(getByRole('link', { name: 'Gold: 0 waypoints' })).toHaveAttribute(
      'href',
      '/waypoints?challenge=national-trust&status=gold',
    )
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
