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
import { statusLabels, statusOrder, statusRules } from '../domain/visit'
import { useWaypoints } from '../features/journey/JourneyContext'
import { JourneyImportNotEmptyError } from '../services/journeyApi'
import { createBackup, isDemoModeEnabled, parseImport } from '../services/storage'

export default function Settings() {
  const { clear, data, restore } = useWaypoints()
  const input = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const demoModeEnabled = isDemoModeEnabled()

  const exportData = () => {
    const blob = new Blob([JSON.stringify(createBackup(data), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = demoModeEnabled ? 'waypoints-demo.json' : 'waypoints.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const importFile = async (file: File) => {
    if (file.type && file.type !== 'application/json') {
      setMessage({ text: 'Choose a JSON backup file exported from this app.', error: true })
      return
    }
    try {
      if (demoModeEnabled) throw new Error('Demo data is read-only.')
      await restore(parseImport(await file.text()))
      setMessage({ text: `${demoModeEnabled ? 'Demo' : 'Personal'} data was restored.`, error: false })
    } catch (error) {
      setMessage({
        text:
          error instanceof JourneyImportNotEmptyError
            ? error.message
            : 'That file is not a valid Waypoints backup, so your existing data was left unchanged.',
        error: true,
      })
    }
  }

  return (
    <Stack spacing={4}>
      <Typography variant="h4">Settings</Typography>

      <Stack spacing={2}>
        <Typography variant="h5">Demo mode</Typography>
        <Typography>
          Use the Demo data switch in the header to swap between your personal data and a separate sample dataset.
          Switching modes never overwrites the other dataset.
        </Typography>
        {demoModeEnabled && (
          <Card>
            <CardContent>
              <Stack spacing={1}>
                <Typography variant="subtitle1">Sample data loaded</Typography>
                <Typography variant="body2">
                  {data.waypoints.length} waypoints · {data.challenges.length} challenges · {data.ideas.length} ideas ·{' '}
                  {data.activities.length} activities
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        )}
      </Stack>

      <Stack spacing={2}>
        <Typography variant="h5">{demoModeEnabled ? 'Active demo data' : 'Your data'}</Typography>
        <Typography>
          Export applies to the active dataset. Restore and clear apply to your personal data; demo data is read-only.
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button variant="contained" onClick={exportData}>
            Export JSON
          </Button>
          <Button component="label" variant="outlined" disabled={demoModeEnabled}>
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
          <Button color="error" variant="outlined" disabled={demoModeEnabled} onClick={() => setConfirmingClear(true)}>
            Clear data
          </Button>
        </Stack>
        {message && <Alert severity={message.error ? 'error' : 'success'}>{message.text}</Alert>}
      </Stack>

      <Dialog open={confirmingClear} onClose={() => setConfirmingClear(false)}>
        <DialogTitle>Clear all activity data?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This permanently removes every activity, note and photo reference from this browser. Export a backup first
            if you want to keep it.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmingClear(false)}>Cancel</Button>
          <Button
            color="error"
            onClick={async () => {
              try {
                await clear()
              } catch (error) {
                setMessage({ text: error instanceof Error ? error.message : 'Failed to clear your data.', error: true })
                return
              }
              setConfirmingClear(false)
              setMessage({ text: 'Personal data was cleared.', error: false })
            }}
          >
            Clear everything
          </Button>
        </DialogActions>
      </Dialog>

      <Stack spacing={2}>
        <Typography variant="h5">Challenge rules</Typography>
        <Typography>
          National Trust is represented as a challenge made up of waypoints. Activities link to waypoints and require
          location data before they can be saved.
        </Typography>
        {statusOrder.map((status) => (
          <Card key={status}>
            <CardContent>
              <Typography variant="h6">{statusLabels[status]}</Typography>
              <Typography>{statusRules[status]}</Typography>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Stack>
  )
}
