import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import Ideas from './Ideas'
import { WaypointsProvider } from '../features/journey/JourneyContext'
import { createDefaultData, load, save } from '../services/storage'

function renderIdeas(path = '/ideas') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <WaypointsProvider>
        <Routes>
          <Route path="/ideas" element={<Ideas />} />
        </Routes>
      </WaypointsProvider>
    </MemoryRouter>,
  )
}

describe('Ideas', () => {
  beforeEach(() => localStorage.clear())

  it('creates an idea with required fields and a linked waypoint', async () => {
    const user = userEvent.setup()
    renderIdeas('/ideas?mode=add')

    await user.type(screen.getByLabelText('Title'), 'Weekend hill walk')
    await user.click(screen.getByRole('combobox', { name: 'Linked waypoints' }))
    await user.click(screen.getAllByRole('option')[0]!)
    await user.click(screen.getByRole('button', { name: 'Save idea' }))

    expect(load().ideas[0]).toMatchObject({
      title: 'Weekend hill walk',
      planningState: 'active',
      difficulty: 1,
    })
  })

  it('requires a rejection reason for rejected ideas', async () => {
    const user = userEvent.setup()
    renderIdeas('/ideas?mode=add')

    await user.type(screen.getByLabelText('Title'), 'Night lake swim')
    await user.click(screen.getByRole('combobox', { name: 'Planning state' }))
    await user.click(screen.getByRole('option', { name: 'Rejected' }))
    await user.click(screen.getByRole('button', { name: 'Save idea' }))

    expect(screen.getByText('Rejection reason is required.')).toBeInTheDocument()
    expect(load().ideas).toHaveLength(0)
  })

  it('searches by reference hostname and filters by usage', async () => {
    const seed = createDefaultData()
    save({
      ...seed,
      references: [...seed.references, { referenceId: 'ref-1', title: 'Trail', url: 'https://example.com/trail' }],
      ideas: [
        {
          ideaId: 'idea-1',
          title: 'Route A',
          description: '',
          notes: '',
          waypointIds: [],
          planningState: 'active',
          difficulty: 2,
          referenceIds: ['ref-1'],
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
      activities: [
        {
          activityId: 'a1',
          ideaIds: ['idea-1'],
          date: '2026-08-03',
          location: { kind: 'postcode', postcode: 'GL1 1AA' },
          notes: '',
          referenceIds: [],
          photoReferenceIds: [],
          createdAt: '2026-08-03T00:00:00.000Z',
          updatedAt: '2026-08-03T00:00:00.000Z',
        },
      ],
    })

    const user = userEvent.setup()
    renderIdeas()

    await user.type(screen.getByLabelText('Search ideas'), 'example.com')
    expect(screen.getByText('Route A')).toBeInTheDocument()
    expect(screen.getByText('Used in 1 activity')).toBeInTheDocument()

    await user.click(screen.getByRole('combobox', { name: 'Usage' }))
    await user.click(screen.getByRole('option', { name: 'Not used' }))
    expect(screen.getByText('No ideas match your filters.')).toBeInTheDocument()
  })

  it('validates idea location coordinates and reference https URLs', async () => {
    const user = userEvent.setup()
    renderIdeas('/ideas?mode=add')

    await user.type(screen.getByLabelText('Title'), 'Plan route')
    await user.type(screen.getByLabelText('Latitude'), '51.8')
    await user.click(screen.getByRole('button', { name: 'Add reference' }))
    await user.type(screen.getByLabelText('Reference title'), 'Guide')
    await user.type(screen.getByLabelText('Reference URL'), 'http://example.com/guide')
    await user.click(screen.getByRole('button', { name: 'Save idea' }))

    expect(screen.getByText('Enter both latitude and longitude.')).toBeInTheDocument()
    expect(screen.getByText('Reference URL must start with https://.')).toBeInTheDocument()
    expect(load().ideas).toHaveLength(0)
  })

  it('shows add mode from query params and closes editor on cancel', async () => {
    const user = userEvent.setup()
    renderIdeas('/ideas?mode=add&waypoint=stourhead')

    expect(screen.getByRole('button', { name: 'Save idea' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('button', { name: 'Save idea' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add idea' })).toBeInTheDocument()
  })

  it('switches planning-state tabs and supports updated and difficulty sorting', async () => {
    const seed = createDefaultData()
    save({
      ...seed,
      ideas: [
        {
          ideaId: 'idea-active',
          title: 'No location',
          description: '',
          notes: '',
          waypointIds: [],
          planningState: 'active',
          difficulty: 4,
          referenceIds: [],
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-10T00:00:00.000Z',
        },
        {
          ideaId: 'idea-active-2',
          title: 'With location',
          description: '',
          notes: '',
          waypointIds: [],
          planningState: 'active',
          difficulty: 1,
          location: { latitude: 51.9, longitude: -2.2 },
          referenceIds: [],
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-05T00:00:00.000Z',
        },
        {
          ideaId: 'idea-rejected',
          title: 'Rejected candidate',
          description: '',
          notes: '',
          waypointIds: [],
          planningState: 'rejected',
          rejectionReason: 'Out of scope',
          difficulty: 2,
          referenceIds: [],
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-02T00:00:00.000Z',
        },
      ],
    })

    const user = userEvent.setup()
    renderIdeas()

    expect(screen.getByText('No location')).toBeInTheDocument()
    expect(screen.getByText('With location')).toBeInTheDocument()

    await user.click(screen.getByRole('combobox', { name: 'Sort' }))
    await user.click(screen.getByRole('option', { name: 'Recently updated' }))
    expect(screen.getAllByRole('heading', { level: 6 })[0]).toHaveTextContent('No location')

    await user.click(screen.getByRole('combobox', { name: 'Sort' }))
    await user.click(screen.getByRole('option', { name: 'Difficulty' }))
    expect(screen.getAllByRole('heading', { level: 6 })[0]).toHaveTextContent('With location')

    await user.click(screen.getByRole('button', { name: 'Rejected ideas (1)' }))
    expect(screen.getByText('Rejected candidate')).toBeInTheDocument()
  })
})
