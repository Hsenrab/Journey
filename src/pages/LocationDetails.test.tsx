import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LocationDetails from './LocationDetails'
import { WaypointsProvider } from '../features/journey/JourneyContext'
import { createDemoModeData, load, save } from '../services/storage'

const demoWaypointId = 'demo-foxglove-manor'

function renderDetails(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/waypoints/${id}`]}>
      <WaypointsProvider>
        <Routes>
          <Route path="/waypoints/:id" element={<LocationDetails />} />
          <Route path="/waypoints" element={<div>Waypoint list</div>} />
        </Routes>
      </WaypointsProvider>
    </MemoryRouter>,
  )
}

describe('LocationDetails', () => {
  beforeEach(() => {
    localStorage.clear()
    save(createDemoModeData())
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('shows an error when the waypoint is not found', () => {
    renderDetails('does-not-exist')
    expect(screen.getByText('Waypoint not found.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Waypoints' })).toHaveAttribute('href', '/waypoints')
  })

  it('shows the waypoint details', () => {
    renderDetails(demoWaypointId)
    expect(screen.getByRole('heading', { name: 'Foxglove Manor (Demo)', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Waypoints' })).toHaveAttribute('href', '/waypoints')
  })

  it('shows completion progress separately from the award tier', () => {
    const seed = createDemoModeData()
    save({
      ...seed,
      waypoints: seed.waypoints.map((waypoint) =>
        waypoint.waypointId === demoWaypointId ? { ...waypoint, completion: { mode: 'count', target: 5 } } : waypoint,
      ),
      activities: ['a', 'b'].map((suffix) => ({
        activityId: `activity-${suffix}`,
        waypointId: demoWaypointId,
        ideaIds: [],
        date: '2026-08-02',
        category: 'silver' as const,
        notes: '',
        location: { kind: 'postcode' as const, postcode: 'SN15 2LG' },
        photoReferenceIds: [],
        referenceIds: [],
        createdAt: '2026-08-02T00:00:00.000Z',
        updatedAt: '2026-08-02T00:00:00.000Z',
      })),
    })
    renderDetails(demoWaypointId)

    expect(screen.getByText('Completion: 2 of 5 activities')).toBeInTheDocument()
    expect(screen.getByText('Completed after 5 logged activities.')).toBeInTheDocument()
    expect(screen.getByText('Award tier: Silver')).toBeInTheDocument()
    expect(screen.queryByText(/Category summary/)).not.toBeInTheDocument()
  })

  it('shows a once waypoint as not done until an activity is logged', () => {
    renderDetails('demo-lantern-hill-fort')

    expect(screen.getByText('Completion: Not done')).toBeInTheDocument()
    expect(screen.getByText('Completed after one logged activity.')).toBeInTheDocument()
    expect(screen.getByText('Award tier: Not Started')).toBeInTheDocument()
  })

  it('adds a linked activity', async () => {
    const user = userEvent.setup()
    renderDetails(demoWaypointId)

    await user.click(screen.getByRole('button', { name: 'Log activity' }))
    await user.type(screen.getByLabelText('Description / notes'), 'Wonderful visit')
    await user.click(screen.getByRole('combobox', { name: 'Activity category' }))
    await user.click(screen.getByRole('option', { name: 'Gold' }))
    await user.click(screen.getByRole('button', { name: 'Save activity' }))

    expect(screen.getByText('Activity saved.')).toBeInTheDocument()
    expect(screen.getByText('Completion: Done')).toBeInTheDocument()
    expect(load().activities).toContainEqual(
      expect.objectContaining({ waypointId: demoWaypointId, category: 'gold', notes: 'Wonderful visit' }),
    )
  })

  it('shows an error message for an invalid activity date', async () => {
    const user = userEvent.setup()
    renderDetails(demoWaypointId)

    await user.click(screen.getByRole('button', { name: 'Log activity' }))
    const dateInput = screen.getByLabelText('Activity date')
    await user.clear(dateInput)
    await user.type(dateInput, 'not-a-date')
    await user.click(screen.getByRole('button', { name: 'Save activity' }))

    expect(screen.getByText('Please enter a valid activity date in YYYY-MM-DD format.')).toBeInTheDocument()
    expect(load().activities).toEqual(createDemoModeData().activities)
  })

  it('shows ideas linked to the waypoint with derived usage', () => {
    const seed = createDemoModeData()
    save({
      ...seed,
      ideas: [
        {
          ideaId: 'idea-1',
          title: 'Scout route',
          description: '',
          notes: '',
          waypointIds: [demoWaypointId],
          planningState: 'active',
          difficulty: 1,
          referenceIds: [],
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
    })
    renderDetails(demoWaypointId)
    expect(screen.getByRole('heading', { name: 'Ideas' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Scout route' })).toHaveAttribute('href', '/ideas/idea-1')
    expect(screen.getByText('Active · Not used')).toBeInTheDocument()
  })

  it('edits a waypoint', async () => {
    const user = userEvent.setup()
    renderDetails(demoWaypointId)

    await user.click(screen.getByRole('button', { name: 'Edit waypoint' }))
    const titleInput = screen.getAllByLabelText('Title')[0]
    await user.clear(titleInput)
    await user.type(titleInput, 'Updated Foxglove Manor')
    await user.click(screen.getByRole('button', { name: 'Save waypoint' }))

    expect(screen.getByText('Waypoint saved.')).toBeInTheDocument()
    expect(load().waypoints.find((waypoint) => waypoint.waypointId === demoWaypointId)?.title).toBe(
      'Updated Foxglove Manor',
    )
  })

  it('deletes a waypoint after confirming linked activity and idea counts', async () => {
    const user = userEvent.setup()
    const seed = createDemoModeData()
    save({
      ...seed,
      ideas: [
        {
          ideaId: 'idea-1',
          title: 'Scout route',
          description: '',
          notes: '',
          waypointIds: [demoWaypointId],
          planningState: 'active',
          difficulty: 1,
          referenceIds: [],
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
      activities: [
        {
          activityId: 'activity-1',
          name: 'Abbey visit',
          waypointId: demoWaypointId,
          ideaIds: [],
          date: '2026-08-02',
          category: 'gold',
          notes: '',
          location: { kind: 'postcode', postcode: 'SN15 2LG' },
          photoReferenceIds: [],
          referenceIds: [],
          createdAt: '2026-08-02T00:00:00.000Z',
          updatedAt: '2026-08-02T00:00:00.000Z',
        },
      ],
    })
    renderDetails(demoWaypointId)

    await user.click(screen.getByRole('button', { name: 'Delete waypoint' }))

    expect(screen.getByText(/1 linked activity and 1 linked idea/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(screen.getByText('Waypoint list')).toBeInTheDocument()
    const data = load()
    expect(data.waypoints.some((waypoint) => waypoint.waypointId === demoWaypointId)).toBe(false)
    expect(data.activities[0]?.waypointId).toBeUndefined()
    expect(data.ideas[0]?.waypointIds).toEqual([])
  })

  it('links each logged activity card to its activity', () => {
    const seed = createDemoModeData()
    save({
      ...seed,
      activities: [
        {
          activityId: 'activity-1',
          name: 'Abbey cloisters walk',
          waypointId: demoWaypointId,
          ideaIds: [],
          date: '2026-08-02',
          category: 'gold',
          notes: '',
          location: { kind: 'postcode', postcode: 'SN15 2LG' },
          photoReferenceIds: [],
          referenceIds: [],
          createdAt: '2026-08-02T00:00:00.000Z',
          updatedAt: '2026-08-02T00:00:00.000Z',
        },
      ],
    })
    renderDetails(demoWaypointId)
    expect(screen.getByRole('heading', { name: 'Activity history' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abbey cloisters walk' })).toHaveAttribute('href', '/activities/activity-1')
  })

  it('does not offer waypoint mutations to a viewer', async () => {
    vi.stubEnv('MODE', 'production')
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ data: createDemoModeData(), etags: {}, role: 'viewer' }))),
    )

    renderDetails(demoWaypointId)

    expect(await screen.findByRole('heading', { name: 'Foxglove Manor (Demo)', level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Log activity' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add idea' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit waypoint' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete waypoint' })).not.toBeInTheDocument()
  })
})
