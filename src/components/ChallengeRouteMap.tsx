import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  Stack,
  Typography,
} from '@mui/material'
import * as atlas from 'azure-maps-control'
import 'azure-maps-control/dist/atlas.min.css'
import type { Activity, GpxGeometry } from '../domain/visit'
import { activityTitle, formatActivityDate } from '../domain/visit'

type MapsToken = { token: string; clientId: string }

async function getMapsToken(): Promise<MapsToken> {
  const response = await fetch('/api/maps/token')
  if (response.status === 404) {
    throw new Error(
      'Map access is unavailable in this environment because the Maps API is not deployed. Pull request previews do not include the API; use the production site.',
    )
  }
  if (!response.ok) throw new Error(`Map access failed: ${await response.text()}`)
  const contentType = response.headers.get('content-type')
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error(`Map access returned ${contentType ?? 'no content type'} instead of JSON.`)
  }
  return (await response.json()) as MapsToken
}

type ChallengeRouteMapProps = {
  plannedRoute?: GpxGeometry
  activities: readonly Activity[]
}

function lineFeatures(geometry: GpxGeometry, properties: Record<string, unknown>) {
  return geometry.segments.map(
    (segment) =>
      new atlas.data.Feature(
        new atlas.data.LineString(segment.points.map((point) => [point.longitude, point.latitude])),
        properties,
      ),
  )
}

function trackLabel(activity: Activity) {
  return activity.name ? `${activityTitle(activity)} — ${formatActivityDate(activity.date)}` : activityTitle(activity)
}

export function ChallengeRouteMap({ plannedRoute, activities }: ChallengeRouteMapProps) {
  const tracks = useMemo(
    () =>
      activities.filter((activity): activity is Activity & { recordedTrack: GpxGeometry } => !!activity.recordedTrack),
    [activities],
  )
  const [visibleTrackIds, setVisibleTrackIds] = useState(() => new Set(tracks.map((activity) => activity.activityId)))
  const [token, setToken] = useState<MapsToken | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<atlas.Map | null>(null)
  const plannedSource = useRef<atlas.source.DataSource | null>(null)
  const trackSource = useRef<atlas.source.DataSource | null>(null)
  const hasGeometry = !!plannedRoute || tracks.length > 0
  const allTracksVisible = tracks.length > 0 && visibleTrackIds.size === tracks.length

  useEffect(() => {
    if (!hasGeometry) return
    void getMapsToken()
      .then(setToken)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
  }, [hasGeometry])

  useEffect(() => {
    if (!token || !container.current || map.current) return
    let initialToken: string | undefined = token.token
    const instance = new atlas.Map(container.current, {
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
    instance.events.add('ready', () => {
      const planned = new atlas.source.DataSource('challenge-planned-route')
      const recorded = new atlas.source.DataSource('challenge-recorded-tracks')
      instance.sources.add([planned, recorded])
      instance.layers.add([
        new atlas.layer.LineLayer(planned, 'challenge-planned-route-outline', {
          strokeColor: '#ffffff',
          strokeWidth: 8,
        }),
        new atlas.layer.LineLayer(planned, 'challenge-planned-route', {
          strokeColor: '#1565c0',
          strokeWidth: 5,
        }),
        new atlas.layer.LineLayer(recorded, 'challenge-recorded-tracks', {
          strokeColor: '#c62828',
          strokeWidth: 3,
          strokeDashArray: [2, 2],
        }),
      ])
      plannedSource.current = planned
      trackSource.current = recorded
      setMapReady(true)
    })
    map.current = instance
    return () => {
      instance.dispose()
      map.current = null
      plannedSource.current = null
      trackSource.current = null
      setMapReady(false)
    }
  }, [token])

  useEffect(() => {
    const source = plannedSource.current
    if (!source) return
    source.clear()
    if (plannedRoute) source.add(lineFeatures(plannedRoute, { kind: 'planned', label: 'Planned route' }))
  }, [mapReady, plannedRoute])

  useEffect(() => {
    const source = trackSource.current
    if (!source) return
    source.clear()
    source.add(
      tracks.flatMap((activity) =>
        visibleTrackIds.has(activity.activityId)
          ? lineFeatures(activity.recordedTrack, {
              kind: 'recorded',
              activityId: activity.activityId,
              label: trackLabel(activity),
            })
          : [],
      ),
    )
  }, [mapReady, tracks, visibleTrackIds])

  useEffect(() => {
    const instance = map.current
    if (!instance || !mapReady) return
    const geometries = [
      ...(plannedRoute ? [plannedRoute] : []),
      ...tracks
        .filter((activity) => visibleTrackIds.has(activity.activityId))
        .map((activity) => activity.recordedTrack),
    ]
    const points = geometries.flatMap((geometry) => geometry.segments.flatMap((segment) => segment.points))
    if (points.length === 0) return
    const longitudes = points.map((point) => point.longitude)
    const latitudes = points.map((point) => point.latitude)
    const bounds = [
      Math.min(...longitudes),
      Math.min(...latitudes),
      Math.max(...longitudes),
      Math.max(...latitudes),
    ] as [number, number, number, number]
    if (bounds[0] === bounds[2] && bounds[1] === bounds[3]) {
      instance.setCamera({ center: [bounds[0], bounds[1]], zoom: 14 })
      return
    }
    instance.setCamera({ bounds, padding: 48 })
  }, [mapReady, plannedRoute, tracks, visibleTrackIds])

  const setAllTracksVisible = (visible: boolean) => {
    setVisibleTrackIds(new Set(visible ? tracks.map((activity) => activity.activityId) : []))
  }

  const setTrackVisible = (activityId: string, visible: boolean) => {
    setVisibleTrackIds((current) => {
      const next = new Set(current)
      if (visible) next.add(activityId)
      else next.delete(activityId)
      return next
    })
  }

  if (!hasGeometry) {
    return <Typography color="text.secondary">No planned route or recorded Activity tracks are available.</Typography>
  }

  return (
    <Stack spacing={2}>
      {!plannedRoute && <Alert severity="info">This Challenge does not have a planned route.</Alert>}
      {tracks.length === 0 && (
        <Typography color="text.secondary">No linked Activities have recorded GPX tracks.</Typography>
      )}
      <Box
        role="group"
        aria-label="Route legend"
        sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, color: 'text.secondary' }}
      >
        {plannedRoute && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Box aria-hidden sx={{ width: 32, borderTop: '5px solid #1565c0', outline: '2px solid white' }} />
            <Typography variant="body2">Planned route — solid blue</Typography>
          </Stack>
        )}
        {tracks.length > 0 && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Box aria-hidden sx={{ width: 32, borderTop: '3px dashed #c62828' }} />
            <Typography variant="body2">Recorded Activity — dashed red</Typography>
          </Stack>
        )}
      </Box>
      {tracks.length > 0 && (
        <FormControl component="fieldset">
          <FormLabel component="legend">Recorded Activity tracks</FormLabel>
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={allTracksVisible}
                  indeterminate={visibleTrackIds.size > 0 && !allTracksVisible}
                  onChange={(event) => setAllTracksVisible(event.target.checked)}
                />
              }
              label="Show all recorded tracks"
            />
            {tracks.map((activity) => (
              <FormControlLabel
                key={activity.activityId}
                control={
                  <Checkbox
                    checked={visibleTrackIds.has(activity.activityId)}
                    onChange={(event) => setTrackVisible(activity.activityId, event.target.checked)}
                  />
                }
                label={trackLabel(activity)}
              />
            ))}
          </FormGroup>
        </FormControl>
      )}
      {error && <Alert severity="error">{error}</Alert>}
      <Box
        ref={container}
        aria-label="Challenge route map"
        sx={{ minHeight: 420, borderRadius: 1, overflow: 'hidden' }}
      />
    </Stack>
  )
}
