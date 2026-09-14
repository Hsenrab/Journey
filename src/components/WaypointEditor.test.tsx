import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { WaypointEditor } from './WaypointEditor'
import { createDefaultData } from '../services/storage'

function renderEditor() {
  const onSubmit = vi.fn()
  const onCancel = vi.fn()
  const data = createDefaultData()
  render(
    <MemoryRouter>
      <WaypointEditor data={data} submitLabel="Save waypoint" onSubmit={onSubmit} onCancel={onCancel} />
    </MemoryRouter>,
  )
  return { onSubmit, onCancel }
}

describe('WaypointEditor', () => {
  it('loads valid pasted JSON into the form before submit', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEditor()
    const payload = {
      title: 'Load from JSON',
      description: 'A waypoint loaded from pasted JSON',
      category: 'Scenic',
      tags: ['sunrise', 'walk'],
      challengeIds: ['national-trust'],
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
        challengeIds: payload.challengeIds,
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
        challengeIds: ['national-trust'],
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
        challengeIds: ['national-trust'],
        completion: { mode: 'once' },
        references: [],
        photoReferences: [],
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Load into form' }))
    expect(screen.getByText(/Remove 'waypointId' — IDs are assigned automatically./)).toBeInTheDocument()
  })
})
