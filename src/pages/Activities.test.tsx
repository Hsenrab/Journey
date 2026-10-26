import { submitActivity } from '../test/activityActions'
import { MemoryRouter } from '../test/DataMemoryRouter'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Activities from './Activities'
import { WaypointsProvider } from '../features/journey/JourneyContext'
import { createDefaultData, load, save } from '../services/storage'
import type { Activity } from '../domain/visit'
import { createDemoTestData, createAwardTestData } from '../test/demoData'

function renderActivities(path = '/activities') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <WaypointsProvider>
        <Activities />
      </WaypointsProvider>
    </MemoryRouter>,
  )
}

describe('Activities', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it.each([
    ['bronze', 2],
    ['silver', 1],
    ['gold', 1],
  ])('shows the exact scoped %s Activity group', (award, count) => {
    save(createAwardTestData())
    renderActivities(`/activities?challenge=award-a&award=${award}`)
    expect(document.querySelectorAll('.MuiCard-root')).toHaveLength(count)
    expect(screen.getByRole('link', { name: 'Back to Award Challenge A Statistics' })).toHaveAttribute(
      'href',
      '/challenges/award-a#statistics',
    )
  })

  it('rejects unsupported award filters instead of showing an unfiltered list', () => {
    save(createAwardTestData())
    renderActivities('/activities?challenge=ordinary&award=gold')
    expect(screen.getByRole('alert')).toHaveTextContent('Award filters do not apply to an ordinary Challenge.')
    expect(document.querySelectorAll('.MuiCard-root')).toHaveLength(0)
  })

  it('omits awards from ordinary shared-member visits', () => {
    save(createAwardTestData())
    renderActivities('/activities?challenge=ordinary')
    expect(document.querySelectorAll('.MuiCard-root')).toHaveLength(4)
    expect(screen.queryByText(/Recorded award:/)).not.toBeInTheDocument()
  })

  it('shows an empty state when there are no activities', () => {
    renderActivities()
    expect(screen.getByText('No activities logged yet.')).toBeInTheDocument()
  })

  it('preserves entered values when validation fails', async () => {
    const user = userEvent.setup()
    renderActivities()

    await user.click(screen.getByRole('button', { name: 'Add activity' }))
    await user.click(screen.getByRole('combobox', { name: 'Location type' }))
    await user.click(screen.getByRole('option', { name: 'Latitude and longitude' }))
    await user.type(screen.getByLabelText('Latitude'), 'not-a-number')
    await user.type(screen.getByLabelText('Longitude'), '-1.26')
    await submitActivity(user, 'Save activity')

    expect(screen.getByText('Latitude and longitude must be numeric.')).toBeInTheDocument()
    expect(screen.getByLabelText('Latitude')).toHaveValue('not-a-number')
    expect(load().activities).toEqual([])
  })

  it('cancels adding an activity without saving it', async () => {
    const user = userEvent.setup()
    renderActivities()

    await user.click(screen.getByRole('button', { name: 'Add activity' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByRole('button', { name: 'Add activity' })).toBeInTheDocument()
    expect(load().activities).toEqual([])
  })

  it('saves an independent activity with postcode location', async () => {
    const user = userEvent.setup()
    renderActivities()

    await user.click(screen.getByRole('button', { name: 'Add activity' }))
    await user.type(screen.getByLabelText('Postcode'), 'GL1 1AA')
    await user.type(screen.getByLabelText('Description / notes'), 'Evening walk')
    await submitActivity(user, 'Save activity')

    expect(screen.getByText('Activity saved.')).toBeInTheDocument()
    expect(load().activities[0]).toMatchObject({
      location: { kind: 'postcode', postcode: 'GL1 1AA' },
      notes: 'Evening walk',
    })
  })

  it('shows required activity titles, supporting dates, waypoint labels and detail counts', () => {
    const seed = createDemoTestData()
    const namedActivity: Activity = {
      activityId: 'a1',
      ideaIds: [],
      waypointId: 'demo-foxglove-manor',
      challengeId: 'national-trust',
      date: '2026-08-01',
      name: 'Summer visit',
      category: 'gold',
      location: { kind: 'postcode', postcode: 'BA12 6QF' },
      notes: '',
      referenceIds: ['ref-1'],
      photoReferenceIds: ['photo-1'],
      createdAt: '2026-08-01T10:00:00.000Z',
      updatedAt: '2026-08-01T10:00:00.000Z',
    }
    const independentActivity: Activity = {
      name: 'Independent walk',
      activityId: 'a2',
      ideaIds: [],
      date: '2026-08-02',
      location: { kind: 'postcode', postcode: 'GL1 1AA' },
      notes: '',
      referenceIds: [],
      photoReferenceIds: [],
      createdAt: '2026-08-02T10:00:00.000Z',
      updatedAt: '2026-08-02T10:00:00.000Z',
    }
    save({ ...seed, activities: [namedActivity, independentActivity] })

    renderActivities()

    expect(screen.getByRole('link', { name: 'Summer visit' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Independent walk' })).toBeInTheDocument()
    expect(screen.getByText(new Date('2026-08-02T00:00:00').toLocaleDateString())).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View Foxglove Manor (Demo) waypoint' })).toHaveAttribute(
      'href',
      '/waypoints/demo-foxglove-manor',
    )
    expect(screen.getByText('1 photo')).toBeInTheDocument()
    expect(screen.getByText('1 link')).toBeInTheDocument()
  })

  it('shows a loading notice instead of the empty state while production data is in flight', async () => {
    vi.stubEnv('MODE', 'production')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => new Promise<Response>(() => {})),
    )

    renderActivities()

    expect(await screen.findByText('Loading activities…')).toBeInTheDocument()
    expect(screen.queryByText('No activities logged yet.')).not.toBeInTheDocument()
  })

  it('does not offer activity mutations to a viewer', async () => {
    vi.stubEnv('MODE', 'production')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: createDefaultData(), etags: {}, role: 'viewer' }))),
    )

    renderActivities()

    expect(await screen.findByText('No activities logged yet.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add activity' })).not.toBeInTheDocument()
    expect(screen.getByText(/Your Journey access is viewer only/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Change the data mode in Settings' })).toHaveAttribute('href', '/settings')
  })
})
