import { useRef, useState, type KeyboardEvent, type TouchEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material'
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined'
import { ActivityEditor } from '../components/ActivityEditor'
import { DetailPageHeader } from '../components/DetailPageHeader'
import { EmptyState } from '../components/EmptyState'
import { LoadFailureAlert } from '../components/LoadFailureAlert'
import { LoadingNotice } from '../components/LoadingNotice'
import { ReadOnlyNotice } from '../components/ReadOnlyNotice'
import {
  activitySubtitle,
  activityTitle,
  formatActivityDate,
  ideasForActivity,
  locationSummary,
  statusLabels,
  type Activity,
} from '../domain/visit'
import { useWaypoints } from '../features/journey/JourneyContext'
import { JourneyConflictError } from '../services/journeyApi'

export default function ActivityDetails() {
  const { activityId = '' } = useParams()
  const navigate = useNavigate()
  const { data, loadState, readOnly, reload, updateActivity, deleteActivity } = useWaypoints()
  const [editing, setEditing] = useState(false)
  const [photoIndex, setPhotoIndex] = useState(0)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [brokenPhotoIds, setBrokenPhotoIds] = useState<string[]>([])
  const [message, setMessage] = useState<{ severity: 'success' | 'error'; text: string; conflict?: boolean } | null>(
    null,
  )
  const [deletedActivity, setDeletedActivity] = useState<Activity | null>(null)

  const loadedActivity = data.activities.find((item) => item.activityId === activityId)
  const activity = loadedActivity ?? (deletedActivity?.activityId === activityId ? deletedActivity : undefined)
  const activityDeleted = !loadedActivity && deletedActivity?.activityId === activityId
  const waypoint = activity?.waypointId
    ? data.waypoints.find((item) => item.waypointId === activity.waypointId)
    : undefined
  const breadcrumbs = waypoint
    ? [
        { label: 'Waypoints', to: '/waypoints' },
        { label: waypoint.title, to: `/waypoints/${waypoint.waypointId}` },
      ]
    : [{ label: 'Activities', to: '/activities' }]
  const backTarget = breadcrumbs[breadcrumbs.length - 1].to

  if (!activity) {
    return (
      <Stack spacing={3}>
        <DetailPageHeader breadcrumbs={breadcrumbs} title="Activity" />
        {loadState.status === 'failed' ? (
          <LoadFailureAlert message={loadState.message} description="This is a load failure, not a missing activity." />
        ) : loadState.status === 'loading' ? (
          <LoadingNotice message="Loading activity…" />
        ) : (
          <Alert severity="error">Activity not found.</Alert>
        )}
      </Stack>
    )
  }

  const references = data.references.filter((reference) => activity.referenceIds.includes(reference.referenceId))
  const ideas = ideasForActivity(data.ideas, activity)
  const photoReferences = data.photoReferences.filter((photoReference) =>
    activity.photoReferenceIds.includes(photoReference.photoReferenceId),
  )
  const selectedPhoto = photoReferences[photoIndex]
  const markPhotoBroken = (photoReferenceId: string) =>
    setBrokenPhotoIds((current) => (current.includes(photoReferenceId) ? current : [...current, photoReferenceId]))
  const movePhoto = (direction: -1 | 1) =>
    setPhotoIndex((index) => (index + direction + photoReferences.length) % photoReferences.length)
  const handleGalleryKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      movePhoto(-1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      movePhoto(1)
    }
  }
  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current
    const touch = event.changedTouches[0]
    touchStart.current = null
    if (!start || !touch) return

    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY)) return
    movePhoto(deltaX < 0 ? 1 : -1)
  }

  const hostname = (url: string) => {
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  }

  const detailSubtitle = [activitySubtitle(activity), waypoint?.title].filter(Boolean).join(' · ')
  const reloadLatest = async () => {
    const result = await reload()
    if (result.status === 'failure') {
      setMessage({
        severity: 'error',
        text: deletedActivity
          ? `Activity was deleted, but latest data could not be loaded. ${result.message}`
          : result.message,
        conflict: true,
      })
      return
    }
    if (result.status === 'superseded') {
      return
    }
    setMessage(null)
    setEditing(false)
    setShowDeleteDialog(false)
    if (deletedActivity) {
      setDeletedActivity(null)
      navigate(backTarget)
    }
  }

  return (
    <Stack spacing={3}>
      <DetailPageHeader breadcrumbs={breadcrumbs} title={activityTitle(activity)}>
        {!readOnly && !editing && !activityDeleted && (
          <>
            <Button variant="contained" onClick={() => setEditing(true)}>
              Edit activity
            </Button>
            <Button color="error" onClick={() => setShowDeleteDialog(true)}>
              Delete activity
            </Button>
          </>
        )}
      </DetailPageHeader>
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

      {detailSubtitle && <Typography color="text.secondary">{detailSubtitle}</Typography>}
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        {activity.category && <Chip label={statusLabels[activity.category]} />}
        {waypoint && (
          <Chip component={Link} clickable to={backTarget} label={`Waypoint: ${waypoint.title}`} variant="outlined" />
        )}
      </Stack>
      <Typography color="text.secondary">{locationSummary(activity.location)}</Typography>
      {activity.notes ? (
        <Typography sx={{ whiteSpace: 'pre-wrap' }}>{activity.notes}</Typography>
      ) : (
        <Typography color="text.secondary">No description recorded.</Typography>
      )}

      {photoReferences.length > 0 ? (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h5">Photos</Typography>
              {selectedPhoto && (
                <Box
                  role="region"
                  aria-label={`Photos for ${activityTitle(activity)}`}
                  tabIndex={0}
                  onKeyDown={handleGalleryKeyDown}
                  onTouchStart={(event) => {
                    const touch = event.touches[0]
                    touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null
                  }}
                  onTouchEnd={handleTouchEnd}
                  sx={{ display: 'flex', justifyContent: 'center', maxHeight: 420 }}
                >
                  {brokenPhotoIds.includes(selectedPhoto.photoReferenceId) ? (
                    <Alert severity="error" role="alert">
                      Image failed to load: {selectedPhoto.title}
                    </Alert>
                  ) : (
                    <Box
                      component="img"
                      src={selectedPhoto.url}
                      alt={selectedPhoto.altText ?? selectedPhoto.title}
                      onError={() => markPhotoBroken(selectedPhoto.photoReferenceId)}
                      sx={{
                        display: 'block',
                        maxWidth: '100%',
                        maxHeight: 420,
                        width: 'auto',
                        height: 'auto',
                        borderRadius: 1,
                        objectFit: 'contain',
                      }}
                    />
                  )}
                </Box>
              )}
              <Stack direction="row" spacing={1}>
                <Button onClick={() => movePhoto(-1)} aria-label="Previous photo">
                  Previous photo
                </Button>
                <Button onClick={() => movePhoto(1)} aria-label="Next photo">
                  Next photo
                </Button>
              </Stack>
              <Typography role="status" aria-live="polite" aria-atomic="true" color="text.secondary">
                {photoIndex + 1} of {photoReferences.length}: {selectedPhoto?.title}
              </Typography>
              <Stack
                direction="row"
                spacing={1}
                role="group"
                aria-label="Photo thumbnails"
                sx={{ overflowX: 'auto', pb: 0.5 }}
              >
                {photoReferences.map((photo, index) => {
                  const isBroken = brokenPhotoIds.includes(photo.photoReferenceId)
                  return (
                    <Button
                      key={photo.photoReferenceId}
                      aria-label={`Show photo ${index + 1}: ${photo.title}${isBroken ? ', failed to load' : ''}`}
                      aria-pressed={index === photoIndex}
                      variant={index === photoIndex ? 'contained' : 'outlined'}
                      onClick={() => setPhotoIndex(index)}
                      sx={{ flex: '0 0 auto', minWidth: 0, p: 1 }}
                    >
                      <Stack spacing={0.5} sx={{ alignItems: 'center' }}>
                        <Box
                          sx={{
                            width: 88,
                            height: 64,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                          }}
                        >
                          {isBroken ? (
                            <Typography variant="caption" color="error">
                              Failed
                            </Typography>
                          ) : (
                            <Box
                              component="img"
                              src={photo.url}
                              alt=""
                              onError={() => markPhotoBroken(photo.photoReferenceId)}
                              sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                            />
                          )}
                        </Box>
                        <Typography variant="caption" noWrap sx={{ maxWidth: 88 }}>
                          {photo.title}
                        </Typography>
                      </Stack>
                    </Button>
                  )
                })}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <EmptyState icon={<InboxOutlinedIcon color="disabled" />} message="No photos linked to this activity." />
      )}

      <Stack spacing={2}>
        <Typography variant="h5">Ideas</Typography>
        {ideas.length === 0 ? (
          <EmptyState icon={<InboxOutlinedIcon color="disabled" />} message="No ideas linked to this activity." />
        ) : (
          ideas.map((idea) => (
            <Button
              key={idea.ideaId}
              component={Link}
              to={`/ideas/${idea.ideaId}`}
              sx={{ justifyContent: 'flex-start' }}
            >
              {idea.title}
            </Button>
          ))
        )}
      </Stack>

      <Stack spacing={2}>
        <Typography variant="h5">References</Typography>
        {references.length === 0 ? (
          <EmptyState icon={<InboxOutlinedIcon color="disabled" />} message="No references linked to this activity." />
        ) : (
          references.map((reference) => (
            <Card key={reference.referenceId}>
              <CardContent>
                <Stack spacing={1}>
                  <Typography variant="h6">{reference.title}</Typography>
                  {reference.description && <Typography>{reference.description}</Typography>}
                  {reference.previewImageUrl && (
                    <Box
                      component="img"
                      src={reference.previewImageUrl}
                      alt={reference.title}
                      sx={{ width: '100%', borderRadius: 1, maxHeight: 220, objectFit: 'cover' }}
                    />
                  )}
                  <Typography color="text.secondary">{hostname(reference.url)}</Typography>
                  <Button component="a" href={reference.url} target="_blank" rel="noreferrer">
                    Open external link
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ))
        )}
      </Stack>

      {!readOnly && editing && !activityDeleted && (
        <ActivityEditor
          data={data}
          initialActivity={activity}
          initialReferences={references}
          initialPhotoReferences={photoReferences}
          submitLabel="Save changes"
          onSubmit={async (draft) => {
            try {
              await updateActivity(activity.activityId, draft)
              setEditing(false)
              setMessage({ severity: 'success', text: 'Activity updated.' })
            } catch (error) {
              setMessage({
                severity: 'error',
                text: error instanceof Error ? error.message : 'Failed to update activity.',
                conflict: error instanceof JourneyConflictError,
              })
            }
          }}
          onCancel={() => setEditing(false)}
          onDelete={() => setShowDeleteDialog(true)}
        />
      )}

      {!readOnly && !activityDeleted && (
        <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)}>
          <DialogTitle>Delete activity?</DialogTitle>
          <DialogContent>
            <Typography>
              Delete activity on {formatActivityDate(activity.date)}
              {waypoint ? ` linked to ${waypoint.title}` : ''}? Linked ideas and waypoints are preserved, and idea usage
              updates after reloading the dataset.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button
              color="error"
              onClick={async () => {
                try {
                  await deleteActivity(activity.activityId)
                  const result = await reload()
                  if (result.status === 'failure') {
                    setDeletedActivity(activity)
                    setShowDeleteDialog(false)
                    setMessage({
                      severity: 'error',
                      text: `Activity was deleted, but latest data could not be loaded. ${result.message}`,
                      conflict: true,
                    })
                    return
                  }
                  if (result.status === 'superseded') {
                    return
                  }
                  setShowDeleteDialog(false)
                  navigate(backTarget)
                } catch (error) {
                  setMessage({
                    severity: 'error',
                    text: error instanceof Error ? error.message : 'Failed to delete activity.',
                    conflict: error instanceof JourneyConflictError,
                  })
                }
              }}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Stack>
  )
}
