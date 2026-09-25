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
import { PageHeader } from '../components/PageHeader'
import { useWaypoints } from '../features/journey/JourneyContext'
import { createBackup, parseImport, type JourneyDataMode } from '../services/storage'

const dataModeLabels: Record<JourneyDataMode, string> = {
  'demo-local': 'Demo local',
  'demo-cosmos': 'Demo Cosmos',
  production: 'Production',
}

export default function Settings() {
  const { activeDataMode, clear, data, dataMode, loadError, readOnly, restore } = useWaypoints()
  const input = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const usingLocalFallback = dataMode === 'demo-cosmos' && activeDataMode === 'demo-local' && Boolean(loadError)
  const activeLabel = usingLocalFallback ? 'Demo local fallback' : dataModeLabels[activeDataMode]

  const exportData = () => {
    const exportMode = usingLocalFallback ? 'demo-local' : activeDataMode
    const blob = new Blob([JSON.stringify(createBackup(data), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = exportMode === 'production' ? 'waypoints.json' : `waypoints-${exportMode}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const importFile = async (file: File) => {
    if (file.type && file.type !== 'application/json') {
      setMessage({ text: 'Choose a JSON backup file exported from this app.', error: true })
      return
    }
    if (readOnly) {
      setMessage({
        text:
          loadError && dataMode === 'production'
            ? 'Production data is not loaded. Reload before restoring a backup.'
            : 'Demo local data is read-only.',
        error: true,
      })
      return
    }
    let importedData
    try {
      importedData = parseImport(await file.text())
    } catch {
      setMessage({
        text: 'That file is not a valid Waypoints backup, so your existing data was left unchanged.',
        error: true,
      })
      return
    }
    try {
      await restore(importedData)
      setMessage({ text: `${activeLabel} data was restored.`, error: false })
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Failed to restore the active data.',
        error: true,
      })
    }
  }

  return (
    <Stack spacing={3}>
      <PageHeader title="Settings" />

      <Stack spacing={2}>
        <Typography variant="h5">Demo mode</Typography>
        <Typography>
          Use the Data mode selector in the header to choose Demo local, Demo Cosmos, or Production data. Switching
          modes reloads that dataset and never overwrites data that belongs to another mode.
        </Typography>
        {loadError && <Alert severity={activeDataMode === 'demo-local' ? 'warning' : 'error'}>{loadError}</Alert>}
        {dataMode !== 'production' && (
          <Card>
            <CardContent>
              <Stack spacing={1}>
                <Typography variant="subtitle1">{activeLabel} loaded</Typography>
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
        <Typography variant="h5">{activeLabel} data</Typography>
        <Typography>
          Export, restore, and clear apply only to the active dataset. Demo local and fallback data are read-only; Demo
          Cosmos changes are temporary and reset on redeploy.
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button variant="contained" onClick={exportData}>
            Export JSON
          </Button>
          <Button component="label" disabled={readOnly}>
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
          <Button color="error" disabled={readOnly} onClick={() => setConfirmingClear(true)}>
            Clear data
          </Button>
        </Stack>
        {message && <Alert severity={message.error ? 'error' : 'success'}>{message.text}</Alert>}
      </Stack>

      <Dialog open={confirmingClear} onClose={() => setConfirmingClear(false)}>
        <DialogTitle>Clear all activity data?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This permanently removes every activity, note and photo reference from the active writable dataset. Export a
            backup first if you want to keep it.
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
              setMessage({ text: `${activeLabel} data was cleared.`, error: false })
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
