import { useMemo, useState } from 'react'
import { useBeforeUnload } from 'react-router-dom'
import {
  Alert,
  Autocomplete,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import type { Waypoint, WaypointsData } from '../domain/visit'
import { parseWaypointDraftJson, waypointImportExample } from '../domain/draftJsonImport'
import { waypointJsonAiPrompt } from '../domain/aiPrompts'
import { AiPromptButton } from './AiPromptButton'
import type { WaypointDraft } from '../features/journey/JourneyContext'

type Props = {
  data: WaypointsData
  submitLabel: string
  onSubmit: (draft: WaypointDraft) => void
  onCancel?: () => void
  errorMessage?: string | null
}

type EditorReference = {
  referenceId?: string
  title: string
  description: string
  url: string
  previewImageUrl: string
}

type EditorPhotoReference = {
  photoReferenceId?: string
  title: string
  altText: string
  url: string
}

type Errors = Record<string, string>
type EditorMode = 'form' | 'json'

export function WaypointEditor({ data, submitLabel, onSubmit, onCancel, errorMessage }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [challengeIds, setChallengeIds] = useState<string[]>(
    data.challenges.some((challenge) => challenge.challengeId === 'national-trust') ? ['national-trust'] : [],
  )
  const [completionMode, setCompletionMode] = useState<Waypoint['completion']['mode']>('once')
  const [completionTarget, setCompletionTarget] = useState('1')
  const [placeName, setPlaceName] = useState('')
  const [addressOrRegion, setAddressOrRegion] = useState('')
  const [source, setSource] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [approximate, setApproximate] = useState(false)
  const [references, setReferences] = useState<EditorReference[]>([])
  const [photoReferences, setPhotoReferences] = useState<EditorPhotoReference[]>([])
  const [errors, setErrors] = useState<Errors>({})
  const [mode, setMode] = useState<EditorMode>('form')
  const [jsonInput, setJsonInput] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [jsonIssues, setJsonIssues] = useState<string[]>([])

  const dirty = useMemo(
    () =>
      JSON.stringify({
        title,
        description,
        category,
        tagsInput,
        challengeIds,
        completionMode,
        completionTarget,
        placeName,
        addressOrRegion,
        source,
        latitude,
        longitude,
        approximate,
        references,
        photoReferences,
      }) !==
      JSON.stringify({
        title: '',
        description: '',
        category: '',
        tagsInput: '',
        challengeIds: data.challenges.some((challenge) => challenge.challengeId === 'national-trust')
          ? ['national-trust']
          : [],
        completionMode: 'once',
        completionTarget: '1',
        placeName: '',
        addressOrRegion: '',
        source: '',
        latitude: '',
        longitude: '',
        approximate: false,
        references: [],
        photoReferences: [],
      }),
    [
      addressOrRegion,
      approximate,
      category,
      challengeIds,
      completionMode,
      completionTarget,
      data.challenges,
      description,
      latitude,
      longitude,
      photoReferences,
      placeName,
      references,
      source,
      tagsInput,
      title,
    ],
  )

  useBeforeUnload(
    (event) => {
      if (dirty) event.preventDefault()
    },
    { capture: true },
  )

  const validate = (): {
    errors: Errors
    location?: Waypoint['location']
    completion: Waypoint['completion']
    tags: string[]
  } => {
    const nextErrors: Errors = {}
    if (!title.trim()) nextErrors.title = 'Waypoint title is required.'
    if (!description.trim()) nextErrors.description = 'Waypoint description is required.'
    if (!category.trim()) nextErrors.category = 'Waypoint category is required.'
    if (challengeIds.length === 0) nextErrors.challengeIds = 'Select at least one challenge.'

    const tags = tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)

    let completion: Waypoint['completion'] = { mode: 'once' }
    if (completionMode === 'count') {
      const parsedTarget = Number(completionTarget)
      if (!Number.isInteger(parsedTarget) || parsedTarget <= 0) {
        nextErrors.completionTarget = 'Target must be a positive whole number.'
      } else {
        completion = { mode: 'count', target: parsedTarget }
      }
    }

    let location: Waypoint['location'] | undefined
    const hasLocation =
      Boolean(placeName.trim()) ||
      Boolean(addressOrRegion.trim()) ||
      Boolean(source.trim()) ||
      Boolean(latitude.trim()) ||
      Boolean(longitude.trim())
    if (hasLocation) {
      location = {
        placeName: placeName.trim() || undefined,
        addressOrRegion: addressOrRegion.trim() || undefined,
        source: source.trim() || undefined,
        approximate: approximate || undefined,
      }
      if (latitude.trim() || longitude.trim()) {
        if (!latitude.trim() || !longitude.trim()) {
          nextErrors.coordinates = 'Enter both latitude and longitude.'
        } else {
          const parsedLatitude = Number(latitude)
          const parsedLongitude = Number(longitude)
          if (Number.isNaN(parsedLatitude) || Number.isNaN(parsedLongitude)) {
            nextErrors.coordinates = 'Latitude and longitude must be numeric.'
          } else if (parsedLatitude < -90 || parsedLatitude > 90) {
            nextErrors.coordinates = 'Latitude must be between -90 and 90.'
          } else if (parsedLongitude < -180 || parsedLongitude > 180) {
            nextErrors.coordinates = 'Longitude must be between -180 and 180.'
          } else {
            location.latitude = parsedLatitude
            location.longitude = parsedLongitude
          }
        }
      }
    }

    references.forEach((reference, index) => {
      if (!reference.title.trim()) nextErrors[`reference-${index}-title`] = 'Reference title is required.'
      if (!reference.url.trim().startsWith('https://')) {
        nextErrors[`reference-${index}-url`] = 'Reference URL must start with https://.'
      }
      if (reference.previewImageUrl.trim() && !reference.previewImageUrl.trim().startsWith('https://')) {
        nextErrors[`reference-${index}-preview`] = 'Preview image URL must start with https://.'
      }
    })
    photoReferences.forEach((photoReference, index) => {
      if (!photoReference.title.trim()) nextErrors[`photo-${index}-title`] = 'Photo title is required.'
      if (!photoReference.url.trim().startsWith('https://')) {
        nextErrors[`photo-${index}-url`] = 'Photo URL must start with https://.'
      }
    })

    return { errors: nextErrors, location, completion, tags }
  }

  return (
    <Card>
      <CardContent>
        <Stack
          component="form"
          spacing={2}
          onSubmit={(event) => {
            event.preventDefault()
            if (mode === 'json') return
            const result = validate()
            if (Object.keys(result.errors).length > 0) {
              setErrors(result.errors)
              return
            }
            setErrors({})
            onSubmit({
              title: title.trim(),
              description: description.trim(),
              category: category.trim(),
              tags: result.tags,
              challengeIds,
              completion: result.completion,
              location: result.location,
              references: references.map((reference) => ({
                referenceId: reference.referenceId,
                title: reference.title.trim(),
                description: reference.description.trim() || undefined,
                url: reference.url.trim(),
                previewImageUrl: reference.previewImageUrl.trim() || undefined,
              })),
              photoReferences: photoReferences.map((photoReference) => ({
                photoReferenceId: photoReference.photoReferenceId,
                title: photoReference.title.trim(),
                altText: photoReference.altText.trim() || undefined,
                url: photoReference.url.trim(),
              })),
            })
          }}
        >
          <Tabs
            value={mode}
            onChange={(_, next: EditorMode) => setMode(next)}
            aria-label="Waypoint input mode"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Form" value="form" />
            <Tab label="Paste JSON" value="json" />
          </Tabs>

          {mode === 'json' && (
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Generate with AI
                </Typography>
                <AiPromptButton label="Waypoint JSON" prompt={waypointJsonAiPrompt} />
              </Stack>
              <TextField
                label="Waypoint JSON"
                value={jsonInput}
                onChange={(event) => setJsonInput(event.target.value)}
                multiline
                minRows={10}
              />
              <Stack direction="row" spacing={1}>
                <Button
                  onClick={() => {
                    const clipboard = navigator.clipboard
                    if (!clipboard?.writeText) {
                      setJsonError('Clipboard is unavailable in this browser.')
                      setJsonIssues([])
                      return
                    }
                    void clipboard.writeText(JSON.stringify(waypointImportExample, null, 2)).catch((error) => {
                      const message = error instanceof Error ? error.message : String(error)
                      setJsonError(`Could not copy example JSON: ${message}`)
                      setJsonIssues([])
                    })
                  }}
                >
                  Copy example JSON
                </Button>
                <Button
                  variant="contained"
                  onClick={() => {
                    const parsed = parseWaypointDraftJson(jsonInput)
                    if (!parsed.ok) {
                      setJsonError(parsed.error)
                      setJsonIssues(parsed.issues)
                      return
                    }

                    setTitle(parsed.value.title)
                    setDescription(parsed.value.description)
                    setCategory(parsed.value.category)
                    setTagsInput(parsed.value.tags.join(', '))
                    setChallengeIds(parsed.value.challengeIds)
                    setCompletionMode(parsed.value.completion.mode)
                    setCompletionTarget(
                      parsed.value.completion.mode === 'count' ? String(parsed.value.completion.target) : '1',
                    )
                    setPlaceName(parsed.value.location?.placeName ?? '')
                    setAddressOrRegion(parsed.value.location?.addressOrRegion ?? '')
                    setSource(parsed.value.location?.source ?? '')
                    setLatitude(
                      parsed.value.location?.latitude === undefined ? '' : String(parsed.value.location.latitude),
                    )
                    setLongitude(
                      parsed.value.location?.longitude === undefined ? '' : String(parsed.value.location.longitude),
                    )
                    setApproximate(parsed.value.location?.approximate ?? false)
                    setReferences(
                      parsed.value.references.map((reference) => ({
                        title: reference.title,
                        description: reference.description ?? '',
                        url: reference.url,
                        previewImageUrl: reference.previewImageUrl ?? '',
                      })),
                    )
                    setPhotoReferences(
                      parsed.value.photoReferences.map((photoReference) => ({
                        title: photoReference.title,
                        altText: photoReference.altText ?? '',
                        url: photoReference.url,
                      })),
                    )
                    setErrors({})
                    setJsonError(null)
                    setJsonIssues([])
                    setMode('form')
                  }}
                >
                  Load into form
                </Button>
              </Stack>
              {jsonError && <Alert severity="error">{jsonError}</Alert>}
              {jsonIssues.length > 0 && (
                <Alert severity="error">
                  <ul>
                    {jsonIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </Alert>
              )}
            </Stack>
          )}

          {mode === 'form' && (
            <>
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
              <TextField
                label="Category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                error={Boolean(errors.category)}
                helperText={errors.category}
              />
              <TextField
                label="Tags (comma-separated)"
                value={tagsInput}
                onChange={(event) => setTagsInput(event.target.value)}
              />
              <Autocomplete
                multiple
                options={data.challenges}
                value={data.challenges.filter((challenge) => challengeIds.includes(challenge.challengeId))}
                getOptionLabel={(challenge) => challenge.title}
                onChange={(_, next) => setChallengeIds(next.map((challenge) => challenge.challengeId))}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Challenges"
                    error={Boolean(errors.challengeIds)}
                    helperText={errors.challengeIds}
                  />
                )}
              />
              <TextField
                select
                label="Completion mode"
                value={completionMode}
                onChange={(event) => setCompletionMode(event.target.value as Waypoint['completion']['mode'])}
              >
                <MenuItem value="once">Once</MenuItem>
                <MenuItem value="count">Count</MenuItem>
              </TextField>
              {completionMode === 'count' && (
                <TextField
                  label="Completion target"
                  value={completionTarget}
                  onChange={(event) => setCompletionTarget(event.target.value)}
                  error={Boolean(errors.completionTarget)}
                  helperText={errors.completionTarget}
                />
              )}
              <Stack spacing={1}>
                <TextField
                  label="Place name"
                  value={placeName}
                  onChange={(event) => setPlaceName(event.target.value)}
                />
                <TextField
                  label="Address or region"
                  value={addressOrRegion}
                  onChange={(event) => setAddressOrRegion(event.target.value)}
                />
                <TextField label="Source" value={source} onChange={(event) => setSource(event.target.value)} />
                <TextField label="Latitude" value={latitude} onChange={(event) => setLatitude(event.target.value)} />
                <TextField label="Longitude" value={longitude} onChange={(event) => setLongitude(event.target.value)} />
                <FormControlLabel
                  control={
                    <Checkbox checked={approximate} onChange={(event) => setApproximate(event.target.checked)} />
                  }
                  label="Approximate location"
                />
                {errors.coordinates && <Alert severity="error">{errors.coordinates}</Alert>}
              </Stack>

              <Stack spacing={1}>
                {references.map((reference, index) => (
                  <Card key={index} variant="outlined">
                    <CardContent>
                      <Stack spacing={1}>
                        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong>Reference {index + 1}</strong>
                          <IconButton
                            aria-label={`Remove reference ${index + 1}`}
                            onClick={() => setReferences(references.filter((_, itemIndex) => itemIndex !== index))}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Stack>
                        <TextField
                          label="Title"
                          value={reference.title}
                          onChange={(event) =>
                            setReferences(
                              references.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, title: event.target.value } : item,
                              ),
                            )
                          }
                          error={Boolean(errors[`reference-${index}-title`])}
                          helperText={errors[`reference-${index}-title`]}
                        />
                        <TextField
                          label="URL"
                          value={reference.url}
                          onChange={(event) =>
                            setReferences(
                              references.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, url: event.target.value } : item,
                              ),
                            )
                          }
                          error={Boolean(errors[`reference-${index}-url`])}
                          helperText={errors[`reference-${index}-url`]}
                        />
                        <TextField
                          label="Description"
                          value={reference.description}
                          onChange={(event) =>
                            setReferences(
                              references.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, description: event.target.value } : item,
                              ),
                            )
                          }
                        />
                        <TextField
                          label="Preview image URL"
                          value={reference.previewImageUrl}
                          onChange={(event) =>
                            setReferences(
                              references.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, previewImageUrl: event.target.value } : item,
                              ),
                            )
                          }
                          error={Boolean(errors[`reference-${index}-preview`])}
                          helperText={errors[`reference-${index}-preview`]}
                        />
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
                <Button
                  onClick={() =>
                    setReferences([...references, { title: '', url: '', description: '', previewImageUrl: '' }])
                  }
                >
                  Add reference
                </Button>
              </Stack>

              <Stack spacing={1}>
                {photoReferences.map((photoReference, index) => (
                  <Card key={index} variant="outlined">
                    <CardContent>
                      <Stack spacing={1}>
                        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong>Photo {index + 1}</strong>
                          <IconButton
                            aria-label={`Remove photo ${index + 1}`}
                            onClick={() =>
                              setPhotoReferences(photoReferences.filter((_, itemIndex) => itemIndex !== index))
                            }
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Stack>
                        <TextField
                          label="Title"
                          value={photoReference.title}
                          onChange={(event) =>
                            setPhotoReferences(
                              photoReferences.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, title: event.target.value } : item,
                              ),
                            )
                          }
                          error={Boolean(errors[`photo-${index}-title`])}
                          helperText={errors[`photo-${index}-title`]}
                        />
                        <TextField
                          label="URL"
                          value={photoReference.url}
                          onChange={(event) =>
                            setPhotoReferences(
                              photoReferences.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, url: event.target.value } : item,
                              ),
                            )
                          }
                          error={Boolean(errors[`photo-${index}-url`])}
                          helperText={errors[`photo-${index}-url`]}
                        />
                        <TextField
                          label="Alt text"
                          value={photoReference.altText}
                          onChange={(event) =>
                            setPhotoReferences(
                              photoReferences.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, altText: event.target.value } : item,
                              ),
                            )
                          }
                        />
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
                <Button onClick={() => setPhotoReferences([...photoReferences, { title: '', url: '', altText: '' }])}>
                  Add photo reference
                </Button>
              </Stack>
            </>
          )}

          {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
            {onCancel && <Button onClick={onCancel}>Cancel</Button>}
            {mode === 'form' && (
              <Button type="submit" variant="contained">
                {submitLabel}
              </Button>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}
