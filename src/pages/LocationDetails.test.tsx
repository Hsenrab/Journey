import { submitActivity } from '../test/activityActions'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { MemoryRouter } from '../test/DataMemoryRouter'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LocationDetails from './LocationDetails'
import { WaypointsProvider, useWaypoints } from '../features/journey/JourneyContext'
import { challengeJourneyState } from '../features/journey/challengeJourney'
import { createAwardTestData, createJourneyTestData } from '../test/demoData'
import { createDemoModeData, load, save } from '../services/storage'

const demoWaypointId = 'demo-foxglove-manor'

function DatasetControls() {
  const { reload, deleteActivity, updateActivity, data } = useWaypoints()
  const last = data.activities.at(-1)
  return (
    <>
      <button onClick={() => void reload()}>Reload dataset</button>
      {last && (
        <button
          onClick={() =>
            void updateActivity(last.activityId, {
              ...last,
              waypointId: 'one-count',
              references: last.referenceIds.map((id) => data.references.find((item) => item.referenceId === id)!),
              photoReferences: last.photoReferenceIds.map((id) =>
                data.photoReferences.find((item) => item.photoReferenceId === id)!,
              ),
            })
          }
        >
          Reassign saved Activity
        </button>
      )}
      {last && <button onClick={() => void deleteActivity(last.activityId)}>Delete saved Activity</button>}
    </>
  )
}

function renderDetails(id: string, state?: unknown, controls = false) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: `/waypoints/${id}`, state }]}>
      <WaypointsProvider>
        {controls && <DatasetControls />}
        <Routes>
          <Route path="/waypoints/:id" element={<LocationDetails />} />
          <Route path="/waypoints" element={<div>Waypoint list</div>} />
        </Routes>
      </WaypointsProvider>
    </MemoryRouter>,
  )
}

describe('LocationDetails', () => {
  it('keeps applicable unrecorded awards separate from completion throughout originated recording', async () => {
    const data = createAwardTestData()
    save(data)
    renderDetails(
      'award-w3',
      challengeJourneyState('award-a', 'award-w3', {
        dataMode: 'production',
        activeDataMode: 'production',
        loaded: true,
      }),
    )
    expect(screen.getByText('Completion: Not done')).toBeInTheDocument()
    expect(screen.getByText('Highest recorded award: No award recorded')).toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Log activity' }))
    await user.click(screen.getByRole('button', { name: 'Save activity' }))
    expect(screen.getByText('Select Bronze, Silver or Gold.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Award Challenge A' })).toBeInTheDocument()
    expect(load().activities).toEqual(data.activities)
  })

  it('does not retain current-looking progress after a Production reload fails', async () => {
    vi.stubEnv('MODE', 'production')
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ data: createJourneyTestData(true), etags: {}, role: 'admin' })),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'Specific Production load failure' }), {
            status: 503,
            statusText: 'Service Unavailable',
          }),
        ),
    )
    renderDetails('once', undefined, true)
    expect(await screen.findByText('Completion: Done')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reload dataset' }))
    expect(await screen.findByText(/Journey API request failed with 503: Service Unavailable/)).toBeInTheDocument()
    expect(screen.queryByText('Completion: Done')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Log activity' })).not.toBeInTheDocument()
  })

  it('derives saved contribution from current records after loaded reassignment and deletion', async () => {
    save(createJourneyTestData())
    renderDetails(
      'once',
      challengeJourneyState('journey', 'once', { dataMode: 'production', activeDataMode: 'production', loaded: true }),
      true,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Log activity' }))
    fireEvent.change(screen.getByLabelText('Activity title'), { target: { value: 'A visit' } })
    fireEvent.change(screen.getByLabelText('Postcode'), { target: { value: 'GL1' } })
    await user.click(screen.getByRole('button', { name: 'Save activity' }))
    expect(await screen.findByRole('status', { name: 'Activity saved confirmation' })).toHaveTextContent(
      'This Activity contributes to Discovery Challenge.',
    )
    await user.click(screen.getByRole('button', { name: 'Reassign saved Activity' }))
    expect(await screen.findByText('This Activity does not contribute to Discovery Challenge.')).toBeInTheDocument()
    expect(screen.getByText('Completion: Not done')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Back to Discovery Challenge' })).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Delete saved Activity' }))
    expect(await screen.findByText('This Activity is no longer present in the loaded data.')).toBeInTheDocument()
    expect(screen.getByText('Completion: Not done')).toBeInTheDocument()
    expect(screen.queryByText(/This Activity contributes to Discovery Challenge/)).not.toBeInTheDocument()
  })

  beforeEach(() => {
    localStorage.clear()
    save(createDemoModeData())
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('retains the assignment draft when removing category support would invalidate awards', async () => {
    const user = userEvent.setup()
    const before = load()
    renderDetails(demoWaypointId)
    await user.click(screen.getByRole('button', { name: 'Edit waypoint' }))
    const challenge = before.challenges.find((item) => item.challengeId === 'national-trust')!
    const chip = screen.getByText(challenge.title).closest('.MuiChip-root')!
    fireEvent.click(chip.querySelector('[data-testid="CancelIcon"]')!)
    await user.click(screen.getByRole('button', { name: 'Save waypoint' }))
    expect(await screen.findByText(/has an award but its Waypoint does not support awards/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save waypoint' })).toBeInTheDocument()
    expect(load()).toEqual(before)
  })

  it('keeps a failed remote location edit and its coordinates visible until an explicit successful resave', async () => {
    vi.stubEnv('MODE', 'production')
    const data = createDemoModeData()
    const original = data.waypoints.find((item) => item.waypointId === demoWaypointId)!
    original.location = { placeName: 'Old place', latitude: 51, longitude: -2 }
    let writes = 0
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        if (!init?.body) return new Response(JSON.stringify({ data, etags: {}, role: 'admin' }))
        const body = JSON.parse(String(init.body))
        const edited = body.data.waypoints.find((item: { waypointId: string }) => item.waypointId === demoWaypointId)
        expect(edited.location).toEqual({ placeName: 'New place' })
        writes += 1
        if (writes === 1)
          return new Response(JSON.stringify({ error: 'No position found for New place' }), {
            status: 400,
            statusText: 'Bad Request',
          })
        edited.location = { placeName: 'New place', latitude: 52, longitude: -3 }
        return new Response(JSON.stringify({ data: body.data, etags: { [demoWaypointId]: 'resolved' } }))
      }),
    )
    renderDetails(demoWaypointId)
    fireEvent.click(await screen.findByRole('button', { name: 'Edit waypoint' }))
    fireEvent.change(screen.getByLabelText('Place name'), { target: { value: 'New place' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save waypoint' }))
    expect(await screen.findByText(/400: Bad Request: No position found for New place/)).toBeInTheDocument()
    expect(screen.getByLabelText('Place name')).toHaveValue('New place')
    expect(screen.getByLabelText('Latitude')).toHaveValue('51')
    expect(screen.queryByText('Waypoint saved.')).not.toBeInTheDocument()
    expect(writes).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Save waypoint' }))
    expect(await screen.findByText('Waypoint saved.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Edit waypoint' }))
    expect(screen.getByLabelText('Latitude')).toHaveValue('52')
    expect(screen.getByLabelText('Longitude')).toHaveValue('-3')
    expect(writes).toBe(2)
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
        name: 'Recorded activity',
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
    expect(screen.getByText('Highest recorded award: Silver')).toBeInTheDocument()
    expect(screen.queryByText(/Category summary/)).not.toBeInTheDocument()
  })

  it('shows a once waypoint as not done until an activity is logged', () => {
    renderDetails('demo-lantern-hill-fort')

    expect(screen.getByText('Completion: Not done')).toBeInTheDocument()
    expect(screen.getByText('Completed after one logged activity.')).toBeInTheDocument()
    expect(screen.getByText('Highest recorded award: No award recorded')).toBeInTheDocument()
  })

  it('adds a linked activity', async () => {
    const user = userEvent.setup()
    renderDetails(demoWaypointId)

    await user.click(screen.getByRole('button', { name: 'Log activity' }))
    await user.type(screen.getByLabelText('Description / notes'), 'Wonderful visit')
    await user.click(screen.getByRole('combobox', { name: 'Award tier' }))
    await user.click(screen.getByRole('option', { name: 'Gold' }))
    await submitActivity(user, 'Save activity')

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
    await submitActivity(user, 'Save activity')

    expect(screen.getByText('Activity date must use YYYY-MM-DD format.')).toBeInTheDocument()
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

  it('blocks deleting an awarded Waypoint without silently detaching its history', async () => {
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

    expect(screen.getByText(/This Waypoint has recorded awards and cannot be deleted/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('activity-1')
    const data = load()
    expect(data.waypoints.some((waypoint) => waypoint.waypointId === demoWaypointId)).toBe(true)
    expect(data.activities[0]).toMatchObject({ waypointId: demoWaypointId, category: 'gold' })
    expect(data.ideas[0]?.waypointIds).toEqual([demoWaypointId])
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
    expect(screen.getByText(/Your Journey access is viewer only/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Change the data mode in Settings' })).toHaveAttribute('href', '/settings')
  })
})
