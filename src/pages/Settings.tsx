import { useRef, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material'
import type { Status } from '../domain/location'
import { useJourney } from '../features/journey/JourneyContext'
import { createBackup, parseImport } from '../services/storage'

const labels: Record<Status, string> = {
  'not-started': 'Not Started',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
}
const order: Status[] = ['not-started', 'bronze', 'silver', 'gold']

const ruleDescriptions: Record<Status, string> = {
  'not-started': 'No visit recorded.',
  bronze: 'Physically visited.',
  silver: 'Main visitor experience completed — the main challenge completion level.',
  gold: 'Everything reasonably available to a normal visitor completed.',
}

export default function Settings() {
  const { data, restore } = useJourney()
  const input = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const [confirmingClear, setConfirmingClear] = useState(false)

  const exportData = () => {
    const blob = new Blob([JSON.stringify(createBackup(data), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'national-trust-tracker.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const importFile = async (file: File) => {
    if (file.type && file.type !== 'application/json') {
      setMessage({ text: 'Choose a JSON backup file exported from this app.', error: true })
      return
    }
    try {
      const visits = parseImport(await file.text())
      restore(visits)
      setMessage({ text: 'Your data was restored.', error: false })
    } catch {
      setMessage({
        text: 'That file is not a valid tracker backup, so your existing data was left unchanged.',
        error: true,
      })
    }
  }

  return (
    <Stack spacing={4}>
      <Typography variant="h4">Settings</Typography>

      <Stack spacing={2}>
        <Typography variant="h5">Your data</Typography>
        <Typography>
          Visits, notes and photo references stay in this browser. Export regularly to keep a portable backup.
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button variant="contained" onClick={exportData}>
            Export JSON
          </Button>
          <Button component="label" variant="outlined">
            Restore JSON
            <input
              ref={input}
              hidden
              type="file"
              accept="application/json"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void importFile(file)
              }}
            />
          </Button>
          <Button color="error" variant="outlined" onClick={() => setConfirmingClear(true)}>
            Clear data
          </Button>
        </Stack>
        {message && <Alert severity={message.error ? 'error' : 'success'}>{message.text}</Alert>}
      </Stack>

      <Dialog open={confirmingClear} onClose={() => setConfirmingClear(false)}>
        <DialogTitle>Clear all visit data?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This permanently removes every visit, note and photo reference from this browser. Export a backup first if
            you want to keep it.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmingClear(false)}>Cancel</Button>
          <Button
            color="error"
            onClick={() => {
              restore({})
              setConfirmingClear(false)
              setMessage({ text: 'Your data was cleared.', error: false })
            }}
          >
            Clear everything
          </Button>
        </DialogActions>
      </Dialog>

      <Stack spacing={2}>
        <Typography variant="h5">Challenge rules</Typography>
        <Typography>
          Locations are publicly accessible National Trust visitor destinations with their own visitor information page
          and an estimated one-way drive time of 150 minutes or less from Brockworth GL3. Cafés, shops, offices, holiday
          cottages, standalone car parks and non-qualifying tenant attractions are excluded.
        </Typography>
        {order.map((status) => (
          <Card key={status}>
            <CardContent>
              <Typography variant="h6">{labels[status]}</Typography>
              <Typography>{ruleDescriptions[status]}</Typography>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Stack>
  )
}
