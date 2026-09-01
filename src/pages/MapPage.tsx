import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  FormControlLabel,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import * as atlas from 'azure-maps-control'
import 'azure-maps-control/dist/atlas.min.css'
import {
  activityCoordinates,
  completionStateForWaypoint,
  filterWaypointsByStatus,
  orderNearbyWaypoints,
  waypointCoordinates,
} from '../domain/map'
import { statusForWaypoint, statusLabels, statusOrder, type Status } from '../domain/visit'
import { useWaypoints } from '../features/journey/JourneyContext'

const brockworth = { latitude: 51.844, longitude: -2.153 }
type MapMode = 'waypoints' | 'activities'
const markerColors = { notStarted: '#455a64', complete: '#2e7d32', activity: '#00838f', selected: '#111827' }
const markerIcon = (border: string, symbol: string, selected = false) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="44" height="52" viewBox="0 0 24 28"><path d="M12 1.5C7.3 1.5 3.5 5.3 3.5 10c0 6.2 8.5 15.2 8.5 15.2S20.5 16.2 20.5 10C20.5 5.3 16.7 1.5 12 1.5Z" fill="#fff" stroke="${selected ? markerColors.selected : '#263238'}" stroke-width="${selected ? 2.5 : 1.2}"/><circle cx="12" cy="10" r="6.2" fill="#fff" stroke="${border}" stroke-width="2.4"/>${symbol}</svg>`)}`
const markerIcons = {
  'waypoint-not-started': markerIcon(markerColors.notStarted, '<circle cx="12" cy="10" r="2" fill="#455a64"/>'),
  'waypoint-complete': markerIcon(
    markerColors.complete,
    '<path d="m8.5 10 2.2 2.2 4.8-5" fill="none" stroke="#2e7d32" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  ),
  activity: markerIcon(markerColors.activity, '<circle cx="12" cy="10" r="2.6" fill="#00838f"/>'),
  selected: markerIcon(markerColors.selected, '<circle cx="12" cy="10" r="2" fill="#111827"/>', true),
}

type MapsToken = { token: string; expiresOn: string; clientId: string }
type SearchResult = {
  position?: { lat: number; lon: number }
  address?: { freeformAddress?: string }
  type?: string
}

async function requestApi(path: string, operation: string): Promise<Response> {
  const response = await fetch(path)
  if (response.status === 404) {
    throw new Error(
      `${operation} is unavailable in this environment because the Maps API is not deployed. Pull request previews do not include the API; use the production site.`,
    )
  }
  if (!response.ok) throw new Error(`${operation} failed: ${await response.text()}`)
  return response
}

async function responseJson<T>(response: Response, operation: string): Promise<T> {
  const contentType = response.headers.get('content-type')
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error(`${operation} returned ${contentType ?? 'no content type'} instead of JSON.`)
  }
  return (await response.json()) as T
}

async function getMapsToken(): Promise<MapsToken> {
  const response = await requestApi('/api/maps/token', 'Map access')
  return responseJson<MapsToken>(response, 'Map access')
}

export default function MapPage() {
  const { data, statusFor } = useWaypoints()
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<atlas.Map | null>(null)
  const waypointSource = useRef<atlas.source.DataSource | null>(null)
  const activitySource = useRef<atlas.source.DataSource | null>(null)
  const [mode, setMode] = useState<MapMode>('waypoints')
  const [statuses, setStatuses] = useState<Status[]>([...statusOrder])
  const [token, setToken] = useState<MapsToken | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(null)
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null)
  const [originQuery, setOriginQuery] = useState('Brockworth, Gloucestershire')
  const [origin, setOrigin] = useState(brockworth)
  const [originResults, setOriginResults] = useState<SearchResult[]>([])

  useEffect(() => {
    void getMapsToken()
      .then(setToken)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
  }, [])

  useEffect(() => {
    if (!token || !container.current || map.current) return
    let initialToken: string | undefined = token.token
    const instance = new atlas.Map(container.current, {
      center: [origin.longitude, origin.latitude],
      zoom: 8,
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
      for (const [id, icon] of Object.entries(markerIcons)) void instance.imageSprite.add(id, icon)
      const popup = new atlas.Popup()
      const waypoints = new atlas.source.DataSource('waypoints', { cluster: true, clusterRadius: 45 })
      const activities = new atlas.source.DataSource('activities', { cluster: true, clusterRadius: 45 })
      instance.sources.add([waypoints, activities])
      const waypointLayer = new atlas.layer.SymbolLayer(waypoints, 'waypoints', {
        filter: ['!', ['has', 'point_count']],
        iconOptions: { image: ['get', 'icon'], allowOverlap: true, size: 1 },
        textOptions: { textField: ['get', 'label'], offset: [0, 1.2], allowOverlap: false, minZoom: 11 },
      })
      const waypointClusterLayer = new atlas.layer.SymbolLayer(waypoints, 'waypoint-cluster-labels', {
        filter: ['has', 'point_count'],
        textOptions: { textField: ['get', 'point_count_abbreviated'], color: '#fff', size: 14 },
        iconOptions: { image: 'marker-blue', color: '#263238', size: 0.9 },
      })
      const activityLayer = new atlas.layer.SymbolLayer(activities, 'activities', {
        filter: ['!', ['has', 'point_count']],
        iconOptions: { image: ['get', 'icon'], allowOverlap: true, size: 1 },
        textOptions: { textField: ['get', 'label'], offset: [0, 1.2], allowOverlap: false, minZoom: 11 },
      })
      const activityClusterLayer = new atlas.layer.SymbolLayer(activities, 'activity-cluster-labels', {
        filter: ['has', 'point_count'],
        textOptions: { textField: ['get', 'point_count_abbreviated'], color: '#fff', size: 14 },
        iconOptions: { image: 'marker-blue', color: markerColors.activity, size: 0.9 },
      })
      instance.layers.add([
        new atlas.layer.BubbleLayer(waypoints, 'waypoint-clusters', {
          filter: ['has', 'point_count'],
          radius: 18,
          color: '#263238',
        }),
        waypointLayer,
        waypointClusterLayer,
        activityLayer,
        activityClusterLayer,
      ])
      const zoomIntoCluster = (event: atlas.MapMouseEvent) => {
        const shape = event.shapes?.[0]
        if (!shape || !('getCoordinates' in shape)) return
        const camera = instance.getCamera()
        instance.setCamera({
          center: shape.getCoordinates(),
          zoom: Math.min((camera.zoom ?? 8) + 2, 18),
        })
      }
      instance.events.add('click', waypointClusterLayer, zoomIntoCluster)
      instance.events.add('click', activityClusterLayer, zoomIntoCluster)
      instance.events.add('click', waypointLayer, (event) => {
        const shape = event.shapes?.[0]
        const properties = shape && 'getProperties' in shape ? shape.getProperties() : shape?.properties
        const waypointId = properties?.waypointId as string | undefined
        if (!waypointId) return
        const waypoint = data.waypoints.find((item) => item.waypointId === waypointId)
        if (!waypoint) return
        const content = document.createElement('div')
        const title = document.createElement('strong')
        title.textContent = waypoint.title
        const state = document.createElement('p')
        const completed = completionStateForWaypoint(waypoint, data.activities) === 'complete'
        state.textContent = `Completion: ${completed ? 'Complete' : 'Not started'} · Award: ${statusLabels[statusForWaypoint(data.activities, waypoint.waypointId)]}`
        const summary = document.createElement('p')
        summary.textContent = `${data.activities.filter((activity) => activity.waypointId === waypoint.waypointId).length} recorded activities`
        const link = document.createElement('a')
        link.href = `/waypoints/${waypoint.waypointId}`
        link.textContent = 'Open waypoint details'
        content.append(title, state, summary, link)
        const coordinates = waypointCoordinates(waypoint)
        if (!coordinates) return
        popup.setOptions({ content, position: [coordinates.longitude, coordinates.latitude] })
        popup.open(instance)
        setSelectedWaypointId(waypointId)
      })
      instance.events.add('click', activityLayer, (event) => {
        const shape = event.shapes?.[0]
        const properties = shape && 'getProperties' in shape ? shape.getProperties() : shape?.properties
        const activityId = properties?.activityId as string | undefined
        const activity = data.activities.find((item) => item.activityId === activityId)
        if (!activity) return
        const coordinates = activityCoordinates(activity)
        if (!coordinates) return
        const content = document.createElement('div')
        const title = document.createElement('strong')
        title.textContent = activity.date
        const details = document.createElement('p')
        const waypoint = activity.waypointId
          ? data.waypoints.find((item) => item.waypointId === activity.waypointId)
          : undefined
        details.textContent = `${waypoint?.title ?? 'No linked waypoint'} · ${activity.category ? statusLabels[activity.category] : 'Uncategorised'}`
        const link = document.createElement('a')
        link.href = `/activities/${activity.activityId}`
        link.textContent = 'Open activity details'
        content.append(title, details, link)
        popup.setOptions({ content, position: [coordinates.longitude, coordinates.latitude] })
        popup.open(instance)
        setSelectedActivityId(activity.activityId)
      })
      waypointSource.current = waypoints
      activitySource.current = activities
      setMapReady(true)
    })
    map.current = instance
    return () => {
      instance.dispose()
      map.current = null
      waypointSource.current = null
      activitySource.current = null
      setMapReady(false)
    }
  }, [data.activities, data.waypoints, origin.latitude, origin.longitude, token])

  const visibleWaypoints = useMemo(
    () => filterWaypointsByStatus(data.waypoints, statuses, statusFor),
    [data.waypoints, statuses, statusFor],
  )
  const nearby = useMemo(() => orderNearbyWaypoints(visibleWaypoints, origin).slice(0, 10), [origin, visibleWaypoints])
  const waypointWithoutCoordinates = data.waypoints.filter((waypoint) => !waypointCoordinates(waypoint)).length
  const activityWithoutCoordinates = data.activities.filter((activity) => !activityCoordinates(activity)).length

  useEffect(() => {
    const source = waypointSource.current
    if (!source) return
    source.clear()
    if (mode === 'waypoints') {
      source.add(
        visibleWaypoints.flatMap((waypoint) => {
          const coordinates = waypointCoordinates(waypoint)
          if (!coordinates) return []
          const status = statusFor(waypoint.waypointId)
          return [
            new atlas.data.Feature(new atlas.data.Point([coordinates.longitude, coordinates.latitude]), {
              label: waypoint.title,
              icon:
                selectedWaypointId === waypoint.waypointId
                  ? 'selected'
                  : completionStateForWaypoint(waypoint, data.activities) === 'complete'
                    ? 'waypoint-complete'
                    : 'waypoint-not-started',
              award: statusLabels[status],
              waypointId: waypoint.waypointId,
            }),
          ]
        }),
      )
    }
  }, [data.activities, mapReady, mode, selectedWaypointId, statusFor, visibleWaypoints])

  useEffect(() => {
    const source = activitySource.current
    if (!source) return
    source.clear()
    if (mode === 'activities') {
      source.add(
        data.activities.flatMap((activity) => {
          const coordinates = activityCoordinates(activity)
          if (!coordinates) return []
          const waypoint = data.waypoints.find((item) => item.waypointId === activity.waypointId)
          return [
            new atlas.data.Feature(new atlas.data.Point([coordinates.longitude, coordinates.latitude]), {
              label: activity.date,
              icon: selectedActivityId === activity.activityId ? 'selected' : 'activity',
              activityId: activity.activityId,
              description: `${waypoint?.title ?? 'No linked waypoint'} · ${activity.category ? statusLabels[activity.category] : 'Uncategorised'}`,
            }),
          ]
        }),
      )
    }
  }, [data.activities, data.waypoints, mapReady, mode, selectedActivityId])

  const findNearby = async () => {
    setError(null)
    let response: Response
    try {
      response = await requestApi(`/api/maps/search?query=${encodeURIComponent(originQuery)}`, 'Nearby search')
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause))
      return
    }
    const body = await responseJson<{ results: Array<{ position?: { lat: number; lon: number } }> }>(
      response,
      'Nearby search',
    )
    const results = body.results.filter((result) => result.position)
    if (results.length === 0) {
      setError('No places matched that search. Choose another postcode or place.')
      return
    }
    if (results.length === 1) {
      selectOrigin(results[0]!)
      return
    }
    setOriginResults(results)
  }

  const selectOrigin = (result: SearchResult) => {
    if (!result.position) return
    setOrigin({ latitude: result.position.lat, longitude: result.position.lon })
    setOriginResults([])
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Map</Typography>
      <Card>
        <CardContent>
          <Stack
            component="form"
            spacing={2}
            onSubmit={(event) => {
              event.preventDefault()
              void findNearby()
            }}
          >
            <Typography variant="h6">Find nearby waypoints</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Box
                component="input"
                aria-label="Nearby origin"
                value={originQuery}
                onChange={(event) => setOriginQuery(event.target.value)}
                sx={{ p: 1, flex: 1 }}
              />
              <Button type="submit" variant="contained">
                Search
              </Button>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Origin is temporary and does not change saved waypoint or activity data. Results are ordered by
              straight-line miles.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Stack spacing={1.5}>
            <ToggleButtonGroup
              exclusive
              value={mode}
              onChange={(_, nextMode: MapMode | null) => {
                if (nextMode) setMode(nextMode)
              }}
              aria-label="Map mode"
              fullWidth
            >
              <ToggleButton value="waypoints">Waypoints</ToggleButton>
              <ToggleButton value="activities">Activities</ToggleButton>
            </ToggleButtonGroup>
            {mode === 'waypoints' && (
              <Accordion disableGutters>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>Award filters</AccordionSummary>
                <AccordionDetails>
                  <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap' }}>
                    {statusOrder.map((status) => (
                      <FormControlLabel
                        key={status}
                        control={
                          <Checkbox
                            checked={statuses.includes(status)}
                            onChange={(event) =>
                              setStatuses((current) =>
                                event.target.checked ? [...current, status] : current.filter((item) => item !== status),
                              )
                            }
                          />
                        }
                        label={statusLabels[status]}
                      />
                    ))}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            )}
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }} aria-label="Map legend">
              {mode === 'waypoints' ? (
                <>
                  <Chip size="small" label="Not started" sx={{ border: `2px solid ${markerColors.notStarted}` }} />
                  <Chip size="small" label="Complete" sx={{ border: `2px solid ${markerColors.complete}` }} />
                </>
              ) : (
                <Chip size="small" label="Activity" sx={{ border: `2px solid ${markerColors.activity}` }} />
              )}
              <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                Select a marker for details
              </Typography>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
      {error && <Alert severity="error">{error}</Alert>}
      {originResults.length > 0 && (
        <Card>
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="h6">Choose a nearby origin</Typography>
              <Typography color="text.secondary">
                Azure Maps found multiple approximate matches. Select the intended place.
              </Typography>
              {originResults.map((result, index) => (
                <Button
                  key={`${result.address?.freeformAddress ?? 'result'}-${index}`}
                  onClick={() => selectOrigin(result)}
                >
                  {result.address?.freeformAddress ?? 'Unnamed Azure Maps result'}
                </Button>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}
      <Box
        ref={container}
        aria-label="Azure Maps interactive map"
        sx={{ height: { xs: 360, sm: 560 }, width: '100%' }}
      />
      <Alert severity="info">
        {waypointWithoutCoordinates} waypoint{waypointWithoutCoordinates === 1 ? '' : 's'} and{' '}
        {activityWithoutCoordinates} {activityWithoutCoordinates === 1 ? 'activity' : 'activities'} have no coordinates
        and are not shown. Locations are only geocoded when saved or deliberately changed.
      </Alert>
      <Stack spacing={1}>
        <Typography variant="h6">Nearest visible waypoints</Typography>
        {nearby.map(({ waypoint, distanceMiles }) => (
          <Button
            key={waypoint.waypointId}
            component={Link}
            to={`/waypoints/${waypoint.waypointId}`}
            onClick={() => setSelectedWaypointId(waypoint.waypointId)}
          >
            {statusLabels[statusFor(waypoint.waypointId)]}: {waypoint.title} — {distanceMiles.toFixed(1)} miles
          </Button>
        ))}
        {selectedWaypointId && <Typography role="status">Opening waypoint details.</Typography>}
      </Stack>
    </Stack>
  )
}
