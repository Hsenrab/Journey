import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import LocationDetails from './LocationDetails'
import { JourneyProvider } from '../features/journey/JourneyContext'
import { load } from '../services/storage'

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
    renderDetails('may-hill')
    expect(screen.getByRole('heading', { name: 'May Hill' })).toBeInTheDocument()
  })

  it('adds a visit and persists the derived status', async () => {
    const user = userEvent.setup()
    renderDetails('may-hill')

    await user.type(screen.getByLabelText('Notes'), 'Wonderful visit')
    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: 'Gold' }))
    await user.click(screen.getByRole('button', { name: 'Save visit' }))

    expect(screen.getByText('Visit saved.')).toBeInTheDocument()
    expect(load()['may-hill']).toMatchObject({ status: 'gold', notes: 'Wonderful visit' })
  })

  it('parses photo references into an array, ignoring blank lines', async () => {
    const user = userEvent.setup()
    renderDetails('may-hill')

    await user.type(screen.getByLabelText('Photo references (one URL or filename per line)'), 'a.jpg\n\nb.jpg')
    await user.click(screen.getByRole('button', { name: 'Save visit' }))

    expect(load()['may-hill'].photos).toEqual(['a.jpg', 'b.jpg'])
  })

  it('allows editing the visit date', async () => {
    const user = userEvent.setup()
    renderDetails('may-hill')

    const dateInput = screen.getByLabelText('Visit date')
    await user.clear(dateInput)
    await user.type(dateInput, '2026-07-04')
    await user.click(screen.getByRole('button', { name: 'Save visit' }))

    expect(load()['may-hill']).toMatchObject({ date: '2026-07-04' })
  })
})
