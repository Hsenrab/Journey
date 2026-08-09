import { MemoryRouter } from 'react-router-dom'
import { cleanup, render, screen, waitForElementToBeRemoved } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import Settings from './Settings'
import { WaypointsProvider } from '../features/journey/JourneyContext'
import { backupVersion, createDefaultData, createDemoModeData, load, save } from '../services/storage'
import type { Activity } from '../domain/visit'

function activity(status: 'bronze' | 'silver' | 'gold' = 'gold'): Activity {
  return {
    activityId: `dyrham-park-${status}`,
    waypointId: 'dyrham-park',
    challengeId: 'national-trust',
    status,
    date: '2026-08-01',
    location: { placeName: 'Dyrham Park' },
    notes: 'Great day',
    photos: [],
    referenceIds: [],
    photoReferenceIds: [],
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  }
}

function renderSettings() {
  render(
    <MemoryRouter>
      <WaypointsProvider>
        <Settings />
      </WaypointsProvider>
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
    expect(screen.getByText('At least one linked activity has been recorded.')).toBeInTheDocument()
  })

  it('enables demo mode and loads linked sample data', async () => {
    const user = userEvent.setup()
    renderSettings()

    await user.click(screen.getByRole('button', { name: 'Enable demo mode' }))

    expect(await screen.findByText('Demo mode enabled with sample data.')).toBeInTheDocument()
    const demo = createDemoModeData()
    expect(load().challenges).toEqual(demo.challenges)
    expect(load().ideas).toEqual(demo.ideas)
    expect(load().activities).toEqual(demo.activities)
    expect(screen.getByRole('button', { name: 'Disable demo mode' })).toBeInTheDocument()
  })

  it('disables demo mode and restores the non-demo data set', async () => {
    const user = userEvent.setup()
    save({ ...createDefaultData(), activities: [activity('silver')] })
    renderSettings()

    await user.click(screen.getByRole('button', { name: 'Enable demo mode' }))
    await user.click(screen.getByRole('button', { name: 'Disable demo mode' }))

    expect(await screen.findByText('Demo mode disabled.')).toBeInTheDocument()
    expect(load().activities).toContainEqual(expect.objectContaining({ waypointId: 'dyrham-park', status: 'silver' }))
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
          data: { ...createDefaultData(), activities: [activity()] },
        }),
      ),
    )

    expect(await screen.findByText('Your data was restored.')).toBeInTheDocument()
    expect(load().activities).toContainEqual(expect.objectContaining({ waypointId: 'dyrham-park', status: 'gold' }))
  })

  it('keeps existing data when the backup is invalid', async () => {
    const user = userEvent.setup()
    save({ ...createDefaultData(), activities: [activity()] })
    renderSettings()

    await user.upload(screen.getByLabelText('Restore JSON'), backupFile('{"version":99,"data":{}}'))

    expect(await screen.findByText(/not a valid Waypoints backup/)).toBeInTheDocument()
    expect(load().activities).toContainEqual(expect.objectContaining({ waypointId: 'dyrham-park', status: 'gold' }))
  })

  it('shows an error message for a file that is not JSON', async () => {
    const user = userEvent.setup()
    renderSettings()

    await user.upload(screen.getByLabelText('Restore JSON'), backupFile('not json at all'))

    expect(await screen.findByText(/not a valid Waypoints backup/)).toBeInTheDocument()
  })

  it('rejects a file with an unsupported mime type before parsing it', async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderSettings()

    await user.upload(
      screen.getByLabelText('Restore JSON'),
      new File(['not json at all'], 'backup.txt', { type: 'text/plain' }),
    )

    expect(await screen.findByText('Choose a JSON backup file exported from this app.')).toBeInTheDocument()
  })

  it('exports the current data as a downloadable JSON file', async () => {
    const user = userEvent.setup()
    save({ ...createDefaultData(), activities: [activity()] })
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
    save({ ...createDefaultData(), activities: [activity()] })
    renderSettings()

    await user.click(screen.getByRole('button', { name: 'Clear data' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'))
    expect(load().activities).toContainEqual(expect.objectContaining({ waypointId: 'dyrham-park', status: 'gold' }))

    await user.click(screen.getByRole('button', { name: 'Clear data' }))
    await user.click(screen.getByRole('button', { name: 'Clear everything' }))

    expect(await screen.findByText('Your data was cleared.')).toBeInTheDocument()
    expect(load().activities).toEqual([])
  })

  it('closes the clear data confirmation dialog when dismissed with escape', async () => {
    const user = userEvent.setup()
    save({ ...createDefaultData(), activities: [activity()] })
    renderSettings()

    await user.click(screen.getByRole('button', { name: 'Clear data' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'))
    expect(load().activities).toContainEqual(expect.objectContaining({ waypointId: 'dyrham-park', status: 'gold' }))
  })
})
