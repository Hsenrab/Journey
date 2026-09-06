import type { ComponentProps } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IdeaEditor } from './IdeaEditor'
import { createDefaultData } from '../services/storage'
import type { IdeaDraft } from '../features/journey/JourneyContext'

function renderEditor(overrides: Partial<ComponentProps<typeof IdeaEditor>> = {}) {
  const onSubmit = vi.fn<(draft: IdeaDraft) => void>()
  const onCancel = vi.fn()
  const onDelete = vi.fn()
  const data = createDefaultData()

  render(
    <MemoryRouter>
      <IdeaEditor
        data={data}
        submitLabel="Save"
        onSubmit={onSubmit}
        onCancel={onCancel}
        onDelete={onDelete}
        {...overrides}
      />
    </MemoryRouter>,
  )

  return { onSubmit, onCancel, onDelete }
}

describe('IdeaEditor', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('submits a minimal valid idea', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEditor({ initialWaypointId: 'stourhead' })

    await user.type(screen.getByLabelText('Title'), ' Explore river path ')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Explore river path',
        planningState: 'active',
        difficulty: 1,
        waypointIds: ['stourhead'],
        references: [],
      }),
    )
  })

  it('requires a title', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('Idea title is required.')).toBeInTheDocument()
  })

  it('requires a rejection reason when planning state is rejected', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.type(screen.getByLabelText('Title'), 'Try twilight route')
    await user.click(screen.getByRole('combobox', { name: 'Planning state' }))
    await user.click(screen.getByRole('option', { name: 'Rejected' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('Rejection reason is required.')).toBeInTheDocument()
  })

  it('validates coordinate pairs and ranges', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.type(screen.getByLabelText('Title'), 'Check cliffs')
    await user.type(screen.getByLabelText('Latitude'), '51.7')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Enter both latitude and longitude.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Longitude'), 'abc')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Latitude and longitude must be numeric.')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Latitude'))
    await user.clear(screen.getByLabelText('Longitude'))
    await user.type(screen.getByLabelText('Latitude'), '91')
    await user.type(screen.getByLabelText('Longitude'), '-1')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Latitude must be between -90 and 90.')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Latitude'))
    await user.clear(screen.getByLabelText('Longitude'))
    await user.type(screen.getByLabelText('Latitude'), '51.7')
    await user.type(screen.getByLabelText('Longitude'), '181')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Longitude must be between -180 and 180.')).toBeInTheDocument()
  })

  it('submits a valid coordinate location', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEditor()

    await user.type(screen.getByLabelText('Title'), 'Find hill viewpoint')
    await user.type(screen.getByLabelText('Latitude'), '51.701')
    await user.type(screen.getByLabelText('Longitude'), '-2.101')
    await user.click(screen.getByLabelText('Approximate location'))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        location: expect.objectContaining({
          latitude: 51.701,
          longitude: -2.101,
          approximate: true,
        }),
      }),
    )
  })

  it('validates reference metadata and prevents submit', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEditor()

    await user.type(screen.getByLabelText('Title'), 'Collect route notes')
    await user.click(screen.getByRole('button', { name: 'Add reference' }))
    await user.type(screen.getByLabelText('Preview image URL'), 'http://example.com/preview.jpg')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('Reference title is required.')).toBeInTheDocument()
    expect(screen.getByText('Reference URL must start with https://.')).toBeInTheDocument()
    expect(screen.getByText('Preview image URL must start with https://.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('supports add, reorder, and remove for references', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: 'Add reference' }))
    await user.click(screen.getByRole('button', { name: 'Add reference' }))
    const titles = screen.getAllByLabelText('Reference title')
    await user.type(titles[0]!, 'First')
    await user.type(titles[1]!, 'Second')

    await user.click(screen.getByRole('button', { name: 'Move reference 1 up' }))
    await user.click(screen.getByRole('button', { name: 'Move reference 2 up' }))

    const reorderedTitles = screen.getAllByLabelText('Reference title')
    expect(reorderedTitles[0]).toHaveValue('Second')
    expect(reorderedTitles[1]).toHaveValue('First')

    await user.click(screen.getByRole('button', { name: 'Move reference 2 down' }))
    await user.click(screen.getByRole('button', { name: 'Remove reference 2' }))
    expect(screen.getAllByLabelText('Reference title')).toHaveLength(1)
  })

  it('submits trimmed reference metadata', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEditor({
      initialReferences: [
        {
          referenceId: 'r1',
          title: ' Guide ',
          url: 'https://example.com/guide ',
          description: ' Details ',
          previewImageUrl: 'https://example.com/preview.jpg ',
        },
      ],
    })

    await user.type(screen.getByLabelText('Title'), 'Check travel notes')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        references: [
          expect.objectContaining({
            title: 'Guide',
            url: 'https://example.com/guide',
            description: 'Details',
            previewImageUrl: 'https://example.com/preview.jpg',
          }),
        ],
      }),
    )
  })

  it('shows the provided error message', () => {
    renderEditor({ errorMessage: 'Failed to save idea.' })
    expect(screen.getByText('Failed to save idea.')).toBeInTheDocument()
  })

  it('prompts before cancelling dirty changes and allows confirmed cancel', async () => {
    const user = userEvent.setup()
    const { onCancel } = renderEditor()
    const confirmSpy = vi.spyOn(window, 'confirm')

    await user.type(screen.getByLabelText('Title'), 'Pending edit')

    confirmSpy.mockReturnValueOnce(false)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).not.toHaveBeenCalled()

    confirmSpy.mockReturnValueOnce(true)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('deletes when requested', async () => {
    const user = userEvent.setup()
    const { onDelete } = renderEditor()

    await user.click(screen.getByRole('button', { name: 'Delete idea' }))

    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})
