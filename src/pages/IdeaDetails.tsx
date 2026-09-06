import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material'
import { IdeaEditor } from '../components/IdeaEditor'
import {
  activitiesUsingIdea,
  difficultyDescriptions,
  difficultyLabels,
  ideaUsageCount,
  planningStateLabels,
} from '../domain/visit'
import { useWaypoints } from '../features/journey/JourneyContext'

function locationSummary(
  location: { placeName?: string; addressOrRegion?: string; latitude?: number; longitude?: number } | undefined,
): string {
  if (!location) return 'No location'
  const parts = [location.placeName, location.addressOrRegion].filter(Boolean)
  if (parts.length > 0) return parts.join(' · ')
  if (location.latitude !== undefined && location.longitude !== undefined) {
    return `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
  }
  return 'No location'
}

export default function IdeaDetails() {
  const navigate = useNavigate()
  const { ideaId = '' } = useParams()
  const { data, updateIdea, deleteIdea, reload } = useWaypoints()
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const idea = data.ideas.find((item) => item.ideaId === ideaId)
  if (!idea) {
    return (
      <Stack spacing={3}>
        <Button component={Link} to="/ideas">
          ← Ideas
        </Button>
        <Alert severity="error">Idea not found.</Alert>
      </Stack>
    )
  }

  const linkedWaypoints = idea.waypointIds
    .map((id) => data.waypoints.find((waypoint) => waypoint.waypointId === id))
    .filter((waypoint): waypoint is NonNullable<typeof waypoint> => Boolean(waypoint))
  const references = idea.referenceIds
    .map((id) => data.references.find((reference) => reference.referenceId === id))
    .filter((reference): reference is NonNullable<typeof reference> => Boolean(reference))
  const activities = activitiesUsingIdea(data.activities, idea.ideaId)
  const usage = ideaUsageCount(data.activities, idea.ideaId)

  return (
    <Stack spacing={3}>
      <Button component={Link} to="/ideas">
        ← Ideas
      </Button>
      <Typography variant="h4">{idea.title}</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <Typography color="text.secondary">{idea.description || 'No description'}</Typography>
      <Typography sx={{ whiteSpace: 'pre-wrap' }}>{idea.notes || 'No notes'}</Typography>
      <Typography>Planning state: {planningStateLabels[idea.planningState]}</Typography>
      {idea.planningState === 'rejected' && idea.rejectionReason && (
        <Typography>Rejection reason: {idea.rejectionReason}</Typography>
      )}
      <Typography>Difficulty: {difficultyLabels[idea.difficulty]}</Typography>
      <Typography color="text.secondary">{difficultyDescriptions[idea.difficulty]}</Typography>
      <Typography>Location: {locationSummary(idea.location)}</Typography>
      <Typography>
        Linked waypoints:{' '}
        {linkedWaypoints.length > 0 ? linkedWaypoints.map((waypoint) => waypoint.title).join(', ') : 'None'}
      </Typography>
      <Stack spacing={1}>
        <Typography variant="h5">References</Typography>
        {references.length === 0 ? (
          <Typography color="text.secondary">No references linked to this idea.</Typography>
        ) : (
          references.map((reference) => (
            <Card key={reference.referenceId}>
              <CardContent>
                <Stack spacing={1}>
                  <Typography variant="h6">{reference.title}</Typography>
                  {reference.description && <Typography>{reference.description}</Typography>}
                  <Button component="a" href={reference.url} target="_blank" rel="noreferrer">
                    Open external link
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ))
        )}
      </Stack>
      <Stack spacing={1}>
        <Typography variant="h5">Activity usage</Typography>
        {usage === 0 ? (
          <Typography color="text.secondary">Not used</Typography>
        ) : (
          <>
            <Typography color="text.secondary">
              Used in {usage} activit{usage === 1 ? 'y' : 'ies'}
            </Typography>
            {activities.map((activity) => {
              const waypoint = activity.waypointId
                ? data.waypoints.find((item) => item.waypointId === activity.waypointId)
                : undefined
              return (
                <Card key={activity.activityId}>
                  <CardContent>
                    <Stack spacing={1}>
                      <Typography>{activity.date}</Typography>
                      <Typography color="text.secondary">
                        {waypoint ? `Waypoint: ${waypoint.title}` : 'No linked waypoint'}
                      </Typography>
                      <Button component={Link} to={`/activities/${activity.activityId}`}>
                        View activity
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              )
            })}
          </>
        )}
      </Stack>
      {editing ? (
        <IdeaEditor
          data={data}
          initialIdea={idea}
          initialReferences={references}
          submitLabel="Save changes"
          onSubmit={async (draft) => {
            try {
              await updateIdea(idea.ideaId, draft)
              setEditing(false)
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Failed to update idea.')
            }
          }}
          onCancel={() => setEditing(false)}
          onDelete={() => setShowDeleteDialog(true)}
          errorMessage={error}
        />
      ) : (
        <Stack direction="row" spacing={1}>
          <Button variant="contained" onClick={() => setEditing(true)}>
            Edit idea
          </Button>
          <Button color="error" onClick={() => setShowDeleteDialog(true)}>
            Delete idea
          </Button>
        </Stack>
      )}
      <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)}>
        <DialogTitle>Delete idea?</DialogTitle>
        <DialogContent>
          <Typography>
            Deleting this idea removes its links from activities but keeps the activities and any linked waypoints. The
            dataset will reload after deletion.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
          <Button
            color="error"
            onClick={async () => {
              try {
                await deleteIdea(idea.ideaId)
                await reload()
                navigate('/ideas')
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : 'Failed to delete idea.')
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
