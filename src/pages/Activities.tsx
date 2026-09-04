import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material'
import { ActivityEditor } from '../components/ActivityEditor'
import { locationSummary, statusLabels } from '../domain/visit'
import { useWaypoints } from '../features/journey/JourneyContext'

export default function Activities() {
  const { data, addActivity } = useWaypoints()
  const waypointById = new Map(data.waypoints.map((waypoint) => [waypoint.waypointId, waypoint]))
  const [showEditor, setShowEditor] = useState(false)
  const [message, setMessage] = useState<{ severity: 'success' | 'error'; text: string } | null>(null)

  const activities = [...data.activities].sort(
    (a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt),
  )

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
      >
        <Typography variant="h4">Activities</Typography>
        {!showEditor && (
          <Button variant="contained" onClick={() => setShowEditor(true)}>
            Add activity
          </Button>
        )}
      </Stack>

      {message && <Alert severity={message.severity}>{message.text}</Alert>}

      {showEditor && (
        <ActivityEditor
          data={data}
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
      )}

      <Stack spacing={2}>
        <Typography variant="h5">Activity log</Typography>
        {activities.length === 0 ? (
          <Typography color="text.secondary">No activities logged yet.</Typography>
        ) : (
          activities.map((activity) => {
            const waypoint = activity.waypointId ? waypointById.get(activity.waypointId) : undefined
            return (
              <Card key={activity.activityId}>
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="h6" component={Link} to={`/activities/${activity.activityId}`}>
                      {activity.date}
                    </Typography>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                      {activity.category && <Chip label={statusLabels[activity.category]} />}
                      {waypoint && (
                        <Chip
                          component={Link}
                          clickable
                          label={`Waypoint: ${waypoint.title}`}
                          to={`/waypoints/${waypoint.waypointId}`}
                          variant="outlined"
                        />
                      )}
                    </Stack>
                    <Typography color="text.secondary">{locationSummary(activity.location)}</Typography>
                    {activity.notes && <Typography>{activity.notes.slice(0, 140)}</Typography>}
                    <Typography color="text.secondary">
                      {activity.photoReferenceIds.length} photo{activity.photoReferenceIds.length === 1 ? '' : 's'} ·{' '}
                      {activity.referenceIds.length} link{activity.referenceIds.length === 1 ? '' : 's'}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            )
          })
        )}
      </Stack>
    </Stack>
  )
}
