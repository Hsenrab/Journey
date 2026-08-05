import { MemoryRouter } from 'react-router-dom'
import { cleanup, render, screen, waitForElementToBeRemoved } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import Settings from './Settings'
import { JourneyProvider } from '../features/journey/JourneyContext'
import { backupVersion, load, save } from '../services/storage'
import type { AwardedStatus, Visit } from '../domain/visit'

function visit(status: AwardedStatus = 'gold'): Visit {
  return {
    visitId: `dyrham-park-${status}`,
    locationId: 'dyrham-park',
    status,
    date: '2026-08-01',
    notes: 'Great day',
    photos: [],
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  }
}

function renderSettings() {
  render(
    <MemoryRouter>
      <JourneyProvider>
        <Settings />
      </JourneyProvider>
    </MemoryRouter>,
  )
}

function backupFile(contents: string) {
  return new File([contents], 'backup.json', { type: 'application/json' })
}

describe('Settings', () => {
  beforeEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('shows the challenge rules', () => {
    renderSettings()
    expect(screen.getByText('Challenge rules')).toBeInTheDocument()
    expect(screen.getByText('Physically visited.')).toBeInTheDocument()
  })

  it('restores a valid backup', async () => {
    const user = userEvent.setup()
    renderSettings()

    await user.upload(
      screen.getByLabelText('Restore JSON'),
      backupFile(
        JSON.stringify({
          version: backupVersion,
          exportedAt: '2026-08-01T00:00:00.000Z',
          visits: [visit()],
        }),
      ),
    )

    expect(await screen.findByText('Your data was restored.')).toBeInTheDocument()
    expect(load().visits).toContainEqual(expect.objectContaining({ locationId: 'dyrham-park', status: 'gold' }))
  })

  it('keeps existing data when the backup is invalid', async () => {
    const user = userEvent.setup()
    save({ visits: [visit()] })
    renderSettings()

    await user.upload(screen.getByLabelText('Restore JSON'), backupFile('{"version":99,"visits":[]}'))

    expect(await screen.findByText(/not a valid tracker backup/)).toBeInTheDocument()
    expect(load().visits).toContainEqual(expect.objectContaining({ locationId: 'dyrham-park', status: 'gold' }))
  })

  it('shows an error message for a file that is not JSON', async () => {
    const user = userEvent.setup()
    renderSettings()

    await user.upload(screen.getByLabelText('Restore JSON'), backupFile('not json at all'))

    expect(await screen.findByText(/not a valid tracker backup/)).toBeInTheDocument()
  })

  it('exports the current data as a downloadable JSON file', async () => {
    const user = userEvent.setup()
    save({ visits: [visit()] })
    renderSettings()

    const createObjectURL = URL.createObjectURL
    const revokeObjectURL = URL.revokeObjectURL
    const revokedUrls: string[] = []
    URL.createObjectURL = () => 'blob:mock-url'
    URL.revokeObjectURL = (url: string) => revokedUrls.push(url)

    await user.click(screen.getByRole('button', { name: 'Export JSON' }))

    expect(revokedUrls).toEqual(['blob:mock-url'])

    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = revokeObjectURL
  })

  it('clears data only after confirmation', async () => {
    const user = userEvent.setup()
    save({ visits: [visit()] })
    renderSettings()

    await user.click(screen.getByRole('button', { name: 'Clear data' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'))
    expect(load().visits).toContainEqual(expect.objectContaining({ locationId: 'dyrham-park', status: 'gold' }))

    await user.click(screen.getByRole('button', { name: 'Clear data' }))
    await user.click(screen.getByRole('button', { name: 'Clear everything' }))

    expect(await screen.findByText('Your data was cleared.')).toBeInTheDocument()
    expect(load()).toEqual({ visits: [] })
  })
})
