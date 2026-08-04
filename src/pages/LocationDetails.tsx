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
import { awardableStatuses, createVisit, statusLabels, type AwardedStatus } from '../domain/visit'
import { useJourney } from '../features/journey/JourneyContext'

export default function LocationDetails() {
  const { id = '' } = useParams()
  const location = locations.find((item) => item.locationId === id)
  const { addVisit, visitsFor, statusFor } = useJourney()
  const [status, setStatus] = useState<AwardedStatus>('bronze')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState('')
  const [message, setMessage] = useState<{ severity: 'success' | 'error'; text: string } | null>(null)

  if (!location) return <Alert severity="error">Location not found.</Alert>

  const visits = visitsFor(id)

  return (
    <Stack spacing={3}>
      <Button component={Link} to="/locations">
        ← All locations
      </Button>
      <Typography variant="h4">{location.name}</Typography>
      <Chip label={`Status: ${statusLabels[statusFor(id)]}`} />
      <Typography>{location.notes}</Typography>
      <Button component="a" href={location.url} target="_blank" rel="noreferrer">
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
                addVisit(
                  createVisit({
                    locationId: id,
                    date,
                    status,
                    notes,
                    photos: photos
                      .split('\n')
                      .map((item) => item.trim())
                      .filter(Boolean),
                  }),
                )
                setNotes('')
                setPhotos('')
                setMessage({ severity: 'success', text: 'Visit saved.' })
              } catch {
                setMessage({ severity: 'error', text: 'Please enter a valid visit date in YYYY-MM-DD format.' })
              }
            }}
          >
            <Typography variant="h5">Log your visit</Typography>
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
              label="Visit date"
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
              Save visit
            </Button>
          </Stack>
        </CardContent>
      </Card>
      <Stack spacing={2}>
        <Typography variant="h5">Visit history</Typography>
        {visits.length === 0 && <Typography color="text.secondary">No visits logged yet.</Typography>}
        {visits.map((visit) => (
          <Card key={visit.visitId}>
            <CardContent>
              <Stack spacing={1}>
                <Typography variant="h6">
                  {visit.date} · {statusLabels[visit.status]}
                </Typography>
                {visit.notes && <Typography>{visit.notes}</Typography>}
                {visit.photos.map((photo) => (
                  <Typography key={photo} color="text.secondary">
                    {photo}
                  </Typography>
                ))}
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Stack>
  )
}
