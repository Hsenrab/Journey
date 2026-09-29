import { useState, type FormEvent } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined'
import { EmptyState } from '../components/EmptyState'
import { LoadFailureAlert } from '../components/LoadFailureAlert'
import { LoadingNotice } from '../components/LoadingNotice'
import { ClickableCard } from '../components/ClickableCard'
import { PageHeader } from '../components/PageHeader'
import { ReadOnlyNotice } from '../components/ReadOnlyNotice'
import {
  awardableStatuses,
  challengeWaypoints,
  completedWaypointCount,
  countLabel,
  lastActivityDate,
  recentlyVisited,
  statusCounts,
  statusForWaypoint,
  statusLabels,
} from '../domain/visit'
import { useWaypoints } from '../features/journey/JourneyContext'
import { JourneyConflictError } from '../services/journeyApi'

export default function Dashboard() {
  const { addChallenge, data, loadState, readOnly, reload } = useWaypoints()
  const [showEditor, setShowEditor] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<{ title?: string; description?: string }>({})
  const [supportsActivityCategories, setSupportsActivityCategories] = useState(false)
  const [message, setMessage] = useState<{ text: string; severity: 'success' | 'error'; conflict: boolean } | null>(
    null,
  )

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = {
      title: title.trim() ? undefined : 'Title is required.',
      description: description.trim() ? undefined : 'Description is required.',
    }
    setErrors(nextErrors)
    if (nextErrors.title || nextErrors.description) return

    try {
      await addChallenge({ title, description, supportsActivityCategories })
      setShowEditor(false)
      setTitle('')
      setDescription('')
      setErrors({})
      setSupportsActivityCategories(false)
      setMessage({ text: 'Challenge saved.', severity: 'success', conflict: false })
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : String(error),
        severity: 'error',
        conflict: error instanceof JourneyConflictError,
      })
    }
  }

  const reloadLatest = async () => {
    const result = await reload()
    if (result.status === 'failure') {
      setMessage({ text: result.message, severity: 'error', conflict: true })
      return
    }
    if (result.status === 'superseded') return
    setMessage(null)
    setShowEditor(false)
    setTitle('')
    setDescription('')
    setErrors({})
    setSupportsActivityCategories(false)
  }

  if (loadState.status === 'failed') {
    return (
      <Stack spacing={2}>
        <PageHeader title="Challenges" />
        <LoadFailureAlert
          message={loadState.message}
          description="This is a load failure, not an empty challenge dataset."
        />
      </Stack>
    )
  }

  if (loadState.status === 'loading') {
    return (
      <Stack spacing={2}>
        <PageHeader title="Challenges" />
        <LoadingNotice message="Loading challenge data…" />
      </Stack>
    )
  }

  const waypoints = data.waypoints
  const activities = data.activities
  const counts = statusCounts(waypoints, activities)
  const recent = recentlyVisited(waypoints, activities)

  return (
    <Stack spacing={3}>
      <PageHeader title="Challenges">
        {!readOnly && !showEditor && (
          <Button
            variant="contained"
            onClick={() => {
              setMessage(null)
              setErrors({})
              setShowEditor(true)
            }}
          >
            Add challenge
          </Button>
        )}
      </PageHeader>
      <ReadOnlyNotice />
      {message && (
        <Alert
          severity={message.severity}
          action={
            message.conflict ? (
              <Button color="inherit" size="small" onClick={() => void reloadLatest()}>
                Reload latest
              </Button>
            ) : undefined
          }
        >
          {message.text}
        </Alert>
      )}
      {showEditor && !readOnly && (
        <Box component="form" onSubmit={(event) => void submit(event)}>
          <Stack spacing={2}>
            <Typography variant="h6">New challenge</Typography>
            <TextField
              size="small"
              label="Title"
              error={Boolean(errors.title)}
              helperText={errors.title}
              value={title}
              onChange={(event) => {
                const value = event.target.value
                setTitle(value)
                if (value.trim()) setErrors((current) => ({ ...current, title: undefined }))
              }}
            />
            <TextField
              size="small"
              label="Description"
              error={Boolean(errors.description)}
              helperText={errors.description}
              multiline
              value={description}
              onChange={(event) => {
                const value = event.target.value
                setDescription(value)
                if (value.trim()) setErrors((current) => ({ ...current, description: undefined }))
              }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={supportsActivityCategories}
                  onChange={(event) => setSupportsActivityCategories(event.target.checked)}
                />
              }
              label="Use Bronze, Silver and Gold activity categories"
            />
            <Stack direction="row" spacing={1}>
              <Button type="submit" variant="contained">
                Save challenge
              </Button>
              <Button
                onClick={() => {
                  setShowEditor(false)
                  setTitle('')
                  setDescription('')
                  setSupportsActivityCategories(false)
                  setMessage(null)
                  setErrors({})
                }}
              >
                Cancel
              </Button>
            </Stack>
          </Stack>
        </Box>
      )}
      {data.challenges.length === 0 ? (
        <EmptyState icon={<InboxOutlinedIcon color="disabled" />} message="No challenges are available yet." />
      ) : (
        <>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {data.challenges.map((challenge) => {
              const members = challengeWaypoints(challenge, waypoints)
              const complete = completedWaypointCount(members, activities)
              const completionPercent = members.length === 0 ? 0 : Math.round((complete / members.length) * 100)
              return (
                <ClickableCard key={challenge.challengeId} to={`/challenges/${challenge.challengeId}`}>
                  {(titleId) => (
                    <Stack spacing={1}>
                      <Typography id={titleId} variant="h5">
                        {challenge.title}
                      </Typography>
                      <Typography color="text.secondary">{challenge.description}</Typography>
                      <Typography>{completionPercent}% complete</Typography>
                      <Typography color="text.secondary">
                        {complete} of {members.length} waypoints completed
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={completionPercent}
                        aria-label={`${challenge.title} completion`}
                      />
                    </Stack>
                  )}
                </ClickableCard>
              )
            })}
          </Box>

          <Box>
            <Typography variant="h5" sx={{ mb: 2 }}>
              Activity categories
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              }}
            >
              {awardableStatuses.map((status) => (
                <ClickableCard
                  key={status}
                  to={`/waypoints?status=${status}`}
                  ariaLabel={`${statusLabels[status]}: ${countLabel(counts[status], 'waypoint')}`}
                >
                  {(titleId) => (
                    <>
                      <Typography id={titleId} variant="h6">
                        {statusLabels[status]}
                      </Typography>
                      <Typography variant="h4">{counts[status]}</Typography>
                    </>
                  )}
                </ClickableCard>
              ))}
            </Box>
          </Box>

          <Stack spacing={2}>
            <Typography variant="h5">Recently visited</Typography>
            {recent.length === 0 ? (
              <EmptyState
                icon={<InboxOutlinedIcon color="disabled" />}
                message="You haven't logged any activities yet."
              />
            ) : (
              <Stack spacing={1}>
                {recent.map((waypoint) => {
                  const date = lastActivityDate(activities, waypoint.waypointId)
                  return (
                    <ClickableCard key={waypoint.waypointId} to={`/waypoints/${waypoint.waypointId}`}>
                      {(titleId) => (
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          spacing={{ xs: 0.5, sm: 2 }}
                          sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' } }}
                        >
                          <Typography id={titleId} variant="h6">
                            {waypoint.title}
                          </Typography>
                          <Typography color="text.secondary">
                            {statusLabels[statusForWaypoint(activities, waypoint.waypointId)]}
                            {date ? ` · ${new Date(`${date}T00:00:00`).toLocaleDateString()}` : ''}
                          </Typography>
                        </Stack>
                      )}
                    </ClickableCard>
                  )
                })}
              </Stack>
            )}
          </Stack>
        </>
      )}
    </Stack>
  )
}
