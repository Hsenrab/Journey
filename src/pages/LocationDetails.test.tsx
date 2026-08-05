import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import LocationDetails from './LocationDetails'
import { JourneyProvider } from '../features/journey/JourneyContext'
import { locations } from '../data/locations'
import { load } from '../services/storage'

const location = locations[0]

function renderDetails(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/locations/${id}`]}>
      <JourneyProvider>
        <Routes>
          <Route path="/locations/:id" element={<LocationDetails />} />
        </Routes>
      </JourneyProvider>
    </MemoryRouter>,
  )
}

describe('LocationDetails', () => {
  beforeEach(() => localStorage.clear())

  it('shows an error when the location is not found', () => {
    renderDetails('does-not-exist')
    expect(screen.getByText('Location not found.')).toBeInTheDocument()
  })

  it('shows the location details', () => {
    renderDetails(location.locationId)
    expect(screen.getByRole('heading', { name: location.name })).toBeInTheDocument()
  })

  it('adds a visit and persists the derived status', async () => {
    const user = userEvent.setup()
    renderDetails(location.locationId)

    await user.type(screen.getByLabelText('Notes'), 'Wonderful visit')
    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: 'Gold' }))
    await user.click(screen.getByRole('button', { name: 'Save visit' }))

    expect(screen.getByText('Visit saved.')).toBeInTheDocument()
    expect(load()[location.locationId]).toMatchObject({ status: 'gold', notes: 'Wonderful visit' })
  })

  it('parses photo references into an array, ignoring blank lines', async () => {
    const user = userEvent.setup()
    renderDetails(location.locationId)

    await user.type(screen.getByLabelText('Photo references (one URL or filename per line)'), 'a.jpg\n\nb.jpg')
    await user.click(screen.getByRole('button', { name: 'Save visit' }))

    expect(load()[location.locationId].photos).toEqual(['a.jpg', 'b.jpg'])
  })

  it('allows editing the visit date', async () => {
    const user = userEvent.setup()
    renderDetails(location.locationId)

    const dateInput = screen.getByLabelText('Visit date')
    await user.clear(dateInput)
    await user.type(dateInput, '2026-07-04')
    await user.click(screen.getByRole('button', { name: 'Save visit' }))

    expect(load()[location.locationId]).toMatchObject({ date: '2026-07-04' })
  })
})
