import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, Button, Card, CardContent, Stack, Typography } from '@mui/material'
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined'
import { ChallengeRouteMap } from '../components/ChallengeRouteMap'
import { DetailPageHeader } from '../components/DetailPageHeader'
import { EmptyState } from '../components/EmptyState'
import { LoadFailureAlert } from '../components/LoadFailureAlert'
import { LoadingNotice } from '../components/LoadingNotice'
import { ReadOnlyNotice } from '../components/ReadOnlyNotice'
import { parseGpxFile } from '../domain/gpx'
import { challengeWaypoints, type PlannedRoute } from '../domain/visit'
import { useWaypoints } from '../features/journey/JourneyContext'
import { JourneyConflictError } from '../services/journeyApi'

type Message = { severity: 'success' | 'error'; text: string; conflict?: boolean }

export default function ChallengeDetails() {
  const { challengeId = '' } = useParams()
  const { data, loadState, readOnly, reload, updateChallengeRoute } = useWaypoints()
  const challenge = data.challenges.find((item) => item.challengeId === challengeId)
  const [draftRoute, setDraftRoute] = useState<PlannedRoute | null | undefined>()
  const [message, setMessage] = useState<Message | null>(null)
  const [saving, setSaving] = useState(false)
  const waypoints = useMemo(
    () => (challenge ? challengeWaypoints(challenge, data.waypoints) : []),
    [challenge, data.waypoints],
  )
  const breadcrumbs = [{ label: 'Challenges', to: '/challenges' }]

  if (!challenge) {
    return (
      <Stack spacing={3}>
        <DetailPageHeader breadcrumbs={breadcrumbs} title="Challenge" />
        {loadState.status === 'failed' ? (
          <LoadFailureAlert
            message={loadState.message}
            description="This is a load failure, not a missing challenge."
          />
        ) : loadState.status === 'loading' ? (
          <LoadingNotice message="Loading challenge…" />
        ) : (
          <Alert severity="error">Challenge not found.</Alert>
        )}
      </Stack>
    )
  }

  const displayedRoute = draftRoute === undefined ? challenge.plannedRoute : (draftRoute ?? undefined)

  const selectFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const route = await parseGpxFile(file)
      setDraftRoute(route)
      setMessage(null)
    } catch (cause) {
      setMessage({ severity: 'error', text: cause instanceof Error ? cause.message : String(cause) })
    }
  }

  const saveRoute = async () => {
    if (saving) return
    setSaving(true)
    try {
      await updateChallengeRoute(challengeId, draftRoute ?? undefined)
      setDraftRoute(undefined)
      setMessage({
        severity: 'success',
        text: draftRoute ? 'Planned route saved.' : 'Planned route removed.',
      })
    } catch (cause) {
      setMessage({
        severity: 'error',
        text: cause instanceof Error ? cause.message : String(cause),
        conflict: cause instanceof JourneyConflictError,
      })
    } finally {
      setSaving(false)
    }
  }

  const reloadLatest = async () => {
    const result = await reload()
    if (result.status === 'failure') {
      setMessage({ severity: 'error', text: result.message, conflict: true })
      return
    }
    if (result.status === 'superseded') return
    setDraftRoute(undefined)
    setMessage(null)
  }

  return (
    <Stack spacing={3}>
      <DetailPageHeader breadcrumbs={breadcrumbs} title={challenge.title} />
      <ReadOnlyNotice />
      <Typography>{challenge.description}</Typography>
      {message && (
        <Alert
          severity={message.severity}
          action={
            message.conflict ? (
              <Button color="inherit" size="small" onClick={() => void reloadLatest()}>
                Reload latest
              </Button>
            ) : undefined
          }
        >
          {message.text}
        </Alert>
      )}

      <Stack spacing={2}>
        <Typography variant="h5">Planned route</Typography>
        {displayedRoute ? (
          <Typography color="text.secondary">
            {displayedRoute.fileName}
            {draftRoute !== undefined ? ' · Ready to save' : ''}
          </Typography>
        ) : (
          <EmptyState icon={<RouteOutlinedIcon color="disabled" />} message="No planned GPX route attached." />
        )}
        {!readOnly && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' } }}>
            <Button component="label" variant="outlined" disabled={saving}>
              {displayedRoute ? 'Replace GPX route' : 'Attach GPX route'}
              <input
                hidden
                type="file"
                accept=".gpx,application/gpx+xml,application/xml,text/xml"
                disabled={saving}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  void selectFile(file)
                }}
              />
            </Button>
            {displayedRoute && (
              <Button color="error" disabled={saving} onClick={() => setDraftRoute(null)}>
                Remove route
              </Button>
            )}
            {draftRoute !== undefined && (
              <>
                <Button variant="contained" disabled={saving} onClick={() => void saveRoute()}>
                  Save route
                </Button>
                <Button
                  disabled={saving}
                  onClick={() => {
                    setDraftRoute(undefined)
                    setMessage(null)
                  }}
                >
                  Cancel
                </Button>
              </>
            )}
          </Stack>
        )}
        {(displayedRoute || waypoints.some((waypoint) => waypoint.location?.latitude !== undefined)) && (
          <ChallengeRouteMap plannedRoute={displayedRoute} waypoints={waypoints} />
        )}
      </Stack>

      <Stack spacing={2}>
        <Typography variant="h5">Waypoints</Typography>
        {waypoints.length === 0 ? (
          <Typography color="text.secondary">No waypoints linked to this challenge.</Typography>
        ) : (
          waypoints.map((waypoint) => (
            <Card key={waypoint.waypointId}>
              <CardContent>
                <Stack spacing={1}>
                  <Typography variant="h6">{waypoint.title}</Typography>
                  <Typography color="text.secondary">{waypoint.description}</Typography>
                  <Button component={Link} to={`/waypoints/${waypoint.waypointId}`}>
                    View waypoint
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ))
        )}
      </Stack>
    </Stack>
  )
}
