import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Box, Checkbox, FormControlLabel, Stack, Typography } from '@mui/material'
import CircleIcon from '@mui/icons-material/Circle'
import * as atlas from 'azure-maps-control'
import 'azure-maps-control/dist/atlas.min.css'
import type { PlannedRoute, Waypoint } from '../domain/visit'
import {
  GPX_LINE_OPACITY,
  GPX_LINE_OUTLINE_COLOR,
  GPX_LINE_OUTLINE_WIDTH,
  GPX_ROUTE_COLOR,
  GPX_ROUTE_STROKE_WIDTH,
  GPX_TRACK_COLOR,
  GPX_TRACK_DASH_ARRAY,
  GPX_TRACK_STROKE_WIDTH,
  gpxLineFeatures,
  type GpxMapLine,
} from '../domain/gpxMap'
import { LoadingNotice } from './LoadingNotice'

type MapsToken = { token: string; clientId: string }
const noTracks: readonly GpxMapLine[] = []

async function getMapsToken(): Promise<MapsToken> {
  const response = await fetch('/api/maps/token')
  if (response.status === 404) {
    throw new Error(
      'Map access is unavailable in this environment because the Maps API is not deployed. Pull request previews do not include the API; use the production site.',
    )
  }
  if (!response.ok) throw new Error(`Map access failed: ${await response.text()}`)
  const contentType = response.headers.get('content-type')
  if (!contentType?.includes('application/json')) {
    throw new Error(`Map access returned ${contentType ?? 'no content type'} instead of JSON.`)
  }
  return (await response.json()) as MapsToken
}

export function ChallengeRouteMap({
  plannedRoute,
  waypoints,
  recordedTracks = noTracks,
}: {
  plannedRoute?: PlannedRoute
  waypoints: readonly Waypoint[]
  recordedTracks?: readonly GpxMapLine[]
}) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<atlas.Map | null>(null)
  const [token, setToken] = useState<MapsToken | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [showTracks, setShowTracks] = useState(true)
  const trackFeatures = useMemo(() => gpxLineFeatures(recordedTracks), [recordedTracks])
  const locatedWaypoints = useMemo(
    () =>
      waypoints.filter(
        (waypoint) => waypoint.location?.latitude !== undefined && waypoint.location.longitude !== undefined,
      ),
    [waypoints],
  )

  useEffect(() => {
    void getMapsToken()
      .then(setToken)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
  }, [])

  useEffect(() => {
    if (!token || !container.current || map.current) return
    let initialToken: string | undefined = token.token
    const instance = new atlas.Map(container.current, {
      center: [-2.16, 51.85],
      zoom: 9,
      authOptions: {
        authType: atlas.AuthenticationType.anonymous,
        clientId: token.clientId,
        getToken: (resolve, reject) => {
          if (initialToken) {
            resolve(initialToken)
            initialToken = undefined
            return
          }
          void getMapsToken().then((refreshed) => resolve(refreshed.token), reject)
        },
      },
    })
    map.current = instance
    instance.events.add('ready', () => {
      const routeSource = new atlas.source.DataSource('challenge-route')
      const trackSource = new atlas.source.DataSource('challenge-tracks')
      const waypointSource = new atlas.source.DataSource('challenge-waypoints')
      instance.sources.add([routeSource, trackSource, waypointSource])
      instance.layers.add([
        new atlas.layer.LineLayer(routeSource, 'challenge-route-outline', {
          strokeColor: GPX_LINE_OUTLINE_COLOR,
          strokeWidth: GPX_ROUTE_STROKE_WIDTH + GPX_LINE_OUTLINE_WIDTH,
          strokeOpacity: 0.95,
        }),
        new atlas.layer.LineLayer(routeSource, 'challenge-route-line', {
          strokeColor: GPX_ROUTE_COLOR,
          strokeWidth: GPX_ROUTE_STROKE_WIDTH,
          strokeOpacity: GPX_LINE_OPACITY,
        }),
        new atlas.layer.LineLayer(trackSource, 'challenge-track-outline', {
          strokeColor: GPX_LINE_OUTLINE_COLOR,
          strokeWidth: GPX_TRACK_STROKE_WIDTH + GPX_LINE_OUTLINE_WIDTH,
          strokeDashArray: [...GPX_TRACK_DASH_ARRAY],
          strokeOpacity: 0.95,
        }),
        new atlas.layer.LineLayer(trackSource, 'challenge-track-lines', {
          strokeColor: GPX_TRACK_COLOR,
          strokeWidth: GPX_TRACK_STROKE_WIDTH,
          strokeDashArray: [...GPX_TRACK_DASH_ARRAY],
          strokeOpacity: GPX_LINE_OPACITY,
        }),
        new atlas.layer.BubbleLayer(waypointSource, 'challenge-waypoint-symbols', {
          color: '#007c83',
          radius: 7,
          strokeColor: '#fff',
          strokeWidth: 2,
        }),
        new atlas.layer.SymbolLayer(waypointSource, 'challenge-waypoint-labels', {
          textOptions: {
            textField: ['get', 'title'],
            offset: [0, 1.2],
            color: '#263238',
            haloColor: '#fff',
            haloWidth: 2,
          },
        }),
      ])
      setMapReady(true)
    })
    return () => {
      instance.dispose()
      map.current = null
      setMapReady(false)
    }
  }, [token])

  useEffect(() => {
    if (!mapReady || !map.current) return
    const instance = map.current
    const routeSource = instance.sources.getById('challenge-route') as atlas.source.DataSource
    const trackSource = instance.sources.getById('challenge-tracks') as atlas.source.DataSource
    const waypointSource = instance.sources.getById('challenge-waypoints') as atlas.source.DataSource
    routeSource.clear()
    routeSource.add(
      plannedRoute?.geometry.coordinates.map(
        (coordinates) => new atlas.data.Feature(new atlas.data.LineString(coordinates), { label: 'Planned route' }),
      ) ?? [],
    )
    trackSource.clear()
    trackSource.add(
      showTracks
        ? trackFeatures.map(
            (feature) =>
              new atlas.data.Feature(
                new atlas.data.LineString(feature.coordinates),
                {
                  activityId: feature.lineId,
                  label: feature.label,
                },
                feature.id,
              ),
          )
        : [],
    )
    waypointSource.clear()
    waypointSource.add(
      locatedWaypoints.map(
        (waypoint) =>
          new atlas.data.Feature(new atlas.data.Point([waypoint.location!.longitude!, waypoint.location!.latitude!]), {
            title: waypoint.title,
          }),
      ),
    )
    const positions = [
      ...(plannedRoute?.geometry.coordinates.flat() ?? []),
      ...trackFeatures.flatMap((feature) => feature.coordinates),
      ...locatedWaypoints.map((waypoint) => [waypoint.location!.longitude!, waypoint.location!.latitude!]),
    ]
    if (positions.length > 1) {
      instance.setCamera({ bounds: atlas.data.BoundingBox.fromPositions(positions), padding: 40 })
    } else if (positions.length === 1) {
      instance.setCamera({ center: positions[0], zoom: 9 })
    }
  }, [locatedWaypoints, mapReady, plannedRoute, showTracks, trackFeatures])

  if (error) return <Alert severity="error">{error}</Alert>
  if (!token) return <LoadingNotice message="Loading challenge map…" />

  return (
    <Stack spacing={1}>
      {recordedTracks.length > 0 ? (
        <FormControlLabel
          control={<Checkbox checked={showTracks} onChange={(_, checked) => setShowTracks(checked)} />}
          label={`Show recorded Activity tracks (${recordedTracks.length})`}
        />
      ) : (
        <Typography color="text.secondary">No recorded GPX tracks linked to this challenge's Waypoints.</Typography>
      )}
      <Box
        ref={container}
        aria-label="Challenge route map"
        sx={{ height: { xs: 360, sm: 480 }, width: 1, borderRadius: 1, overflow: 'hidden' }}
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} aria-label="Challenge map legend">
        <Typography variant="body2" color="text.secondary">
          <Box
            component="span"
            sx={{
              display: 'inline-block',
              width: 24,
              height: GPX_ROUTE_STROKE_WIDTH + GPX_LINE_OUTLINE_WIDTH,
              position: 'relative',
              bgcolor: GPX_LINE_OUTLINE_COLOR,
              mr: 1,
              '&::after': {
                content: '""',
                position: 'absolute',
                insetInline: 0,
                top: GPX_LINE_OUTLINE_WIDTH / 2,
                borderTop: `${GPX_ROUTE_STROKE_WIDTH}px solid ${GPX_ROUTE_COLOR}`,
                opacity: GPX_LINE_OPACITY,
              },
            }}
          />
          Planned route
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <Box
            component="span"
            sx={{
              display: 'inline-block',
              width: 24,
              height: GPX_TRACK_STROKE_WIDTH + GPX_LINE_OUTLINE_WIDTH,
              position: 'relative',
              bgcolor: GPX_LINE_OUTLINE_COLOR,
              mr: 1,
              '&::after': {
                content: '""',
                position: 'absolute',
                insetInline: 0,
                top: GPX_LINE_OUTLINE_WIDTH / 2,
                borderTop: `${GPX_TRACK_STROKE_WIDTH}px dashed ${GPX_TRACK_COLOR}`,
                opacity: GPX_LINE_OPACITY,
              },
            }}
          />
          Recorded Activity tracks (dashed)
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <CircleIcon sx={{ color: '#007c83', fontSize: 14, mr: 0.5 }} />
          Waypoints
        </Typography>
      </Stack>
      {showTracks && recordedTracks.length > 0 && (
        <Box component="ul" aria-label="Recorded Activity tracks" sx={{ m: 0, pl: 3 }}>
          {recordedTracks.map((track) => (
            <Typography component="li" variant="body2" key={track.id}>
              {track.label}
            </Typography>
          ))}
        </Box>
      )}
    </Stack>
  )
}
