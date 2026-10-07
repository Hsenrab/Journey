import { render, screen, waitFor } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ActivityDetails from './ActivityDetails'
import { WaypointsProvider } from '../features/journey/JourneyContext'
import { load, save } from '../services/storage'
import { GpxGeometrySchema } from '../domain/visit'
import { createDemoTestData } from '../test/demoData'

const createDefaultData = createDemoTestData

function renderDetails(path = '/activities/a1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <WaypointsProvider>
        <Routes>
          <Route path="/activities/:activityId" element={<ActivityDetails />} />
          <Route path="/waypoints/:id" element={<div>Waypoint details</div>} />
          <Route path="/activities" element={<div>Activity log</div>} />
        </Routes>
      </WaypointsProvider>
    </MemoryRouter>,
  )
}

describe('ActivityDetails', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('shows not found for unknown ids', () => {
    renderDetails('/activities/missing')
    expect(screen.getByText('Activity not found.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Activities' })).toHaveAttribute('href', '/activities')
  })

  it('breadcrumbs an unlinked activity back to the activity log', async () => {
    const user = userEvent.setup()
    const seed = createDefaultData()
    save({
      ...seed,
      activities: [
        {
          activityId: 'a1',
          ideaIds: [],
          date: '2026-08-01',
          location: { kind: 'postcode', postcode: 'BA12 6QF' },
          notes: '',
          referenceIds: [],
          photoReferenceIds: [],
          createdAt: '2026-08-01T10:00:00.000Z',
          updatedAt: '2026-08-01T10:00:00.000Z',
        },
      ],
    })

    renderDetails()

    expect(screen.queryByRole('link', { name: 'View recorded track on map' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Activities' }))
    expect(screen.getByText('Activity log')).toBeInTheDocument()
  })

  it('breadcrumbs a linked activity back to its waypoint', async () => {
    const user = userEvent.setup()
    const seed = createDefaultData()
    save({
      ...seed,
      activities: [
        {
          activityId: 'a1',
          ideaIds: [],
          waypointId: 'demo-foxglove-manor',
          date: '2026-08-01',
          location: { kind: 'postcode', postcode: 'BA12 6QF' },
          notes: '',
          referenceIds: [],
          photoReferenceIds: [],
          createdAt: '2026-08-01T10:00:00.000Z',
          updatedAt: '2026-08-01T10:00:00.000Z',
        },
      ],
    })

    renderDetails()

    expect(screen.queryByRole('link', { name: 'Activities' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Foxglove Manor (Demo)' }))
    expect(screen.getByText('Waypoint details')).toBeInTheDocument()
  })

  it('renders linked references and photos', () => {
    const seed = createDefaultData()
    save({
      ...seed,
      ideas: [
        {
          ideaId: 'idea-1',
          title: 'Orangery idea',
          description: '',
          notes: '',
          waypointIds: ['demo-foxglove-manor'],
          planningState: 'active',
          difficulty: 1,
          referenceIds: [],
          createdAt: '2026-07-01T00:00:00.000Z',
          updatedAt: '2026-07-01T00:00:00.000Z',
        },
      ],
      references: [...seed.references, { referenceId: 'r1', title: 'Guide', url: 'https://example.com/guide' }],
      photoReferences: [{ photoReferenceId: 'p1', title: 'View', url: 'https://example.com/view.jpg' }],
      activities: [
        {
          activityId: 'a1',
          ideaIds: ['idea-1'],
          waypointId: 'demo-foxglove-manor',
          date: '2026-08-01',
          category: 'gold',
          location: { kind: 'postcode', postcode: 'BA12 6QF' },
          notes: 'Excellent visit',
          referenceIds: ['r1'],
          photoReferenceIds: ['p1'],
          createdAt: '2026-08-01T10:00:00.000Z',
          updatedAt: '2026-08-01T10:00:00.000Z',
        },
      ],
    })

    renderDetails()

    expect(
      screen.getByRole('heading', { name: new Date('2026-08-01T00:00:00').toLocaleDateString(), level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Foxglove Manor (Demo)').length).toBeGreaterThan(0)
    expect(screen.getByText('Guide')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'View' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Orangery idea' })).toBeInTheDocument()
  })

  it('links an attached recorded track to the existing map page', () => {
    const seed = createDefaultData()
    save({
      ...seed,
      activities: [
        {
          activityId: 'a1',
          ideaIds: [],
          date: '2026-08-01',
          location: { kind: 'postcode', postcode: 'BA12 6QF' },
          recordedTrack: GpxGeometrySchema.parse({
            type: 'MultiLineString',
            coordinates: [
              [
                [-2.1, 51.5],
                [-2.2, 51.6],
              ],
            ],
          }),
          notes: '',
          referenceIds: [],
          photoReferenceIds: [],
          createdAt: '2026-08-01T10:00:00.000Z',
          updatedAt: '2026-08-01T10:00:00.000Z',
        },
      ],
    })

    renderDetails()

    expect(screen.getByRole('link', { name: 'View recorded track on map' })).toHaveAttribute(
      'href',
      '/map?activityId=a1',
    )
  })

  it('updates the map action as a recorded track is attached and removed', async () => {
    const user = userEvent.setup()
    const seed = createDefaultData()
    save({
      ...seed,
      activities: [
        {
          activityId: 'a1',
          ideaIds: [],
          date: '2026-08-01',
          location: { kind: 'postcode', postcode: 'BA12 6QF' },
          notes: '',
          referenceIds: [],
          photoReferenceIds: [],
          createdAt: '2026-08-01T10:00:00.000Z',
          updatedAt: '2026-08-01T10:00:00.000Z',
        },
      ],
    })
    renderDetails()

    expect(screen.queryByRole('link', { name: 'View recorded track on map' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Edit activity' }))
    await user.upload(
      screen.getByLabelText('GPX track file'),
      new File(
        ['<gpx><trk><trkseg><trkpt lat="51.1" lon="-2.1"/><trkpt lat="51.2" lon="-2.2"/></trkseg></trk></gpx>'],
        'track.gpx',
        { type: 'application/gpx+xml' },
      ),
    )
    expect(await screen.findByText('A recorded GPX track is attached.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('link', { name: 'View recorded track on map' })).toHaveAttribute(
      'href',
      '/map?activityId=a1',
    )

    await user.click(screen.getByRole('button', { name: 'Edit activity' }))
    await user.click(screen.getByRole('button', { name: 'Remove GPX track' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: 'View recorded track on map' })).not.toBeInTheDocument(),
    )
  })

  it('renders empty optional fields and invalid reference hostnames', () => {
    const seed = createDefaultData()
    save({
      ...seed,
      references: [{ referenceId: 'r1', title: 'Link', url: 'https://example.com' }],
      activities: [
        {
          activityId: 'a1',
          ideaIds: [],
          date: '2026-08-01',
          location: { kind: 'postcode', postcode: 'BA12 6QF' },
          notes: '',
          referenceIds: ['r1'],
          photoReferenceIds: [],
          createdAt: '2026-08-01T10:00:00.000Z',
          updatedAt: '2026-08-01T10:00:00.000Z',
        },
      ],
    })
    renderDetails()

    expect(screen.getByText('No description recorded.')).toBeInTheDocument()
    expect(screen.getByText('No photos linked to this activity.')).toBeInTheDocument()
    expect(screen.getByText('example.com')).toBeInTheDocument()
  })

  it('does not offer activity mutations to a viewer', async () => {
    vi.stubEnv('MODE', 'production')
    const seed = createDefaultData()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              ...seed,
              activities: [
                {
                  activityId: 'a1',
                  ideaIds: [],
                  date: '2026-08-01',
                  location: { kind: 'postcode', postcode: 'BA12 6QF' },
                  notes: '',
                  referenceIds: [],
                  photoReferenceIds: [],
                  createdAt: '2026-08-01T10:00:00.000Z',
                  updatedAt: '2026-08-01T10:00:00.000Z',
                },
              ],
            },
            etags: {},
            role: 'viewer',
          }),
        ),
      ),
    )

    renderDetails()

    expect(
      await screen.findByRole('heading', { name: new Date('2026-08-01T00:00:00').toLocaleDateString(), level: 1 }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit activity' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete activity' })).not.toBeInTheDocument()
  })

  it('deletes an activity after confirmation', async () => {
    const user = userEvent.setup()
    const seed = createDefaultData()
    save({
      ...seed,
      references: [...seed.references, { referenceId: 'r1', title: 'Guide', url: 'https://example.com/guide' }],
      activities: [
        {
          activityId: 'a1',
          ideaIds: [],
          waypointId: 'demo-foxglove-manor',
          date: '2026-08-01',
          category: 'gold',
          location: { kind: 'postcode', postcode: 'BA12 6QF' },
          notes: 'Excellent visit',
          referenceIds: ['r1'],
          photoReferenceIds: [],
          createdAt: '2026-08-01T10:00:00.000Z',
          updatedAt: '2026-08-01T10:00:00.000Z',
        },
      ],
    })

    renderDetails()

    await user.click(screen.getByRole('button', { name: 'Delete activity' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(load().activities).toEqual([])
    expect(load().references.some((reference) => reference.referenceId === 'r1')).toBe(false)
  })

  it('keeps the delete success visible when the post-delete reload fails', async () => {
    vi.stubEnv('MODE', 'production')
    const user = userEvent.setup()
    const seed = createDefaultData()
    const activity = {
      activityId: 'a1',
      ideaIds: [],
      waypointId: 'demo-foxglove-manor',
      date: '2026-08-01',
      category: 'gold' as const,
      location: { kind: 'postcode' as const, postcode: 'BA12 6QF' },
      notes: 'Excellent visit',
      referenceIds: [],
      photoReferenceIds: [],
      createdAt: '2026-08-01T10:00:00.000Z',
      updatedAt: '2026-08-01T10:00:00.000Z',
    }
    const withActivity = { ...seed, activities: [activity] }
    const withoutActivity = { ...seed, activities: [] }
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ data: withActivity, etags: {}, role: 'admin' })))
        .mockResolvedValueOnce(new Response(JSON.stringify({ data: withoutActivity, etags: {} })))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'unavailable' }), { status: 500, statusText: 'Broken' }),
        ),
    )

    renderDetails()

    expect(
      await screen.findByRole('heading', { name: new Date('2026-08-01T00:00:00').toLocaleDateString(), level: 1 }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete activity' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText(/Activity was deleted, but latest data could not be loaded/)).toBeInTheDocument()
    expect(screen.getByText(/Production data could not be loaded/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload latest' })).toBeInTheDocument()
    expect(screen.queryByText('Activity not found.')).not.toBeInTheDocument()
  })

  it('keeps data unchanged when delete is cancelled', async () => {
    const user = userEvent.setup()
    const seed = createDefaultData()
    save({
      ...seed,
      activities: [
        {
          activityId: 'a1',
          ideaIds: [],
          waypointId: 'demo-foxglove-manor',
          date: '2026-08-01',
          category: 'gold',
          location: { kind: 'postcode', postcode: 'BA12 6QF' },
          notes: 'Excellent visit',
          referenceIds: [],
          photoReferenceIds: [],
          createdAt: '2026-08-01T10:00:00.000Z',
          updatedAt: '2026-08-01T10:00:00.000Z',
        },
      ],
    })

    renderDetails()

    await user.click(screen.getByRole('button', { name: 'Delete activity' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(load().activities).toHaveLength(1)
  })

  it('supports editing and photo navigation', async () => {
    const user = userEvent.setup()
    const seed = createDefaultData()
    save({
      ...seed,
      photoReferences: [
        {
          photoReferenceId: 'p1',
          title: 'View one',
          url: 'https://example.com/one.jpg',
          altText: 'First photo alt text',
        },
        { photoReferenceId: 'p2', title: 'View two', url: 'https://example.com/two.jpg' },
        { photoReferenceId: 'p3', title: 'View three', url: 'https://example.com/three.jpg' },
      ],
      activities: [
        {
          activityId: 'a1',
          ideaIds: [],
          waypointId: 'demo-foxglove-manor',
          date: '2026-08-01',
          category: 'gold',
          location: { kind: 'postcode', postcode: 'BA12 6QF' },
          notes: 'Excellent visit',
          referenceIds: [],
          photoReferenceIds: ['p1', 'p2', 'p3'],
          createdAt: '2026-08-01T10:00:00.000Z',
          updatedAt: '2026-08-01T10:00:00.000Z',
        },
      ],
    })

    renderDetails()

    expect(screen.getAllByRole('button', { name: /^Show photo/ })).toHaveLength(3)
    expect(screen.getByRole('img', { name: 'First photo alt text' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'First photo alt text' })).toHaveStyle({ objectFit: 'contain' })

    await user.click(screen.getByRole('button', { name: 'Next photo' }))
    expect(screen.getByRole('status')).toHaveTextContent('2 of 3: View two')
    await user.click(screen.getByRole('button', { name: 'Previous photo' }))
    expect(screen.getByRole('status')).toHaveTextContent('1 of 3: View one')

    const gallery = screen.getByRole('region', { name: /Photos for/ })
    fireEvent.keyDown(gallery, { key: 'ArrowRight' })
    expect(screen.getByRole('status')).toHaveTextContent('2 of 3: View two')
    await user.click(screen.getByRole('button', { name: 'Show photo 3: View three' }))
    expect(screen.getByRole('status')).toHaveTextContent('3 of 3: View three')

    fireEvent.touchStart(gallery, {
      touches: [{ identifier: 1, target: gallery, clientX: 100, clientY: 10 }],
    })
    fireEvent.touchEnd(gallery, {
      changedTouches: [{ identifier: 1, target: gallery, clientX: 40, clientY: 10 }],
      touches: [],
    })
    expect(screen.getByRole('status')).toHaveTextContent('1 of 3: View one')

    const img = screen.getByRole('img', { name: 'First photo alt text' })
    fireEvent.error(img)
    expect(screen.queryByRole('img', { name: 'First photo alt text' })).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Image failed to load: View one')
    expect(screen.getByText('Image failed to load: View one')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show photo 1: View one, failed to load' })).toHaveTextContent('Failed')

    await user.click(screen.getByRole('button', { name: 'Edit activity' }))
    await user.clear(screen.getByLabelText('Description / notes'))
    await user.type(screen.getByLabelText('Description / notes'), 'Updated notes')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(load().activities[0]?.notes).toBe('Updated notes')
    expect(screen.getByText('Activity updated.')).toBeInTheDocument()
  })
})
