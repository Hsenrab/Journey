import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { locations } from '../data/locations'
import type { Status } from '../domain/location'
import { useJourney } from '../features/journey/JourneyContext'

const labels: Record<Status, string> = {
  'not-started': 'Not Started',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
}
const order: Status[] = ['not-started', 'bronze', 'silver', 'gold']

export default function LocationDetails() {
  const { id = '' } = useParams()
  const location = locations.find((item) => item.locationId === id)
  const { data, saveVisit } = useJourney()
  const visit = data[id]
  const [status, setStatus] = useState<Status>(visit?.status ?? 'bronze')
  const [date, setDate] = useState(visit?.date ?? new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState(visit?.notes ?? '')
  const [photos, setPhotos] = useState(visit?.photos.join('\n') ?? '')
  const [saved, setSaved] = useState(false)

  if (!location) return <Alert severity="error">Location not found.</Alert>

  return (
    <Stack spacing={3}>
      <Button component={Link} to="/locations">
        ← All locations
      </Button>
      <Typography variant="h4">{location.name}</Typography>
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
              saveVisit(id, {
                status,
                date,
                notes,
                photos: photos
                  .split('\n')
                  .map((item) => item.trim())
                  .filter(Boolean),
              })
              setSaved(true)
            }}
          >
            <Typography variant="h5">Log your visit</Typography>
            {saved && <Alert severity="success">Visit saved.</Alert>}
            <FormControl>
              <InputLabel>Completion level</InputLabel>
              <Select label="Completion level" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
                {order.slice(1).map((item) => (
                  <MenuItem key={item} value={item}>
                    {labels[item]}
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
            <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} multiline minRows={3} />
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
    </Stack>
  )
}
