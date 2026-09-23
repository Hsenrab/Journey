import type { ComponentProps } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WaypointEditor } from './WaypointEditor'
import { createDefaultData } from '../services/storage'
import type { WaypointDraft } from '../features/journey/JourneyContext'

function renderEditor(overrides: Partial<ComponentProps<typeof WaypointEditor>> = {}) {
  const onSubmit = vi.fn<(draft: WaypointDraft) => void>()
  const onCancel = vi.fn()
  const data = createDefaultData()
  render(
    <MemoryRouter>
      <WaypointEditor data={data} submitLabel="Save waypoint" onSubmit={onSubmit} onCancel={onCancel} {...overrides} />
    </MemoryRouter>,
  )
  return { onSubmit, onCancel }
}

describe('WaypointEditor', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('validates required fields, completion, coordinates, references and photos', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEditor()

    await user.click(screen.getByRole('button', { name: 'Save waypoint' }))
    expect(screen.getByText('Waypoint title is required.')).toBeInTheDocument()
    expect(screen.getByText('Waypoint description is required.')).toBeInTheDocument()
    expect(screen.getByText('Waypoint category is required.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Title'), 'A viewpoint')
    await user.type(screen.getByLabelText('Description'), 'A quiet viewpoint')
    await user.type(screen.getByLabelText('Category'), 'Scenic')
    await user.click(screen.getByRole('combobox', { name: 'Completion mode' }))
    await user.click(screen.getByRole('option', { name: 'Count' }))
    await user.clear(screen.getByLabelText('Completion target'))
    await user.type(screen.getByLabelText('Completion target'), '0')
    await user.type(screen.getByLabelText('Latitude'), '91')
    await user.type(screen.getByLabelText('Longitude'), '-1')
    await user.click(screen.getByRole('button', { name: 'Add reference' }))
    await user.click(screen.getByRole('button', { name: 'Add photo reference' }))
    await user.click(screen.getByRole('button', { name: 'Save waypoint' }))

    expect(screen.getByText('Target must be a positive whole number.')).toBeInTheDocument()
    expect(screen.getByText('Latitude must be between -90 and 90.')).toBeInTheDocument()
    expect(screen.getByText('Reference title is required.')).toBeInTheDocument()
    expect(screen.getByText('Reference URL must start with https://.')).toBeInTheDocument()
    expect(screen.getByText('Photo title is required.')).toBeInTheDocument()
    expect(screen.getByText('Photo URL must start with https://.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits trimmed fields with a valid count completion and coordinates', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEditor()

    await user.type(screen.getByLabelText('Title'), ' A viewpoint ')
    await user.type(screen.getByLabelText('Description'), ' A quiet viewpoint ')
    await user.type(screen.getByLabelText('Category'), ' Scenic ')
    await user.type(screen.getByLabelText('Tags (comma-separated)'), ' sunrise,  walk ,, ')
    await user.click(screen.getByRole('combobox', { name: 'Completion mode' }))
    await user.click(screen.getByRole('option', { name: 'Count' }))
    await user.clear(screen.getByLabelText('Completion target'))
    await user.type(screen.getByLabelText('Completion target'), '2')
    await user.type(screen.getByLabelText('Place name'), ' Brockworth ')
    await user.type(screen.getByLabelText('Latitude'), '51.75')
    await user.type(screen.getByLabelText('Longitude'), '-1.26')
    await user.click(screen.getByLabelText('Approximate location'))
    await user.click(screen.getByRole('button', { name: 'Save waypoint' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'A viewpoint',
        description: 'A quiet viewpoint',
        category: 'Scenic',
        tags: ['sunrise', 'walk'],
        completion: { mode: 'count', target: 2 },
        location: {
          placeName: 'Brockworth',
          latitude: 51.75,
          longitude: -1.26,
          approximate: true,
        },
      }),
    )
  })

  it('adds and removes references and photo references', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: 'Add reference' }))
    await user.click(screen.getByRole('button', { name: 'Remove reference 1' }))
    await user.click(screen.getByRole('button', { name: 'Add photo reference' }))
    await user.click(screen.getByRole('button', { name: 'Remove photo 1' }))

    expect(screen.queryByText('Reference 1')).not.toBeInTheDocument()
    expect(screen.queryByText('Photo 1')).not.toBeInTheDocument()
  })

  it('loads valid pasted JSON into the form before submit', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEditor()
    const payload = {
      title: 'Load from JSON',
      description: 'A waypoint loaded from pasted JSON',
      category: 'Scenic',
      tags: ['sunrise', 'walk'],
      completion: { mode: 'count', target: 2 },
      location: { placeName: 'Brockworth', approximate: true },
      references: [{ title: 'Guide', url: 'https://example.com/guide', description: '', previewImageUrl: '' }],
      photoReferences: [{ title: 'Photo', url: 'https://example.com/photo.jpg', altText: '' }],
    }

    await user.click(screen.getByRole('tab', { name: 'Paste JSON' }))
    await user.click(screen.getByLabelText('Waypoint JSON'))
    await user.paste(JSON.stringify(payload))
    await user.click(screen.getByRole('button', { name: 'Load into form' }))
    await user.click(screen.getByRole('button', { name: 'Save waypoint' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: payload.title,
        description: payload.description,
        category: payload.category,
        tags: payload.tags,
        challengeIds: ['national-trust'],
        completion: payload.completion,
        references: [expect.objectContaining({ title: 'Guide' })],
        photoReferences: [expect.objectContaining({ title: 'Photo' })],
      }),
    )
  })

  it('keeps pasted JSON and shows malformed and schema errors', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('tab', { name: 'Paste JSON' }))
    const input = screen.getByLabelText('Waypoint JSON')

    await user.click(input)
    await user.paste('{bad')
    await user.click(screen.getByRole('button', { name: 'Load into form' }))
    expect(screen.getByText('Invalid JSON. Paste a valid JSON object.')).toBeInTheDocument()
    expect(input).toHaveValue('{bad')

    await user.clear(input)
    await user.click(input)
    await user.paste(
      JSON.stringify({
        title: 'Bad draft',
        description: 123,
        category: 'Scenic',
        tags: [],
        completion: { mode: 'once' },
        references: [],
        photoReferences: [],
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Load into form' }))
    expect(screen.getByText('JSON does not match the waypoint draft shape.')).toBeInTheDocument()
    expect(screen.getByText(/description: Invalid input/)).toBeInTheDocument()
  })

  it('rejects arrays and forbidden id fields in pasted JSON', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('tab', { name: 'Paste JSON' }))
    const input = screen.getByLabelText('Waypoint JSON')

    await user.click(input)
    await user.paste('[]')
    await user.click(screen.getByRole('button', { name: 'Load into form' }))
    expect(screen.getByText('Paste a single object, not an array.')).toBeInTheDocument()

    await user.clear(input)
    await user.click(input)
    await user.paste(
      JSON.stringify({
        waypointId: 'waypoint-1',
        title: 'Bad draft',
        description: '',
        category: 'Scenic',
        tags: [],
        completion: { mode: 'once' },
        references: [],
        photoReferences: [],
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Load into form' }))
    expect(screen.getByText(/Remove 'waypointId' — IDs are assigned automatically./)).toBeInTheDocument()
  })

  it('shows clipboard errors and clears JSON issues', async () => {
    const user = userEvent.setup()
    renderEditor()
    const originalClipboard = navigator.clipboard
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })

    try {
      await user.click(screen.getByRole('tab', { name: 'Paste JSON' }))
      await user.click(screen.getByLabelText('Waypoint JSON'))
      await user.paste(
        JSON.stringify({
          title: 'Bad draft',
          description: 123,
          category: 'Scenic',
          tags: [],
          completion: { mode: 'once' },
          references: [],
          photoReferences: [],
        }),
      )
      await user.click(screen.getByRole('button', { name: 'Load into form' }))
      expect(screen.getByText(/description: Invalid input/)).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Copy example JSON' }))
      expect(screen.getByText('Clipboard is unavailable in this browser.')).toBeInTheDocument()
      expect(screen.queryByText(/description: Invalid input/)).not.toBeInTheDocument()
    } finally {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: originalClipboard })
    }
  })

  it('shows an AI prompt button that opens the Waypoint JSON prompt dialog', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('tab', { name: 'Paste JSON' }))
    await user.click(screen.getByRole('button', { name: 'Waypoint JSON AI prompt' }))
    expect(screen.getByRole('heading', { name: 'Waypoint JSON AI prompt' })).toBeInTheDocument()
    expect(screen.getByDisplayValue(/destination or place-based experience/)).toBeInTheDocument()
  })
})
