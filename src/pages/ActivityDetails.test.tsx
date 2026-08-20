import { render, screen } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import ActivityDetails from './ActivityDetails'
import { WaypointsProvider } from '../features/journey/JourneyContext'
import { createDefaultData, load, save } from '../services/storage'

function renderDetails(path = '/activities/a1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <WaypointsProvider>
        <Routes>
          <Route path="/activities/:activityId" element={<ActivityDetails />} />
          <Route path="/waypoints/:id" element={<div>Waypoint details</div>} />
        </Routes>
      </WaypointsProvider>
    </MemoryRouter>,
  )
}

describe('ActivityDetails', () => {
  beforeEach(() => localStorage.clear())

  it('shows not found for unknown ids', () => {
    renderDetails('/activities/missing')
    expect(screen.getByText('Activity not found.')).toBeInTheDocument()
  })

  it('renders linked references and photos', () => {
    const seed = createDefaultData()
    save({
      ...seed,
      references: [...seed.references, { referenceId: 'r1', title: 'Guide', url: 'https://example.com/guide' }],
      photoReferences: [{ photoReferenceId: 'p1', title: 'View', url: 'https://example.com/view.jpg' }],
      activities: [
        {
          activityId: 'a1',
          waypointId: 'stourhead',
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

    expect(screen.getByRole('heading', { name: '2026-08-01 · Stourhead' })).toBeInTheDocument()
    expect(screen.getByText('Guide')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'View' })).toBeInTheDocument()
  })

  it('renders empty optional fields and invalid reference hostnames', () => {
    const seed = createDefaultData()
    save({
      ...seed,
      references: [{ referenceId: 'r1', title: 'Link', url: 'https://example.com' }],
      activities: [
        {
          activityId: 'a1',
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

  it('deletes an activity after confirmation', async () => {
    const user = userEvent.setup()
    const seed = createDefaultData()
    save({
      ...seed,
      references: [...seed.references, { referenceId: 'r1', title: 'Guide', url: 'https://example.com/guide' }],
      activities: [
        {
          activityId: 'a1',
          waypointId: 'stourhead',
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

  it('keeps data unchanged when delete is cancelled', async () => {
    const user = userEvent.setup()
    const seed = createDefaultData()
    save({
      ...seed,
      activities: [
        {
          activityId: 'a1',
          waypointId: 'stourhead',
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
        { photoReferenceId: 'p1', title: 'View one', url: 'https://example.com/one.jpg' },
        { photoReferenceId: 'p2', title: 'View two', url: 'https://example.com/two.jpg' },
      ],
      activities: [
        {
          activityId: 'a1',
          waypointId: 'stourhead',
          date: '2026-08-01',
          category: 'gold',
          location: { kind: 'postcode', postcode: 'BA12 6QF' },
          notes: 'Excellent visit',
          referenceIds: [],
          photoReferenceIds: ['p1', 'p2'],
          createdAt: '2026-08-01T10:00:00.000Z',
          updatedAt: '2026-08-01T10:00:00.000Z',
        },
      ],
    })

    renderDetails()

    await user.click(screen.getByRole('button', { name: 'Next photo' }))
    expect(screen.getByText('2 of 2: View two')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Previous photo' }))
    expect(screen.getByText('1 of 2: View one')).toBeInTheDocument()

    const img = screen.getByRole('img', { name: 'View one' })
    fireEvent.error(img)
    expect(screen.getByText('Image failed to load: View one')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edit activity' }))
    await user.clear(screen.getByLabelText('Description / notes'))
    await user.type(screen.getByLabelText('Description / notes'), 'Updated notes')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(load().activities[0]?.notes).toBe('Updated notes')
    expect(screen.getByText('Activity updated.')).toBeInTheDocument()
  })
})
