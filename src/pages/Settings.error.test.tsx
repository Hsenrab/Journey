import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { JourneyImportNotEmptyError } from '../services/journeyApi'
import Settings from './Settings'

const restore = vi.fn().mockRejectedValue(new JourneyImportNotEmptyError())
const clear = vi.fn().mockRejectedValue('failure')

vi.mock('../features/journey/JourneyContext', () => ({
  useWaypoints: () => ({
    clear,
    data: { waypoints: [], challenges: [], ideas: [], activities: [], references: [], photoReferences: [] },
    restore,
  }),
}))

vi.mock('../services/storage', () => ({
  createBackup: vi.fn(),
  isDemoModeEnabled: () => false,
  parseImport: () => ({}),
}))

describe('Settings import errors', () => {
  it('reports that production must be empty instead of rejecting a valid backup', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    )

    await user.upload(
      screen.getByLabelText('Restore JSON'),
      new File(['{}'], 'backup.json', { type: 'application/json' }),
    )

    expect(await screen.findByText('Your personal data must be empty before restoring a backup.')).toBeInTheDocument()
  })

  it('reports a clear failure without closing the dialog', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Clear data' }))
    await user.click(screen.getByRole('button', { name: 'Clear everything' }))

    expect(await screen.findByText('Failed to clear your data.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('preserves a specific clear error', async () => {
    clear.mockRejectedValueOnce(new Error('Cosmos unavailable'))
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Clear data' }))
    await user.click(screen.getByRole('button', { name: 'Clear everything' }))

    expect(await screen.findByText('Cosmos unavailable')).toBeInTheDocument()
  })
})
