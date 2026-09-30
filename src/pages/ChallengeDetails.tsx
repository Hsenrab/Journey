import { useMemo, useState } from 'react'
import { Alert, Box, Button, Checkbox, FormControlLabel, Stack, TextField, Typography } from '@mui/material'
import { Link, useParams } from 'react-router-dom'
import { DetailPageHeader } from '../components/DetailPageHeader'
import { LoadingNotice } from '../components/LoadingNotice'
import { LoadFailureAlert } from '../components/LoadFailureAlert'
import { parseGpx, type GpxPoint, type GpxRoute } from '../domain/gpx'
import { challengeWaypoints } from '../domain/visit'
import { useWaypoints } from '../features/journey/JourneyContext'

function createPointProjector(bounds: GpxPoint[]): (point: GpxPoint) => string {
  let minLat = Infinity
  let maxLat = -Infinity
  let minLon = Infinity
  let maxLon = -Infinity
  for (const point of bounds) {
    minLat = Math.min(minLat, point.latitude)
    maxLat = Math.max(maxLat, point.latitude)
    minLon = Math.min(minLon, point.longitude)
    maxLon = Math.max(maxLon, point.longitude)
  }
  const latSpan = maxLat - minLat || 1
  const lonSpan = maxLon - minLon || 1
  return (point) =>
    `${((point.longitude - minLon) / lonSpan) * 360 + 20},${100 - ((point.latitude - minLat) / latSpan) * 80}`
}

function routePoints(route: GpxRoute | undefined, projectPoint: (point: GpxPoint) => string): string {
  return route?.points.map(projectPoint).join(' ') ?? ''
}

function routeBounds(routes: Array<GpxRoute | undefined>): GpxPoint[] {
  return routes.flatMap((route) => route?.points ?? [])
}

function waypointPoint(location: { latitude?: number; longitude?: number } | undefined): GpxPoint | undefined {
  if (typeof location?.latitude !== 'number' || typeof location.longitude !== 'number') return undefined
  return { latitude: location.latitude, longitude: location.longitude }
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
  const tracks = useMemo(
    () =>
      members.flatMap((waypoint) =>
        data.activities
          .filter((activity) => activity.waypointId === waypoint.waypointId && activity.recordedTrack)
          .map((activity) => ({ activity, route: activity.recordedTrack! })),
      ),
    [data.activities, members],
  )
  const waypointMarkers = useMemo(
    () =>
      members.flatMap((waypoint) => {
        const point = waypointPoint(waypoint.location)
        return point ? [{ waypoint, point }] : []
      }),
    [members],
  )
  const allPoints = useMemo(() => {
    const visibleRoutes = [
      ...(showPlanned ? [challenge?.plannedRoute] : []),
      ...(showRecorded ? tracks.map((track) => track.route) : []),
    ]
    return [...routeBounds(visibleRoutes), ...waypointMarkers.map(({ point }) => point)]
  }, [challenge?.plannedRoute, showPlanned, showRecorded, tracks, waypointMarkers])
  const projectPoint = useMemo(() => (allPoints.length > 0 ? createPointProjector(allPoints) : undefined), [allPoints])

  if (loadState.status === 'loading') return <LoadingNotice message="Loading challenge…" />
  if (loadState.status === 'failed')
    return <LoadFailureAlert message={loadState.message} description="Challenge data could not be loaded." />
  if (!challenge) return <Alert severity="error">Challenge not found.</Alert>

  const visibleFeatures = [
    ...(showPlanned && challenge.plannedRoute
      ? [{ key: `planned:${challenge.challengeId}`, label: 'Planned route' }]
      : []),
    ...(showRecorded
      ? tracks.map(({ activity }) => ({
          key: `recorded:${activity.activityId}`,
          label: `Recorded track: ${activity.name ?? activity.date}`,
        }))
      : []),
    ...waypointMarkers.map(({ waypoint }) => ({
      key: `waypoint:${waypoint.waypointId}`,
      label: `Waypoint: ${waypoint.title}`,
    })),
  ]

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
      {projectPoint ? (
        <Box
          component="svg"
          viewBox="0 0 400 120"
          role="img"
          aria-label={`${challenge.title} route overlay`}
          sx={{ width: '100%', border: 1, borderColor: 'divider', borderRadius: 1 }}
        >
          {showPlanned && challenge.plannedRoute && (
            <polyline
              points={routePoints(challenge.plannedRoute, projectPoint)}
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
                points={routePoints(route, projectPoint)}
                fill="none"
                stroke="#c62828"
                strokeWidth="2"
                strokeDasharray="6 4"
                aria-label={`Recorded track: ${activity.name ?? activity.date}`}
              />
            ))}
          {waypointMarkers.map(({ waypoint, point }) => {
            const [cx, cy] = projectPoint(point).split(',')
            return (
              <circle
                key={waypoint.waypointId}
                cx={cx}
                cy={cy}
                r="4"
                fill="#2e7d32"
                aria-label={`Waypoint: ${waypoint.title}`}
              />
            )
          })}
        </Box>
      ) : (
        <Typography color="text.secondary">No visible routes, tracks, or waypoint locations.</Typography>
      )}
      {visibleFeatures.length > 0 && (
        <Stack component="section" aria-label="Visible map features" spacing={0.5}>
          <Typography variant="subtitle2">Visible map features</Typography>
          <Box component="ul" sx={{ m: 0, pl: 3 }}>
            {visibleFeatures.map((feature) => (
              <Typography component="li" key={feature.key} variant="body2">
                {feature.label}
              </Typography>
            ))}
          </Box>
        </Stack>
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
                <Button
                  onClick={() => {
                    setRouteInput('')
                    setEditing(false)
                  }}
                >
                  Cancel
                </Button>
              </Stack>
            </>
          )}
          {message && <Typography color="text.secondary">{message}</Typography>}
        </Stack>
      )}
    </Stack>
  )
}
