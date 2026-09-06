import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material'
import { ActivityEditor } from '../components/ActivityEditor'
import { locations } from '../data/locations'
import { ideaUsageCount, ideasForWaypoint, locationSummary, planningStateLabels, statusLabels } from '../domain/visit'
import { useWaypoints } from '../features/journey/JourneyContext'
import { JourneyConflictError } from '../services/journeyApi'

const locationById = new Map(locations.map((location) => [location.locationId, location]))

export default function LocationDetails() {
  const { id = '' } = useParams()
  const { addActivity, activitiesFor, statusFor, data, reload } = useWaypoints()
  const [showEditor, setShowEditor] = useState(false)
  const [message, setMessage] = useState<{ severity: 'success' | 'error'; text: string; conflict?: boolean } | null>(
    null,
  )
  const waypoint = data.waypoints.find((item) => item.waypointId === id)
  const sourceLocation = waypoint ? locationById.get(waypoint.waypointId) : undefined

  if (!waypoint) {
    return (
      <Stack spacing={3}>
        <Button component={Link} to="/waypoints">
          ← All waypoints
        </Button>
        <Alert severity="error">Waypoint not found.</Alert>
      </Stack>
    )
  }

  const activities = activitiesFor(id)
  const waypointIdeas = ideasForWaypoint(data.ideas, id)
  const reloadLatest = async () => {
    try {
      await reload()
      setMessage(null)
      setShowEditor(false)
    } catch (error) {
      setMessage({ severity: 'error', text: error instanceof Error ? error.message : 'Failed to reload activities.' })
    }
  }

  return (
    <Stack spacing={3}>
      <Button component={Link} to="/waypoints">
        ← All waypoints
      </Button>
      <Typography variant="h4">{waypoint.title}</Typography>
      <Chip label={`Category summary: ${statusLabels[statusFor(id)]}`} />
      <Typography>{waypoint.description}</Typography>
      {sourceLocation && (
        <Typography color="text.secondary">
          {sourceLocation.area} · {sourceLocation.category} · {sourceLocation.travel.distanceMiles} miles ·{' '}
          {sourceLocation.travel.driveTimeMinutes} min drive from Brockworth GL3
        </Typography>
      )}

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

      {showEditor ? (
        <ActivityEditor
          data={data}
          initialWaypointId={id}
          submitLabel="Save activity"
          onSubmit={async (draft) => {
            try {
              await addActivity(draft)
              setShowEditor(false)
              setMessage({ severity: 'success', text: 'Activity saved.' })
            } catch (error) {
              setMessage({
                severity: 'error',
                text: error instanceof Error ? error.message : 'Failed to save activity.',
                conflict: error instanceof JourneyConflictError,
              })
            }
          }}
          onCancel={() => setShowEditor(false)}
        />
      ) : (
        <Button variant="contained" onClick={() => setShowEditor(true)}>
          Log activity
        </Button>
      )}

      <Stack spacing={2}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
        >
          <Typography variant="h5">Ideas</Typography>
          <Button component={Link} to={`/ideas?mode=add&waypoint=${encodeURIComponent(id)}`}>
            Add idea
          </Button>
        </Stack>
        {waypointIdeas.length === 0 ? (
          <Typography color="text.secondary">No ideas linked to this waypoint.</Typography>
        ) : (
          waypointIdeas.map((idea) => (
            <Card key={idea.ideaId}>
              <CardContent>
                <Stack spacing={1}>
                  <Typography variant="h6" component={Link} to={`/ideas/${idea.ideaId}`}>
                    {idea.title}
                  </Typography>
                  <Typography color="text.secondary">
                    {planningStateLabels[idea.planningState]} ·{' '}
                    {ideaUsageCount(data.activities, idea.ideaId) === 0
                      ? 'Not used'
                      : `Used in ${ideaUsageCount(data.activities, idea.ideaId)} activities`}
                  </Typography>
                  <Typography color="text.secondary">{idea.description || 'No description'}</Typography>
                </Stack>
              </CardContent>
            </Card>
          ))
        )}
      </Stack>

      <Stack spacing={2}>
        <Typography variant="h5">Activity history</Typography>
        {activities.length === 0 && <Typography color="text.secondary">No activities logged yet.</Typography>}
        {activities.map((activity) => (
          <Card key={activity.activityId}>
            <CardContent>
              <Stack spacing={1}>
                <Typography variant="h6" component={Link} to={`/activities/${activity.activityId}`}>
                  {activity.date}
                </Typography>
                {activity.notes && <Typography>{activity.notes}</Typography>}
                <Typography color="text.secondary">{locationSummary(activity.location)}</Typography>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Stack>
  )
}
