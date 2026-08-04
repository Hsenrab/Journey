import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import Settings from './Settings'
import { JourneyProvider } from '../features/journey/JourneyContext'
import { load, save } from '../services/storage'
import type { AwardedStatus, Visit } from '../domain/visit'

function visit(status: AwardedStatus): Visit {
  return {
    visitId: `lyme-${status}`,
    locationId: 'lyme',
    status,
    date: '2026-08-01',
    notes: '',
    photos: [],
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  }
}

function renderSettings() {
  return render(
    <JourneyProvider>
      <Settings />
    </JourneyProvider>,
  )
}

function jsonFile(contents: string) {
  return new File([contents], 'export.json', { type: 'application/json' })
}

describe('Settings', () => {
  beforeEach(() => localStorage.clear())

  it('shows the challenge rules', () => {
    renderSettings()
    expect(screen.getByText('Challenge rules')).toBeInTheDocument()
    expect(screen.getByText('Physically visited.')).toBeInTheDocument()
  })

  it('restores a valid export and shows a success message', async () => {
    const user = userEvent.setup()
    renderSettings()

    const file = jsonFile(JSON.stringify({ visits: [visit('gold')] }))
    await user.upload(screen.getByLabelText('Restore JSON'), file)

    expect(await screen.findByText('Your data was restored.')).toBeInTheDocument()
    expect(load().visits).toContainEqual(expect.objectContaining({ locationId: 'lyme', status: 'gold' }))
  })

  it('shows an error message for an invalid export file', async () => {
    const user = userEvent.setup()
    save({ visits: [visit('silver')] })
    renderSettings()

    const file = jsonFile(JSON.stringify({ visits: [{ ...visit('silver'), status: 'not-a-status' }] }))
    await user.upload(screen.getByLabelText('Restore JSON'), file)

    expect(await screen.findByText('That file is not a valid tracker export.')).toBeInTheDocument()
    expect(load().visits).toContainEqual(expect.objectContaining({ locationId: 'lyme', status: 'silver' }))
  })

  it('shows an error message for a file that is not JSON', async () => {
    const user = userEvent.setup()
    renderSettings()

    const file = jsonFile('not json at all')
    await user.upload(screen.getByLabelText('Restore JSON'), file)

    expect(await screen.findByText('That file is not a valid tracker export.')).toBeInTheDocument()
  })

  it('exports the current data as a downloadable JSON file', async () => {
    const user = userEvent.setup()
    save({ visits: [visit('gold')] })
    renderSettings()

    const createObjectURL = URL.createObjectURL
    const revokeObjectURL = URL.revokeObjectURL
    const clickSpy: Array<string> = []
    URL.createObjectURL = () => 'blob:mock-url'
    URL.revokeObjectURL = (url: string) => clickSpy.push(url)

    await user.click(screen.getByRole('button', { name: 'Export JSON' }))

    expect(clickSpy).toEqual(['blob:mock-url'])

    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = revokeObjectURL
  })
})
