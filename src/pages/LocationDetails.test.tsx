import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import LocationDetails from './LocationDetails'
import { WaypointsProvider } from '../features/journey/JourneyContext'
import { load } from '../services/storage'

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

  it('adds an activity and persists the derived status', async () => {
    const user = userEvent.setup()
    renderDetails(lacockId)

    await user.type(screen.getByLabelText('Notes'), 'Wonderful visit')
    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: 'Gold' }))
    await user.click(screen.getByRole('button', { name: 'Save activity' }))

    expect(screen.getByText('Activity saved.')).toBeInTheDocument()
    expect(load().activities).toContainEqual(
      expect.objectContaining({ waypointId: lacockId, status: 'gold', notes: 'Wonderful visit' }),
    )
  })

  it('parses photo references into an array, ignoring blank lines', async () => {
    const user = userEvent.setup()
    renderDetails(lacockId)

    await user.type(screen.getByLabelText('Photo references (one URL or filename per line)'), 'a.jpg\n\nb.jpg')
    await user.click(screen.getByRole('button', { name: 'Save activity' }))

    expect(load().activities[0].photos).toEqual(['a.jpg', 'b.jpg'])
  })

  it('allows editing the activity date', async () => {
    const user = userEvent.setup()
    renderDetails(lacockId)

    const dateInput = screen.getByLabelText('Activity date')
    await user.clear(dateInput)
    await user.type(dateInput, '2026-07-04')
    await user.click(screen.getByRole('button', { name: 'Save activity' }))

    expect(load().activities[0]).toMatchObject({ waypointId: lacockId, date: '2026-07-04' })
  })

  it('shows an error message for an invalid activity date', async () => {
    const user = userEvent.setup()
    renderDetails(lacockId)

    const dateInput = screen.getByLabelText('Activity date')
    await user.clear(dateInput)
    await user.type(dateInput, 'not-a-date')
    await user.click(screen.getByRole('button', { name: 'Save activity' }))

    expect(screen.getByText('Please enter a valid activity date in YYYY-MM-DD format.')).toBeInTheDocument()
    expect(load().activities).toEqual([])
  })
})
