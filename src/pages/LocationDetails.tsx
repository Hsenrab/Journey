import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { locations } from '../data/locations'
import { awardableStatuses, createActivity, statusLabels, type AwardedStatus } from '../domain/visit'
import { useWaypoints } from '../features/journey/JourneyContext'

export default function LocationDetails() {
  const { id = '' } = useParams()
  const waypoint = locations.find((item) => item.locationId === id)
  const { addActivity, activitiesFor, statusFor } = useWaypoints()
  const [status, setStatus] = useState<AwardedStatus>('bronze')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState('')
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
      <Chip label={`Status: ${statusLabels[statusFor(id)]}`} />
      <Typography>{waypoint.notes}</Typography>
      <Typography color="text.secondary">
        {waypoint.area} · {waypoint.category} · {waypoint.travel.distanceMiles} miles · {waypoint.travel.driveTimeMinutes}{' '}
        min drive from Brockworth GL3
      </Typography>
      <Button component="a" href={waypoint.url} target="_blank" rel="noreferrer">
        National Trust visitor information
      </Button>
      <Card>
        <CardContent>
          <Stack
            component="form"
            spacing={2}
            onSubmit={(e) => {
              e.preventDefault()
              try {
                addActivity(
                  createActivity({
                    waypointId: id,
                    challengeId: 'national-trust',
                    date,
                    status,
                    location: {
                      placeName: waypoint.name,
                      addressOrRegion: waypoint.area,
                      source: 'National Trust waypoint catalogue',
                    },
                    notes,
                    photos: photos
                      .split('\n')
                      .map((item) => item.trim())
                      .filter(Boolean),
                  }),
                )
                setNotes('')
                setPhotos('')
                setMessage({ severity: 'success', text: 'Activity saved.' })
              } catch {
                setMessage({ severity: 'error', text: 'Please enter a valid activity date in YYYY-MM-DD format.' })
              }
            }}
          >
            <Typography variant="h5">Log your visit activity</Typography>
            {message && <Alert severity={message.severity}>{message.text}</Alert>}
            <FormControl>
              <InputLabel id="completion-level-label">Completion level</InputLabel>
              <Select
                labelId="completion-level-label"
                id="completion-level"
                label="Completion level"
                value={status}
                onChange={(e) => setStatus(e.target.value as AwardedStatus)}
              >
                {awardableStatuses.map((item) => (
                  <MenuItem key={item} value={item}>
                    {statusLabels[item]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Activity date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} multiline minRows={2} />
            <TextField
              label="Photo references (one URL or filename per line)"
              value={photos}
              onChange={(e) => setPhotos(e.target.value)}
              multiline
              minRows={2}
            />
            <Button type="submit" variant="contained">
              Save activity
            </Button>
          </Stack>
        </CardContent>
      </Card>
      <Stack spacing={2}>
        <Typography variant="h5">Activity history</Typography>
        {activities.length === 0 && <Typography color="text.secondary">No activities logged yet.</Typography>}
        {activities.map((activity) => (
          <Card key={activity.activityId}>
            <CardContent>
              <Stack spacing={1}>
                <Typography variant="h6">
                  {activity.date} · {statusLabels[activity.status]}
                </Typography>
                {activity.notes && <Typography>{activity.notes}</Typography>}
                {activity.photos.map((photo) => (
                  <Typography key={photo} color="text.secondary">
                    {photo}
                  </Typography>
                ))}
                <Typography color="text.secondary">{activity.location.placeName}</Typography>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Stack>
  )
}
