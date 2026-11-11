import { useRef, useState } from 'react'
import { ZodError } from 'zod'
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
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Stack,
  Typography,
} from '@mui/material'
import { statusLabels, statusOrder, statusRules } from '../domain/visit'
import { dataModeStatus } from '../domain/dataMode'
import { LoadingNotice } from '../components/LoadingNotice'
import { PageHeader } from '../components/PageHeader'
import { useWaypoints } from '../features/journey/JourneyContext'
import { createBackup, parseImport, type JourneyDataMode } from '../services/storage'

const dataModeLabels: Record<JourneyDataMode, string> = {
  'demo-local': 'Demo local data',
  'demo-cosmos': 'Demo Cosmos data',
  production: 'Production data',
}

export default function Settings() {
  const {
    activeDataMode,
    clear,
    data,
    dataMode,
    loadError,
    loadState,
    readOnly,
    role,
    restore,
    setDataMode,
    mutationPending,
    runMutation,
  } = useWaypoints()
  const input = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const usingLocalFallback = dataMode === 'demo-cosmos' && activeDataMode === 'demo-local' && Boolean(loadError)
  const activeLabel = usingLocalFallback ? 'Demo local fallback data' : dataModeLabels[activeDataMode]
  const displayedLabel = usingLocalFallback ? 'Demo local samples' : dataModeLabels[activeDataMode]
  const accessStatus = dataModeStatus({
    activeDataMode,
    dataMode,
    loadError,
    loading: loadState.status === 'loading',
    readOnly,
    role,
  })
  const accessSummary =
    accessStatus === 'viewer'
      ? 'Viewer access is read-only. Choosing another dataset does not grant edit access.'
      : accessStatus === 'admin'
        ? 'Admin access allows editing this dataset.'
        : accessStatus === 'fallback' || accessStatus === 'demoLocal'
          ? 'Bundled sample data is read-only; no authenticated role applies.'
          : accessStatus === 'local'
            ? 'Local access; no authenticated role applies.'
            : 'Editing is unavailable.'
  const exportDisabled = loadState.status !== 'loaded'
  const changeMode = async (event: SelectChangeEvent) => {
    try {
      const result = await setDataMode(event.target.value as JourneyDataMode)
      if (result === 'cancelled') return
      setMessage(null)
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : String(error), error: true })
    }
  }

  const exportData = () => {
    if (exportDisabled) return
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
    await runMutation(async () => {
      try {
        const text = await file.text()
        let importedData
        try {
          importedData = parseImport(text)
        } catch (error) {
          if (!(error instanceof SyntaxError) && !(error instanceof ZodError)) throw error
          setMessage({
            text: `That file is not a valid Waypoints backup, so your existing data was left unchanged. ${error instanceof ZodError ? error.issues.map((issue) => issue.message).join(' ') : error.message}`,
            error: true,
          })
          return
        }
        await restore(importedData)
        setMessage({ text: `${activeLabel} was restored.`, error: false })
      } catch (error) {
        setMessage({ text: error instanceof Error ? error.message : String(error), error: true })
      }
    })
  }

  return (
    <Stack spacing={3}>
      <PageHeader title="Settings" />

      <Stack spacing={2}>
        <Typography variant="h5">Data mode</Typography>
        <Typography>
          Choose Demo local data, Demo Cosmos data, or Production data. Switching modes reloads that dataset and never
          overwrites data that belongs to another mode.
        </Typography>
        <FormControl size="small" sx={{ maxWidth: 320 }}>
          <InputLabel id="journey-data-mode-label">Data mode</InputLabel>
          <Select
            disabled={mutationPending}
            label="Data mode"
            labelId="journey-data-mode-label"
            onChange={changeMode}
            value={dataMode}
          >
            <MenuItem value="demo-local">{dataModeLabels['demo-local']}</MenuItem>
            <MenuItem value="demo-cosmos">{dataModeLabels['demo-cosmos']}</MenuItem>
            <MenuItem value="production">{dataModeLabels.production}</MenuItem>
          </Select>
        </FormControl>
        {loadError && <Alert severity={activeDataMode === 'demo-local' ? 'warning' : 'error'}>{loadError}</Alert>}
        <Card aria-live="polite">
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="subtitle1">Dataset status</Typography>
              <Typography>Selected dataset: {dataModeLabels[dataMode]}</Typography>
              {loadState.status === 'loading' ? (
                <>
                  <LoadingNotice message={`Loading ${dataModeLabels[dataMode]}…`} />
                  {activeDataMode !== dataMode && (
                    <Typography variant="body2">Currently displaying previously loaded {displayedLabel}.</Typography>
                  )}
                  <Typography variant="body2">Access will be confirmed when loading completes.</Typography>
                </>
              ) : loadState.status === 'failed' ? (
                <>
                  <Typography>
                    {dataModeLabels[dataMode]} was not loaded. No successfully loaded dataset is available.
                  </Typography>
                  <Typography variant="body2">Editing is unavailable until the selected dataset loads.</Typography>
                </>
              ) : (
                <>
                  <Typography>
                    {usingLocalFallback
                      ? `Demo Cosmos was requested; displaying read-only ${displayedLabel}.`
                      : `${displayedLabel} loaded successfully.`}
                  </Typography>
                  <Typography variant="body2">{accessSummary}</Typography>
                  <Typography variant="body2">
                    {data.waypoints.length} waypoints · {data.challenges.length} challenges · {data.ideas.length} ideas
                    · {data.activities.length} activities
                  </Typography>
                  {data.waypoints.length + data.challenges.length + data.ideas.length + data.activities.length ===
                    0 && (
                    <Typography variant="body2">This dataset loaded successfully and contains no records.</Typography>
                  )}
                </>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      <Stack spacing={2}>
        <Typography variant="h5">{activeLabel}</Typography>
        <Typography>
          Export, restore, and clear apply only to the active dataset. Demo local and fallback data are read-only; Demo
          Cosmos changes are temporary and reset on redeploy.
        </Typography>
        <Typography color="text.secondary">
          Restoring a backup to production is allowed only when production is empty. Clear production first if you need
          to replace it.
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button variant="contained" disabled={exportDisabled} onClick={exportData}>
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
        {loadState.status === 'failed' && (
          <Alert severity="error">
            Export is disabled because the active dataset did not load. Reload production before creating a backup.
          </Alert>
        )}
        {message && <Alert severity={message.error ? 'error' : 'success'}>{message.text}</Alert>}
      </Stack>

      <Dialog open={confirmingClear} onClose={() => setConfirmingClear(false)}>
        <DialogTitle>Clear all Journey data?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This permanently removes every waypoint, challenge, idea, activity, note, reference and photo reference from
            the active writable dataset. Export a backup first if you want to keep it.
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
              setMessage({ text: `${activeLabel} was cleared.`, error: false })
            }}
          >
            Clear everything
          </Button>
        </DialogActions>
      </Dialog>

      <Stack spacing={2}>
        <Typography variant="h5">Challenge rules</Typography>
        <Typography>
          Challenges organize waypoints around a shared goal. Activities link to waypoints and require location data
          before they can be saved.
        </Typography>
        <Typography>
          Most Challenges do not use awards. In an award-enabled Challenge, each linked Activity requires one
          deliberately selected Bronze, Silver or Gold level using that Challenge's explanations. One level applies
          across all enabled memberships. Waypoint summaries show the highest recorded award; Activity history shows
          each visit's own level. Awards never change once/count completion.
        </Typography>
        <Typography>
          Challenge statistics separate Waypoints by highest award from Activities by recorded award. Shared records
          count once per Challenge and once globally. Changes that invalidate recorded awards are blocked; explicitly
          review the identified Activities first. Award settings cannot convert unawarded history and never backfill
          levels.
        </Typography>
        {data.challenges.some((item) => item.supportsActivityCategories) &&
          statusOrder.map((status) => (
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
