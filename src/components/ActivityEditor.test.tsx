import type { ComponentProps } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ActivityEditor } from './ActivityEditor'
import { createDefaultData } from '../services/storage'
import type { ActivityDraft } from '../features/journey/JourneyContext'

function renderEditor(overrides: Partial<ComponentProps<typeof ActivityEditor>> = {}) {
  const onSubmit = vi.fn<(draft: ActivityDraft) => void>()
  const onCancel = vi.fn()
  const onDelete = vi.fn()
  const data = createDefaultData()

  render(
    <MemoryRouter>
      <ActivityEditor
        data={data}
        submitLabel="Save"
        onSubmit={onSubmit}
        onCancel={onCancel}
        onDelete={onDelete}
        {...overrides}
      />
    </MemoryRouter>,
  )

  return { data, onSubmit, onCancel, onDelete }
}

describe('ActivityEditor', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('submits postcode activity data', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEditor()

    await user.type(screen.getByLabelText('Postcode'), 'GL1 1AA')
    await user.type(screen.getByLabelText('Description / notes'), 'Nice day')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        location: { kind: 'postcode', postcode: 'GL1 1AA' },
        notes: 'Nice day',
      }),
    )
  })

  it('validates coordinate pairs', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('combobox', { name: 'Location type' }))
    await user.click(screen.getByRole('option', { name: 'Latitude and longitude' }))
    await user.type(screen.getByLabelText('Latitude'), '91')
    await user.type(screen.getByLabelText('Longitude'), '-1')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('Latitude must be between -90 and 90.')).toBeInTheDocument()
  })

  it('requires complete coordinate pairs and longitude range', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('combobox', { name: 'Location type' }))
    await user.click(screen.getByRole('option', { name: 'Latitude and longitude' }))
    await user.type(screen.getByLabelText('Latitude'), '51.75')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Enter both latitude and longitude.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Longitude'), '181')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Longitude must be between -180 and 180.')).toBeInTheDocument()
  })

  it('shows category for eligible waypoints and clears it when unlinked', async () => {
    const user = userEvent.setup()
    const { data } = renderEditor({ initialWaypointId: dataWaypointId(createDefaultData()) })

    await user.click(screen.getByRole('combobox', { name: 'Activity category' }))
    await user.click(screen.getByRole('option', { name: 'Gold' }))

    await user.click(screen.getByRole('combobox', { name: 'Linked waypoint' }))
    await user.click(screen.getByRole('option', { name: 'No linked waypoint' }))

    expect(
      screen.getByText('Category cleared because the selected waypoint does not support Bronze, Silver or Gold.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Activity category' })).not.toBeInTheDocument()

    expect(
      data.challenges.find((challenge) => challenge.challengeId === 'national-trust')?.supportsActivityCategories,
    ).toBe(true)
  })

  it('requires category when waypoint supports categories', async () => {
    const user = userEvent.setup()
    renderEditor({ initialWaypointId: dataWaypointId(createDefaultData()) })

    await user.type(screen.getByLabelText('Postcode'), 'GL1 1AA')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('Select Bronze, Silver or Gold.')).toBeInTheDocument()
  })

  it('supports add, reorder and remove for references and photos', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: 'Add reference' }))
    await user.click(screen.getByRole('button', { name: 'Add reference' }))
    await user.click(screen.getByRole('button', { name: 'Move reference 2 up' }))
    await user.click(screen.getByRole('button', { name: 'Remove reference 2' }))

    await user.click(screen.getByRole('button', { name: 'Add photo reference' }))
    await user.click(screen.getByRole('button', { name: 'Add photo reference' }))
    await user.click(screen.getByRole('button', { name: 'Move photo 2 up' }))
    await user.click(screen.getByRole('button', { name: 'Remove photo 2' }))

    expect(screen.getAllByLabelText('Reference title')).toHaveLength(1)
    expect(screen.getAllByLabelText('Photo title')).toHaveLength(1)
  })

  it('validates reference and photo metadata rules', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEditor()

    await user.click(screen.getByRole('button', { name: 'Add reference' }))
    await user.type(screen.getByLabelText('Preview image URL'), 'http://example.com/preview.jpg')
    await user.click(screen.getByRole('button', { name: 'Add photo reference' }))
    await user.type(screen.getByLabelText('Photo URL'), 'http://example.com/photo.jpg')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('Reference title is required.')).toBeInTheDocument()
    expect(screen.getByText('Reference URL must start with https://.')).toBeInTheDocument()
    expect(screen.getByText('Preview image URL must start with https://.')).toBeInTheDocument()
    expect(screen.getByText('Photo title is required.')).toBeInTheDocument()
    expect(screen.getByText('Photo URL must start with https://.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits a valid coordinate pair', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEditor()

    await user.click(screen.getByRole('combobox', { name: 'Location type' }))
    await user.click(screen.getByRole('option', { name: 'Latitude and longitude' }))
    await user.type(screen.getByLabelText('Latitude'), '51.75')
    await user.type(screen.getByLabelText('Longitude'), '-1.26')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ location: { kind: 'coordinates', latitude: 51.75, longitude: -1.26 } }),
    )
  })

  it('uses waypoint coordinates as initial location when available', () => {
    const data = createDefaultData()
    data.waypoints[0] = {
      ...data.waypoints[0]!,
      location: { latitude: 51.75, longitude: -1.26 },
    }
    renderEditor({ data, initialWaypointId: data.waypoints[0]!.waypointId })
    expect(screen.getByLabelText('Latitude')).toHaveValue('51.75')
    expect(screen.getByLabelText('Longitude')).toHaveValue('-1.26')
  })

  it('prompts before cancelling dirty changes', async () => {
    const user = userEvent.setup()
    const { onCancel } = renderEditor()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    await user.type(screen.getByLabelText('Postcode'), 'GL1 1AA')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(confirmSpy).toHaveBeenCalledWith('You have unsaved changes. Leave this page?')
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('allows cancel when confirmation is accepted', async () => {
    const user = userEvent.setup()
    const { onCancel } = renderEditor()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    await user.type(screen.getByLabelText('Postcode'), 'GL1 1AA')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalled()
  })

  it('cancels immediately when there are no unsaved changes', async () => {
    const user = userEvent.setup()
    const { onCancel } = renderEditor()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalled()
  })

  it('calls delete callback', async () => {
    const user = userEvent.setup()
    const { onDelete } = renderEditor()

    await user.click(screen.getByRole('button', { name: 'Delete activity' }))

    expect(onDelete).toHaveBeenCalled()
  })
})

function dataWaypointId(data: ReturnType<typeof createDefaultData>) {
  return data.waypoints[0]!.waypointId
}
