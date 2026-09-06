import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import LocationDetails from './LocationDetails'
import { WaypointsProvider } from '../features/journey/JourneyContext'
import { createDefaultData, load, save } from '../services/storage'

const lacockId = 'lacock-abbey-fox-talbot-museum-and-village'

function renderDetails(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/waypoints/${id}`]}>
      <WaypointsProvider>
        <Routes>
          <Route path="/waypoints/:id" element={<LocationDetails />} />
        </Routes>
      </WaypointsProvider>
    </MemoryRouter>,
  )
}

describe('LocationDetails', () => {
  beforeEach(() => localStorage.clear())

  it('shows an error when the waypoint is not found', () => {
    renderDetails('does-not-exist')
    expect(screen.getByText('Waypoint not found.')).toBeInTheDocument()
  })

  it('shows the waypoint details', () => {
    renderDetails(lacockId)
    expect(screen.getByRole('heading', { name: 'Lacock Abbey, Fox Talbot Museum and Village' })).toBeInTheDocument()
  })

  it('adds a linked activity', async () => {
    const user = userEvent.setup()
    renderDetails(lacockId)

    await user.click(screen.getByRole('button', { name: 'Log activity' }))
    await user.type(screen.getByLabelText('Postcode'), 'SN15 2LG')
    await user.type(screen.getByLabelText('Description / notes'), 'Wonderful visit')
    await user.click(screen.getByRole('combobox', { name: 'Activity category' }))
    await user.click(screen.getByRole('option', { name: 'Gold' }))
    await user.click(screen.getByRole('button', { name: 'Save activity' }))

    expect(screen.getByText('Activity saved.')).toBeInTheDocument()
    expect(load().activities).toContainEqual(
      expect.objectContaining({ waypointId: lacockId, category: 'gold', notes: 'Wonderful visit' }),
    )
  })

  it('shows an error message for an invalid activity date', async () => {
    const user = userEvent.setup()
    renderDetails(lacockId)

    await user.click(screen.getByRole('button', { name: 'Log activity' }))
    const dateInput = screen.getByLabelText('Activity date')
    await user.clear(dateInput)
    await user.type(dateInput, 'not-a-date')
    await user.click(screen.getByRole('button', { name: 'Save activity' }))

    expect(screen.getByText('Please enter a valid activity date in YYYY-MM-DD format.')).toBeInTheDocument()
    expect(load().activities).toEqual([])
  })

  it('shows ideas linked to the waypoint with derived usage', () => {
    const seed = createDefaultData()
    save({
      ...seed,
      ideas: [
        {
          ideaId: 'idea-1',
          title: 'Scout route',
          description: '',
          notes: '',
          waypointIds: [lacockId],
          planningState: 'active',
          difficulty: 1,
          referenceIds: [],
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
    })
    renderDetails(lacockId)
    expect(screen.getByRole('heading', { name: 'Ideas' })).toBeInTheDocument()
    expect(screen.getByText('Scout route')).toBeInTheDocument()
    expect(screen.getByText('Active · Not used')).toBeInTheDocument()
  })
})
