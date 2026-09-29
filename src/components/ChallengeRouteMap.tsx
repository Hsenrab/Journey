import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Box, Stack, Typography } from '@mui/material'
import CircleIcon from '@mui/icons-material/Circle'
import * as atlas from 'azure-maps-control'
import 'azure-maps-control/dist/atlas.min.css'
import type { PlannedRoute, Waypoint } from '../domain/visit'

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
  if (!contentType?.includes('application/json')) {
    throw new Error(`Map access returned ${contentType ?? 'no content type'} instead of JSON.`)
  }
  return (await response.json()) as MapsToken
}

export function ChallengeRouteMap({
  plannedRoute,
  waypoints,
}: {
  plannedRoute?: PlannedRoute
  waypoints: readonly Waypoint[]
}) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<atlas.Map | null>(null)
  const [token, setToken] = useState<MapsToken | null>(null)
  const [error, setError] = useState<string | null>(null)
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
      const waypointSource = new atlas.source.DataSource('challenge-waypoints')
      instance.sources.add([routeSource, waypointSource])
      routeSource.add(
        plannedRoute?.geometry.coordinates.map(
          (coordinates) => new atlas.data.Feature(new atlas.data.LineString(coordinates)),
        ) ?? [],
      )
      waypointSource.add(
        locatedWaypoints.map(
          (waypoint) =>
            new atlas.data.Feature(
              new atlas.data.Point([waypoint.location!.longitude!, waypoint.location!.latitude!]),
              { title: waypoint.title },
            ),
        ),
      )
      instance.layers.add([
        new atlas.layer.LineLayer(routeSource, 'challenge-route-line', {
          strokeColor: '#7b1fa2',
          strokeWidth: 5,
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
      const positions = [
        ...(plannedRoute?.geometry.coordinates.flat() ?? []),
        ...locatedWaypoints.map((waypoint) => [waypoint.location!.longitude!, waypoint.location!.latitude!]),
      ]
      if (positions.length > 1) {
        instance.setCamera({
          bounds: atlas.data.BoundingBox.fromPositions(positions),
          padding: 40,
        })
      } else if (positions.length === 1) {
        instance.setCamera({ center: positions[0], zoom: 9 })
      }
    })
    return () => {
      instance.dispose()
      map.current = null
    }
  }, [locatedWaypoints, plannedRoute, token])

  if (error) return <Alert severity="error">{error}</Alert>

  return (
    <Stack spacing={1}>
      <Box
        ref={container}
        aria-label="Challenge route map"
        sx={{ height: { xs: 360, sm: 480 }, width: 1, borderRadius: 1, overflow: 'hidden' }}
      />
      <Stack direction="row" spacing={2} aria-label="Challenge map legend">
        <Typography variant="body2" color="text.secondary">
          <Box component="span" sx={{ display: 'inline-block', width: 24, borderTop: '4px solid #7b1fa2', mr: 1 }} />
          Planned route
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <CircleIcon sx={{ color: '#007c83', fontSize: 14, mr: 0.5 }} />
          Waypoints
        </Typography>
      </Stack>
    </Stack>
  )
}
