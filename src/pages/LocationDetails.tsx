import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material'
import { ActivityEditor } from '../components/ActivityEditor'
import { locations } from '../data/locations'
import { locationSummary, statusLabels } from '../domain/visit'
import { useWaypoints } from '../features/journey/JourneyContext'

export default function LocationDetails() {
  const { id = '' } = useParams()
  const waypoint = locations.find((item) => item.locationId === id)
  const { addActivity, activitiesFor, statusFor, data } = useWaypoints()
  const [showEditor, setShowEditor] = useState(false)
  const [message, setMessage] = useState<{ severity: 'success' | 'error'; text: string } | null>(null)

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

  return (
    <Stack spacing={3}>
      <Button component={Link} to="/waypoints">
        ← All waypoints
      </Button>
      <Typography variant="h4">{waypoint.name}</Typography>
      <Chip label={`Category summary: ${statusLabels[statusFor(id)]}`} />
      <Typography>{waypoint.notes}</Typography>
      <Typography color="text.secondary">
        {waypoint.area} · {waypoint.category} · {waypoint.travel.distanceMiles} miles ·{' '}
        {waypoint.travel.driveTimeMinutes} min drive from Brockworth GL3
      </Typography>
      <Button component="a" href={waypoint.url} target="_blank" rel="noreferrer">
        National Trust visitor information
      </Button>

      {message && <Alert severity={message.severity}>{message.text}</Alert>}

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
              })
            }
          }}
          onCancel={() => setShowEditor(false)}
        />
      ) : (
        <Button variant="contained" onClick={() => setShowEditor(true)}>
          Add activity
        </Button>
      )}

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
