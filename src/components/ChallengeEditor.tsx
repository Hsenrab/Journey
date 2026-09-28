import { useState } from 'react'
import { Button, Card, CardContent, Checkbox, FormControlLabel, Stack, TextField } from '@mui/material'
import type { Challenge } from '../domain/visit'
import type { ChallengeDraft } from '../features/journey/JourneyContext'

type Props = {
  submitLabel: string
  onSubmit: (draft: ChallengeDraft) => void
  onCancel: () => void
  initialChallenge?: Challenge
}

type Errors = Partial<Record<'title' | 'description', string>>

export function ChallengeEditor({ submitLabel, onSubmit, onCancel, initialChallenge }: Props) {
  const [title, setTitle] = useState(initialChallenge?.title ?? '')
  const [description, setDescription] = useState(initialChallenge?.description ?? '')
  const [supportsActivityCategories, setSupportsActivityCategories] = useState(
    initialChallenge?.supportsActivityCategories ?? false,
  )
  const [errors, setErrors] = useState<Errors>({})

  return (
    <Card>
      <CardContent>
        <Stack
          component="form"
          spacing={2}
          onSubmit={(event) => {
            event.preventDefault()
            const nextErrors: Errors = {}
            if (!title.trim()) nextErrors.title = 'Challenge title is required.'
            if (!description.trim()) nextErrors.description = 'Challenge description is required.'
            setErrors(nextErrors)
            if (Object.keys(nextErrors).length > 0) return
            onSubmit({ title: title.trim(), description: description.trim(), supportsActivityCategories })
          }}
        >
          <TextField
            label="Title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            error={Boolean(errors.title)}
            helperText={errors.title}
          />
          <TextField
            label="Description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            multiline
            minRows={2}
            error={Boolean(errors.description)}
            helperText={errors.description}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={supportsActivityCategories}
                onChange={(event) => setSupportsActivityCategories(event.target.checked)}
              />
            }
            label="Supports Bronze, Silver and Gold activity categories"
          />
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
            <Button onClick={onCancel}>Cancel</Button>
            <Button type="submit" variant="contained">
              {submitLabel}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}
