import { useState } from 'react'
import { Alert, Button, Card, CardContent, Chip, Stack, TextField, Typography } from '@mui/material'
import { createActivity, statusLabels } from '../domain/visit'
import { useWaypoints } from '../features/journey/JourneyContext'

export default function Activities() {
  const { data, addActivity } = useWaypoints()
  const waypointById = new Map(data.waypoints.map((waypoint) => [waypoint.waypointId, waypoint]))
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [placeName, setPlaceName] = useState('')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState<{ severity: 'success' | 'error'; text: string } | null>(null)

  const activities = [...data.activities].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Activities</Typography>
      <Card>
        <CardContent>
          <Stack
            component="form"
            spacing={2}
            onSubmit={(event) => {
              event.preventDefault()
              try {
                addActivity(
                  createActivity({
                    date,
                    status: 'bronze',
                    location: { placeName },
                    notes,
                  }),
                )
                setPlaceName('')
                setNotes('')
                setMessage({ severity: 'success', text: 'Activity saved.' })
              } catch {
                setMessage({ severity: 'error', text: 'Enter a valid date and location before saving.' })
              }
            }}
          >
            {message && <Alert severity={message.severity}>{message.text}</Alert>}
            <TextField
              label="Activity date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Location"
              value={placeName}
              onChange={(e) => setPlaceName(e.target.value)}
              helperText="Activities require a location record."
            />
            <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} multiline minRows={2} />
            <Button type="submit" variant="contained">
              Save activity
            </Button>
          </Stack>
        </CardContent>
      </Card>
      <Stack spacing={2}>
        <Typography variant="h5">Activity log</Typography>
        {activities.length === 0 ? (
          <Typography color="text.secondary">No activities logged yet.</Typography>
        ) : (
          activities.map((activity) => (
            <Card key={activity.activityId}>
              <CardContent>
                <Stack spacing={1}>
                  <Typography variant="h6">{activity.date}</Typography>
                  <Stack direction="row" spacing={1}>
                    <Chip label={statusLabels[activity.status]} />
                    {activity.waypointId && (
                      <Chip
                        label={`Waypoint: ${waypointById.get(activity.waypointId)?.title ?? activity.waypointId}`}
                        variant="outlined"
                      />
                    )}
                  </Stack>
                  <Typography color="text.secondary">{activity.location.placeName}</Typography>
                  {activity.notes && <Typography>{activity.notes}</Typography>}
                </Stack>
              </CardContent>
            </Card>
          ))
        )}
      </Stack>
    </Stack>
  )
}
