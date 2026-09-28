import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import Challenges from './Challenges'
import { WaypointsProvider } from '../features/journey/JourneyContext'
import { createDefaultData, createDemoModeData, load, save, setDataMode } from '../services/storage'

function renderChallenges(initialEntries: string[] = ['/challenges']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <WaypointsProvider>
        <Challenges />
      </WaypointsProvider>
    </MemoryRouter>,
  )
}

describe('Challenges', () => {
  beforeEach(() => localStorage.clear())

  it('lists every challenge with progress and links to its details', () => {
    setDataMode('demo-local')
    const demo = createDemoModeData()
    renderChallenges()

    for (const challenge of demo.challenges) {
      expect(screen.getByRole('link', { name: challenge.title })).toHaveAttribute(
        'href',
        `/challenges/${challenge.challengeId}`,
      )
    }
    expect(screen.queryByRole('button', { name: 'Add challenge' })).not.toBeInTheDocument()
  })

  it('shows an empty state when there are no challenges', () => {
    save({ ...createDefaultData(), waypoints: [], challenges: [], references: [] })
    renderChallenges()

    expect(screen.getByText('No challenges are available yet.')).toBeInTheDocument()
  })

  it('validates and creates a challenge', async () => {
    const user = userEvent.setup()
    renderChallenges()

    await user.click(screen.getByRole('button', { name: 'Add challenge' }))
    await user.click(screen.getByRole('button', { name: 'Save challenge' }))
    expect(screen.getByText('Challenge title is required.')).toBeInTheDocument()
    expect(screen.getByText('Challenge description is required.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Title'), '  Peak District walks ')
    await user.type(screen.getByLabelText('Description'), 'Classic Peak District routes')
    await user.click(screen.getByLabelText('Supports Bronze, Silver and Gold activity categories'))
    await user.click(screen.getByRole('button', { name: 'Save challenge' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Challenge saved.')
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save challenge' })).not.toBeInTheDocument())
    const created = load().challenges.find((challenge) => challenge.title === 'Peak District walks')
    expect(created).toEqual({
      challengeId: expect.any(String),
      title: 'Peak District walks',
      description: 'Classic Peak District routes',
      waypointIds: [],
      supportsActivityCategories: true,
    })
    expect(screen.getByRole('link', { name: 'Peak District walks' })).toHaveAttribute(
      'href',
      `/challenges/${created?.challengeId}`,
    )
    expect(screen.getByRole('link', { name: 'National Trust' })).toBeInTheDocument()
  })
})
