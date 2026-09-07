import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import IdeaDetails from './IdeaDetails'
import { WaypointsProvider } from '../features/journey/JourneyContext'
import { createDefaultData, load, save } from '../services/storage'

function renderDetails(path = '/ideas/idea-1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <WaypointsProvider>
        <Routes>
          <Route path="/ideas/:ideaId" element={<IdeaDetails />} />
          <Route path="/ideas" element={<div>Ideas list</div>} />
          <Route path="/activities/:activityId" element={<div>Activity details</div>} />
        </Routes>
      </WaypointsProvider>
    </MemoryRouter>,
  )
}

describe('IdeaDetails', () => {
  beforeEach(() => localStorage.clear())

  it('shows usage and linked activities', () => {
    const seed = createDefaultData()
    save({
      ...seed,
      ideas: [
        {
          ideaId: 'idea-1',
          title: 'Try the outer trail',
          description: '',
          notes: '',
          waypointIds: ['stourhead'],
          planningState: 'active',
          difficulty: 2,
          referenceIds: [],
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
      activities: [
        {
          activityId: 'a1',
          ideaIds: ['idea-1'],
          waypointId: 'stourhead',
          date: '2026-08-05',
          category: 'gold',
          location: { kind: 'postcode', postcode: 'BA12 6QF' },
          notes: '',
          referenceIds: [],
          photoReferenceIds: [],
          createdAt: '2026-08-05T00:00:00.000Z',
          updatedAt: '2026-08-05T00:00:00.000Z',
        },
      ],
    })

    renderDetails()
    expect(screen.getByText('Used in 1 activity')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View activity' })).toBeInTheDocument()
  })

  it('deletes an idea and detaches it from activities', async () => {
    const user = userEvent.setup()
    const seed = createDefaultData()
    save({
      ...seed,
      ideas: [
        {
          ideaId: 'idea-1',
          title: 'Try the outer trail',
          description: '',
          notes: '',
          waypointIds: [],
          planningState: 'active',
          difficulty: 2,
          referenceIds: [],
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
      activities: [
        {
          activityId: 'a1',
          ideaIds: ['idea-1'],
          date: '2026-08-05',
          location: { kind: 'postcode', postcode: 'BA12 6QF' },
          notes: '',
          referenceIds: [],
          photoReferenceIds: [],
          createdAt: '2026-08-05T00:00:00.000Z',
          updatedAt: '2026-08-05T00:00:00.000Z',
        },
      ],
    })

    renderDetails()
    await user.click(screen.getByRole('button', { name: 'Delete idea' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(load().ideas).toEqual([])
    expect(load().activities[0]?.ideaIds).toEqual([])
  })

  it('shows not-found state for unknown idea id', () => {
    renderDetails('/ideas/missing')
    expect(screen.getByText('Idea not found.')).toBeInTheDocument()
  })

  it('renders rejected metadata and empty usage details', () => {
    const seed = createDefaultData()
    save({
      ...seed,
      ideas: [
        {
          ideaId: 'idea-1',
          title: 'Skipped concept',
          description: '',
          notes: '',
          waypointIds: [],
          planningState: 'rejected',
          rejectionReason: 'Not viable',
          difficulty: 3,
          location: { latitude: 51.12345, longitude: -2.54321 },
          referenceIds: [],
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
      activities: [],
    })

    renderDetails()
    expect(screen.getByText('Rejection reason: Not viable')).toBeInTheDocument()
    expect(screen.getByText('Location: 51.12345, -2.54321')).toBeInTheDocument()
    expect(screen.getByText('No references linked to this idea.')).toBeInTheDocument()
    expect(screen.getByText('Not used')).toBeInTheDocument()
  })

  it('enters and exits edit mode', async () => {
    const seed = createDefaultData()
    save({
      ...seed,
      ideas: [
        {
          ideaId: 'idea-1',
          title: 'Try the outer trail',
          description: '',
          notes: '',
          waypointIds: [],
          planningState: 'active',
          difficulty: 2,
          referenceIds: [],
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
    })

    const user = userEvent.setup()
    renderDetails()

    await user.click(screen.getByRole('button', { name: 'Edit idea' }))
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: 'Edit idea' })).toBeInTheDocument()
  })
})
