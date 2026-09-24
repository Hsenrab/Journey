import type { ComponentProps } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IdeaEditor } from './IdeaEditor'
import { WaypointsProvider } from '../features/journey/JourneyContext'
import { createDefaultData, setDataMode } from '../services/storage'
import type { IdeaDraft } from '../features/journey/JourneyContext'
import type { JourneyRole } from '../services/principal'

function renderEditor(overrides: Partial<ComponentProps<typeof IdeaEditor>> = {}) {
  const onSubmit = vi.fn<(draft: IdeaDraft) => void>()
  const onCancel = vi.fn()
  const onDelete = vi.fn()
  const data = createDefaultData()

  render(
    <MemoryRouter>
      <WaypointsProvider>
        <IdeaEditor
          data={data}
          submitLabel="Save"
          onSubmit={onSubmit}
          onCancel={onCancel}
          onDelete={onDelete}
          {...overrides}
        />
      </WaypointsProvider>
    </MemoryRouter>,
  )

  return { onSubmit, onCancel, onDelete }
}

async function renderProductionEditor(
  role: JourneyRole,
  userId: string,
  overrides: Partial<ComponentProps<typeof IdeaEditor>> = {},
) {
  vi.stubEnv('MODE', 'production')
  setDataMode('production')
  const data = overrides.data ?? createDefaultData()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/.auth/me') {
        return new Response(
          JSON.stringify({
            clientPrincipal: { identityProvider: 'aad', userId, userDetails: userId, userRoles: [role] },
          }),
          { status: 200 },
        )
      }
      if (url === '/api/journey/production') return new Response(JSON.stringify({ data, etags: {} }), { status: 200 })
      return new Response(null, { status: 404 })
    }),
  )
  renderEditor(overrides)
  await screen.findByText('Owner')
}

describe('IdeaEditor', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
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

  it('ignores approximate and source fields without location details', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEditor()

    await user.type(screen.getByLabelText('Title'), 'Find hill viewpoint')
    await user.type(screen.getByLabelText('Source'), 'Guidebook')
    await user.click(screen.getByLabelText('Approximate location'))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        location: undefined,
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
          ownerId: 'owner-1',
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

  it('loads valid pasted JSON into the form before submit', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEditor({ initialWaypointId: 'stourhead' })
    const payload = {
      title: 'Load from JSON',
      description: 'A plan loaded from pasted JSON',
      notes: 'Extra notes',
      planningState: 'active',
      difficulty: 2,
      location: { placeName: 'Stourhead', approximate: true },
      references: [{ title: 'Guide', url: 'https://example.com/guide', description: '', previewImageUrl: '' }],
    }

    await user.click(screen.getByRole('tab', { name: 'Paste JSON' }))
    await user.click(screen.getByLabelText('Idea JSON'))
    await user.paste(JSON.stringify(payload))
    await user.click(screen.getByRole('button', { name: 'Load into form' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: payload.title,
        description: payload.description,
        notes: payload.notes,
        waypointIds: ['stourhead'],
        planningState: payload.planningState,
        difficulty: payload.difficulty,
        references: [expect.objectContaining({ title: 'Guide' })],
      }),
    )
  })

  it('keeps pasted JSON and shows malformed and schema errors', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('tab', { name: 'Paste JSON' }))
    const input = screen.getByLabelText('Idea JSON')

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
        description: 'x',
        notes: 123,
        planningState: 'active',
        difficulty: 1,
        references: [],
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Load into form' }))
    expect(screen.getByText('JSON does not match the idea draft shape.')).toBeInTheDocument()
    expect(screen.getByText(/notes: Invalid input/)).toBeInTheDocument()
  })

  it('rejects arrays and forbidden id fields in pasted JSON', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('tab', { name: 'Paste JSON' }))
    const input = screen.getByLabelText('Idea JSON')

    await user.click(input)
    await user.paste('[]')
    await user.click(screen.getByRole('button', { name: 'Load into form' }))
    expect(screen.getByText('Paste a single object, not an array.')).toBeInTheDocument()

    await user.clear(input)
    await user.click(input)
    await user.paste(
      JSON.stringify({
        ideaId: 'idea-1',
        ownerId: 'owner-1',
        title: 'Bad draft',
        description: '',
        notes: '',
        planningState: 'active',
        difficulty: 1,
        references: [],
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Load into form' }))
    expect(screen.getByText(/Remove 'ideaId' — IDs are assigned automatically./)).toBeInTheDocument()
  })

  it('shows an inline error when clipboard write is unavailable', async () => {
    const user = userEvent.setup()
    renderEditor()
    const originalClipboard = navigator.clipboard
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    })

    try {
      await user.click(screen.getByRole('tab', { name: 'Paste JSON' }))
      await user.click(screen.getByLabelText('Idea JSON'))
      await user.paste(
        JSON.stringify({
          title: 'Bad draft',
          description: 'x',
          notes: 123,
          planningState: 'active',
          difficulty: 1,
          references: [],
        }),
      )
      await user.click(screen.getByRole('button', { name: 'Load into form' }))
      expect(screen.getByText(/notes: Invalid input/)).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Copy example JSON' }))
      expect(screen.getByText('Clipboard is unavailable in this browser.')).toBeInTheDocument()
      expect(screen.queryByText(/notes: Invalid input/)).not.toBeInTheDocument()
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      })
    }
  })

  it('shows an AI prompt button that opens the Idea JSON prompt dialog', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('tab', { name: 'Paste JSON' }))
    await user.click(screen.getByRole('button', { name: 'Idea JSON AI prompt' }))
    expect(screen.getByRole('heading', { name: 'Idea JSON AI prompt' })).toBeInTheDocument()
    expect(screen.getByDisplayValue(/planning or research record/)).toBeInTheDocument()
  })

  it('shows the viewer ownership note and hides delete for viewers', async () => {
    const initialIdea = {
      ideaId: 'idea-1',
      ownerId: 'owner-1',
      title: 'Shared idea',
      description: '',
      notes: '',
      waypointIds: [],
      planningState: 'active' as const,
      difficulty: 1 as const,
      referenceIds: [],
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    }
    await renderProductionEditor('viewer', 'viewer-1', { initialIdea })

    expect(screen.queryByRole('button', { name: 'Delete idea' })).not.toBeInTheDocument()
    expect(screen.getByText('You can view and link to this entity, but cannot modify it.')).toBeInTheDocument()
  })

  it('shows the editor ownership note and hides delete for non-owned ideas', async () => {
    const initialIdea = {
      ideaId: 'idea-1',
      ownerId: 'owner-1',
      title: 'Shared idea',
      description: '',
      notes: '',
      waypointIds: [],
      planningState: 'active' as const,
      difficulty: 1 as const,
      referenceIds: [],
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    }
    await renderProductionEditor('editor', 'editor-1', { initialIdea })

    expect(screen.queryByRole('button', { name: 'Delete idea' })).not.toBeInTheDocument()
    expect(screen.getByText('You can only edit entities you created.')).toBeInTheDocument()
  })

  it('shows delete for editors on their own ideas', async () => {
    const initialIdea = {
      ideaId: 'idea-1',
      ownerId: 'editor-1',
      title: 'Owned idea',
      description: '',
      notes: '',
      waypointIds: [],
      planningState: 'active' as const,
      difficulty: 1 as const,
      referenceIds: [],
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    }
    await renderProductionEditor('editor', 'editor-1', { initialIdea })

    expect(screen.getByRole('button', { name: 'Delete idea' })).toBeInTheDocument()
  })

  it('shows delete for owners on any idea', async () => {
    const initialIdea = {
      ideaId: 'idea-1',
      ownerId: 'other-owner',
      title: 'Owned elsewhere',
      description: '',
      notes: '',
      waypointIds: [],
      planningState: 'active' as const,
      difficulty: 1 as const,
      referenceIds: [],
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    }
    await renderProductionEditor('owner', 'owner-1', { initialIdea })

    expect(screen.getByRole('button', { name: 'Delete idea' })).toBeInTheDocument()
  })
})
