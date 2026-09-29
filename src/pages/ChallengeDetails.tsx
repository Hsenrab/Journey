import { useMemo, useState } from 'react'
import { Alert, Box, Button, Checkbox, FormControlLabel, Stack, TextField, Typography } from '@mui/material'
import { Link, useParams } from 'react-router-dom'
import { DetailPageHeader } from '../components/DetailPageHeader'
import { LoadingNotice } from '../components/LoadingNotice'
import { LoadFailureAlert } from '../components/LoadFailureAlert'
import { parseGpx, type GpxPoint, type GpxRoute } from '../domain/gpx'
import { challengeWaypoints } from '../domain/visit'
import { useWaypoints } from '../features/journey/JourneyContext'

function projectPoint(point: GpxPoint, bounds: GpxPoint[]): string {
  const minLat = Math.min(...bounds.map((point) => point.latitude))
  const maxLat = Math.max(...bounds.map((point) => point.latitude))
  const minLon = Math.min(...bounds.map((point) => point.longitude))
  const maxLon = Math.max(...bounds.map((point) => point.longitude))
  const latSpan = maxLat - minLat || 1
  const lonSpan = maxLon - minLon || 1
  return `${((point.longitude - minLon) / lonSpan) * 360 + 20},${100 - ((point.latitude - minLat) / latSpan) * 80}`
}

function routePoints(route: GpxRoute | undefined, bounds: GpxPoint[]): string {
  return route?.points.map((point) => projectPoint(point, bounds)).join(' ') ?? ''
}

function routeBounds(routes: Array<GpxRoute | undefined>): GpxPoint[] {
  return routes.flatMap((route) => route?.points ?? [])
}

export default function ChallengeDetails() {
  const { challengeId = '' } = useParams()
  const { data, loadState, readOnly, updateChallenge } = useWaypoints()
  const challenge = data.challenges.find((item) => item.challengeId === challengeId)
  const [showPlanned, setShowPlanned] = useState(true)
  const [showRecorded, setShowRecorded] = useState(true)
  const [routeInput, setRouteInput] = useState('')
  const [message, setMessage] = useState<string>()
  const [editing, setEditing] = useState(false)
  const members = useMemo(
    () => (challenge ? challengeWaypoints(challenge, data.waypoints) : []),
    [challenge, data.waypoints],
  )
  const tracks = members.flatMap((waypoint) =>
    data.activities
      .filter((activity) => activity.waypointId === waypoint.waypointId && activity.recordedTrack)
      .map((activity) => ({ activity, route: activity.recordedTrack! })),
  )
  const allPoints = useMemo(() => {
    const routePoints = routeBounds([challenge?.plannedRoute, ...tracks.map((track) => track.route)])
    const waypointPoints = members.flatMap((waypoint) =>
      typeof waypoint.location?.latitude === 'number' && typeof waypoint.location.longitude === 'number'
        ? [{ latitude: waypoint.location.latitude, longitude: waypoint.location.longitude }]
        : [],
    )
    return [...routePoints, ...waypointPoints]
  }, [challenge?.plannedRoute, members, tracks])

  if (loadState.status === 'loading') return <LoadingNotice message="Loading challenge…" />
  if (loadState.status === 'failed')
    return <LoadFailureAlert message={loadState.message} description="Challenge data could not be loaded." />
  if (!challenge) return <Alert severity="error">Challenge not found.</Alert>

  const saveRoute = async () => {
    try {
      await updateChallenge(challenge.challengeId, {
        plannedRoute: routeInput.trim() ? parseGpx(routeInput) : undefined,
      })
      setEditing(false)
      setRouteInput('')
      setMessage('Planned route saved.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <Stack spacing={3}>
      <DetailPageHeader breadcrumbs={[{ label: 'Challenges', to: '/challenges' }]} title={challenge.title} />
      <Typography>{challenge.description}</Typography>
      <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
        <FormControlLabel
          control={<Checkbox checked={showPlanned} onChange={(event) => setShowPlanned(event.target.checked)} />}
          label="Planned route"
        />
        <FormControlLabel
          control={<Checkbox checked={showRecorded} onChange={(event) => setShowRecorded(event.target.checked)} />}
          label="Recorded activity tracks"
        />
      </Stack>
      {allPoints.length > 0 ? (
        <Box
          component="svg"
          viewBox="0 0 400 120"
          role="img"
          aria-label={`${challenge.title} route overlay`}
          sx={{ width: '100%', border: 1, borderColor: 'divider', borderRadius: 1 }}
        >
          {showPlanned && challenge.plannedRoute && (
            <polyline
              points={routePoints(challenge.plannedRoute, allPoints)}
              fill="none"
              stroke="#1565c0"
              strokeWidth="3"
              aria-label="Planned route"
            />
          )}
          {showRecorded &&
            tracks.map(({ activity, route }) => (
              <polyline
                key={activity.activityId}
                points={routePoints(route, allPoints)}
                fill="none"
                stroke="#c62828"
                strokeWidth="2"
                strokeDasharray="6 4"
                aria-label={`Recorded track: ${activity.name ?? activity.date}`}
              />
            ))}
          {members.map((waypoint) =>
            typeof waypoint.location?.latitude === 'number' && typeof waypoint.location.longitude === 'number' ? (
              <circle
                key={waypoint.waypointId}
                cx={
                  projectPoint(
                    { latitude: waypoint.location.latitude, longitude: waypoint.location.longitude },
                    allPoints,
                  ).split(',')[0]
                }
                cy={
                  projectPoint(
                    { latitude: waypoint.location.latitude, longitude: waypoint.location.longitude },
                    allPoints,
                  ).split(',')[1]
                }
                r="4"
                fill="#2e7d32"
                aria-label={`Waypoint: ${waypoint.title}`}
              />
            ) : null,
          )}
        </Box>
      ) : (
        <Typography color="text.secondary">No GPX routes or recorded tracks are available.</Typography>
      )}
      <Stack spacing={1}>
        <Typography variant="h5">Waypoints</Typography>
        {members.map((waypoint) => (
          <Button
            key={waypoint.waypointId}
            component={Link}
            to={`/waypoints/${waypoint.waypointId}`}
            sx={{ justifyContent: 'flex-start' }}
          >
            {waypoint.title}
          </Button>
        ))}
      </Stack>
      {!readOnly && (
        <Stack spacing={1}>
          {!editing ? (
            <Button onClick={() => setEditing(true)}>
              {challenge.plannedRoute ? 'Replace planned route' : 'Add planned route'}
            </Button>
          ) : (
            <>
              <TextField
                label="Planned GPX route"
                value={routeInput}
                onChange={(event) => setRouteInput(event.target.value)}
                multiline
                minRows={5}
                helperText="Leave empty to remove the planned route."
              />
              <Stack direction="row" spacing={1}>
                <Button variant="contained" onClick={() => void saveRoute()}>
                  Save route
                </Button>
                <Button onClick={() => setEditing(false)}>Cancel</Button>
              </Stack>
            </>
          )}
          {message && <Typography color="text.secondary">{message}</Typography>}
        </Stack>
      )}
    </Stack>
  )
}
