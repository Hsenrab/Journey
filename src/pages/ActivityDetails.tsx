import { useState } from 'react'
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
import { ActivityEditor } from '../components/ActivityEditor'
import { locationSummary, statusLabels } from '../domain/visit'
import { useWaypoints } from '../features/journey/JourneyContext'
import { JourneyConflictError } from '../services/journeyApi'

export default function ActivityDetails() {
  const { activityId = '' } = useParams()
  const navigate = useNavigate()
  const { data, reload, updateActivity, deleteActivity } = useWaypoints()
  const [editing, setEditing] = useState(false)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [brokenPhotoIds, setBrokenPhotoIds] = useState<string[]>([])
  const [message, setMessage] = useState<{ severity: 'success' | 'error'; text: string; conflict?: boolean } | null>(
    null,
  )

  const activity = data.activities.find((item) => item.activityId === activityId)
  const waypoint = activity?.waypointId
    ? data.waypoints.find((item) => item.waypointId === activity.waypointId)
    : undefined
  const backTarget = waypoint ? `/waypoints/${waypoint.waypointId}` : '/activities'

  if (!activity) {
    return (
      <Stack spacing={3}>
        <Button component={Link} to={backTarget}>
          ← Activity log
        </Button>
        <Alert severity="error">Activity not found.</Alert>
      </Stack>
    )
  }

  const references = data.references.filter((reference) => activity.referenceIds.includes(reference.referenceId))
  const photoReferences = data.photoReferences.filter((photoReference) =>
    activity.photoReferenceIds.includes(photoReference.photoReferenceId),
  )
  const selectedPhoto = photoReferences[photoIndex]

  const hostname = (url: string) => {
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  }

  const detailHeading = [activity.date, waypoint?.title].filter(Boolean).join(' · ')
  const reloadLatest = async () => {
    try {
      await reload()
      setMessage(null)
      setEditing(false)
      setShowDeleteDialog(false)
    } catch (error) {
      setMessage({
        severity: 'error',
        text: error instanceof Error ? error.message : 'Failed to reload activity.',
        conflict: error instanceof JourneyConflictError,
      })
    }
  }

  return (
    <Stack spacing={3}>
      <Button component={Link} to={backTarget}>
        ← Activity log
      </Button>

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

      <Typography variant="h4">{detailHeading}</Typography>
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
                <Box>
                  <Box
                    component="img"
                    src={selectedPhoto.url}
                    alt={selectedPhoto.altText ?? selectedPhoto.title}
                    onError={() =>
                      setBrokenPhotoIds((current) =>
                        current.includes(selectedPhoto.photoReferenceId)
                          ? current
                          : [...current, selectedPhoto.photoReferenceId],
                      )
                    }
                    sx={{ width: '100%', borderRadius: 1, maxHeight: 420, objectFit: 'cover' }}
                  />
                  {brokenPhotoIds.includes(selectedPhoto.photoReferenceId) && (
                    <Typography color="error">Image failed to load: {selectedPhoto.title}</Typography>
                  )}
                </Box>
              )}
              <Stack direction="row" spacing={1}>
                <Button
                  onClick={() => setPhotoIndex((index) => (index === 0 ? photoReferences.length - 1 : index - 1))}
                  aria-label="Previous photo"
                >
                  Previous photo
                </Button>
                <Button
                  onClick={() => setPhotoIndex((index) => (index + 1) % photoReferences.length)}
                  aria-label="Next photo"
                >
                  Next photo
                </Button>
              </Stack>
              <Typography color="text.secondary">
                {photoIndex + 1} of {photoReferences.length}: {selectedPhoto?.title}
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <Typography color="text.secondary">No photos linked to this activity.</Typography>
      )}

      <Stack spacing={2}>
        <Typography variant="h5">References</Typography>
        {references.length === 0 ? (
          <Typography color="text.secondary">No references linked to this activity.</Typography>
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

      {editing ? (
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
      ) : (
        <Stack direction="row" spacing={1}>
          <Button variant="contained" onClick={() => setEditing(true)}>
            Edit activity
          </Button>
          <Button color="error" onClick={() => setShowDeleteDialog(true)}>
            Delete activity
          </Button>
        </Stack>
      )}

      <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)}>
        <DialogTitle>Delete activity?</DialogTitle>
        <DialogContent>
          <Typography>
            Delete activity on {activity.date}
            {waypoint ? ` linked to ${waypoint.title}` : ''}?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
          <Button
            color="error"
            onClick={async () => {
              try {
                await deleteActivity(activity.activityId)
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
    </Stack>
  )
}
