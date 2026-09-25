import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Stack,
  Tab,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tabs,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import CircleIcon from '@mui/icons-material/Circle'
import * as atlas from 'azure-maps-control'
import 'azure-maps-control/dist/atlas.min.css'
import {
  activityCoordinates,
  completionStateForWaypoint,
  filterWaypointsByStatus,
  orderNearbyActivities,
  orderNearbyWaypoints,
  waypointCoordinates,
} from '../domain/map'
import {
  statusLabels,
  statusOrder,
  type Activity,
  type AwardedStatus,
  type Status,
  type Waypoint,
} from '../domain/visit'
import { PageHeader } from '../components/PageHeader'
import { useWaypoints } from '../features/journey/JourneyContext'

const brockworth = { latitude: 51.844, longitude: -2.153 }
type MapMode = 'waypoints' | 'activities'
const markerColors = { notStarted: '#455a64', complete: '#2e7d32', activity: '#007c83' }
const tierColors: Record<AwardedStatus, string> = { gold: '#b7791f', silver: '#757575', bronze: '#a05a2c' }
const markerIcon = (color: string, symbol: string, selected = false) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${selected ? 54 : 48}" height="${selected ? 64 : 58}" viewBox="0 0 28 34">${selected ? '<path d="M14 3C8.5 3 4 7.5 4 13c0 7.2 10 17.7 10 17.7S24 20.2 24 13C24 7.5 19.5 3 14 3Z" fill="none" stroke="#fff" stroke-width="5" stroke-linejoin="round" opacity=".96"/>' : ''}<path d="M14 3C8.5 3 4 7.5 4 13c0 7.2 10 17.7 10 17.7S24 20.2 24 13C24 7.5 19.5 3 14 3Z" fill="${color}" stroke="#263238" stroke-width="1.4" stroke-linejoin="round"/><circle cx="14" cy="13" r="6.8" fill="#fff"/>${symbol}</svg>`)}`
const markerIcons = {
  'waypoint-not-started': markerIcon(
    markerColors.notStarted,
    `<circle cx="14" cy="13" r="2.4" fill="${markerColors.notStarted}"/>`,
  ),
  'waypoint-not-started-selected': markerIcon(
    markerColors.notStarted,
    `<circle cx="14" cy="13" r="2.4" fill="${markerColors.notStarted}"/>`,
    true,
  ),
  'waypoint-complete': markerIcon(
    markerColors.complete,
    `<path d="m10.2 13 2.5 2.5 5.3-5.7" fill="none" stroke="${markerColors.complete}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  'waypoint-complete-selected': markerIcon(
    markerColors.complete,
    `<path d="m10.2 13 2.5 2.5 5.3-5.7" fill="none" stroke="${markerColors.complete}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    true,
  ),
  activity: markerIcon(
    markerColors.activity,
    `<path d="M14 9.6 17.4 13 14 16.4 10.6 13Z" fill="${markerColors.activity}"/>`,
  ),
  'activity-selected': markerIcon(
    markerColors.activity,
    `<path d="M14 9.6 17.4 13 14 16.4 10.6 13Z" fill="${markerColors.activity}"/>`,
    true,
  ),
}

function waypointDisplayName(waypoint: Pick<Waypoint, 'title'>): string {
  return waypoint.title.trim() || 'Unnamed waypoint'
}

function activityDisplayName(activity: Pick<Activity, 'name'>): string {
  return activity.name?.trim() || 'Unnamed activity'
}

function formatMiles(miles: number): string {
  return `${miles.toFixed(1)} miles`
}

function CompletionIcon({ complete }: { complete: boolean }) {
  const label = complete ? 'Completed' : 'Not completed'
  const Icon = complete ? CheckBoxIcon : CheckBoxOutlineBlankIcon
  return (
    <Box component="span" role="img" aria-label={label} title={label} sx={{ display: 'inline-flex' }}>
      <Icon fontSize="small" color={complete ? 'success' : 'action'} />
    </Box>
  )
}

function TierIcon({ tier }: { tier: AwardedStatus }) {
  const label = `${statusLabels[tier]} tier`
  return (
    <Box component="span" role="img" aria-label={label} title={label} sx={{ display: 'inline-flex' }}>
      <CircleIcon fontSize="small" sx={{ color: tierColors[tier], fontSize: 12 }} />
    </Box>
  )
}

function CompactMapListItem({
  to,
  name,
  complete,
  tier,
  distance,
  date,
  onClick,
}: {
  to: string
  name: string
  complete: boolean
  tier?: AwardedStatus
  distance: string
  date?: string
  onClick?: () => void
}) {
  return (
    <Button
      component={Link}
      to={to}
      onClick={onClick}
      title={name}
      sx={{
        width: 1,
        justifyContent: 'flex-start',
        borderBottom: '1px solid',
        borderColor: 'divider',
        borderRadius: 0,
        px: 0.5,
        py: 0.75,
        textAlign: 'left',
        textTransform: 'none',
      }}
    >
      <Stack component="span" spacing={0.25} sx={{ minWidth: 0, width: 1 }}>
        <Typography
          component="span"
          variant="body2"
          sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}
        >
          {name}
        </Typography>
        <Box
          component="span"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            minWidth: 0,
            color: 'text.secondary',
            typography: 'caption',
          }}
        >
          <CompletionIcon complete={complete} />
          {tier && <TierIcon tier={tier} />}
          <Box component="span">{distance}</Box>
          {date && (
            <Box component="span" sx={{ color: 'text.disabled' }}>
              {date}
            </Box>
          )}
        </Box>
      </Stack>
    </Button>
  )
}

type MapsToken = { token: string; expiresOn: string; clientId: string }
type SearchResult = {
  position?: { lat: number; lon: number }
  address?: { freeformAddress?: string }
  type?: string
}

type PopupContent = {
  eyebrow: string
  title: string
  metadata?: string[]
  summary: string
  href: string
  onNavigate?: (href: string) => void
}

function buildPopupContent({ eyebrow, title, metadata = [], summary, href, onNavigate }: PopupContent) {
  const content = document.createElement('article')
  content.className = 'journey-map-popup'

  const eyebrowElement = document.createElement('p')
  eyebrowElement.className = 'journey-map-popup__eyebrow'
  eyebrowElement.textContent = eyebrow

  const titleElement = document.createElement('h2')
  titleElement.className = 'journey-map-popup__title'
  titleElement.textContent = title

  const metadataElement = document.createElement('div')
  metadataElement.className = 'journey-map-popup__metadata'
  for (const item of metadata) {
    const value = document.createElement('span')
    value.textContent = item
    metadataElement.append(value)
  }

  const summaryElement = document.createElement('p')
  summaryElement.className = 'journey-map-popup__summary'
  summaryElement.textContent = summary

  const link = document.createElement('a')
  link.className = 'journey-map-popup__action'
  link.href = href
  link.textContent = 'View details'
  if (onNavigate) {
    link.addEventListener('click', (event) => {
      event.preventDefault()
      onNavigate(href)
    })
  }

  content.append(eyebrowElement, titleElement)
  if (metadata.length > 0) content.append(metadataElement)
  content.append(summaryElement, link)
  return content
}

function buildWaypointPopupContent(
  waypointTitle: string,
  activities: Array<{ activityId: string; label: string }>,
  onNavigate?: (href: string) => void,
): HTMLElement {
  const content = document.createElement('article')
  content.className = 'journey-map-popup'

  const eyebrowElement = document.createElement('p')
  eyebrowElement.className = 'journey-map-popup__eyebrow'
  eyebrowElement.textContent = 'Waypoint'

  const titleElement = document.createElement('h2')
  titleElement.className = 'journey-map-popup__title'
  titleElement.textContent = waypointTitle

  const summaryElement = document.createElement('p')
  summaryElement.className = 'journey-map-popup__summary'

  if (activities.length === 0) {
    summaryElement.textContent = 'No recorded activities yet'
    content.append(eyebrowElement, titleElement, summaryElement)
    return content
  }

  summaryElement.textContent = 'Recorded activities'
  const list = document.createElement('ul')
  list.className = 'journey-map-popup__list'
  for (const activity of activities) {
    const item = document.createElement('li')
    const link = document.createElement('a')
    link.className = 'journey-map-popup__list-link'
    link.href = `/activities/${activity.activityId}`
    link.textContent = activity.label
    if (onNavigate) {
      link.addEventListener('click', (event) => {
        event.preventDefault()
        onNavigate(link.getAttribute('href') ?? '')
      })
    }
    item.append(link)
    list.append(item)
  }
  content.append(eyebrowElement, titleElement, summaryElement, list)
  return content
}

type ClusterItem = { title: string; summary: string; href: string }

function buildClusterPopupContent(eyebrow: string, total: number, items: ClusterItem[]) {
  const content = document.createElement('article')
  content.className = 'journey-map-popup'

  const eyebrowElement = document.createElement('p')
  eyebrowElement.className = 'journey-map-popup__eyebrow'
  eyebrowElement.textContent = eyebrow

  const titleElement = document.createElement('h2')
  titleElement.className = 'journey-map-popup__title'
  titleElement.textContent = `${total} in this group`

  const list = document.createElement('ul')
  list.className = 'journey-map-popup__list'
  for (const item of items) {
    const entry = document.createElement('li')

    const link = document.createElement('a')
    link.className = 'journey-map-popup__link'
    link.href = item.href
    link.textContent = item.title

    const summary = document.createElement('p')
    summary.className = 'journey-map-popup__summary'
    summary.textContent = item.summary

    entry.append(link, summary)
    list.append(entry)
  }

  content.append(eyebrowElement, titleElement, list)
  if (items.length < total) {
    const note = document.createElement('p')
    note.className = 'journey-map-popup__summary'
    note.textContent = `Showing the first ${items.length}. Zoom in to see the rest.`
    content.append(note)
  }
  return content
}

function toClusterItem(properties: Record<string, unknown> | undefined): ClusterItem | undefined {
  if (!properties) return undefined
  const title = properties.label as string
  if (properties.waypointId) {
    return { title, summary: properties.award as string, href: `/waypoints/${properties.waypointId as string}` }
  }
  if (properties.activityId) {
    return {
      title,
      summary: properties.description as string,
      href: `/activities/${properties.activityId as string}`,
    }
  }
  return undefined
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

const MIN_MAP_HEIGHT = 320
const MAP_BOTTOM_MARGIN = 24
const CLUSTER_LIST_LIMIT = 25

export default function MapPage() {
  const navigate = useNavigate()
  const { data, statusFor } = useWaypoints()
  const container = useRef<HTMLDivElement>(null)
  const mapBox = useRef<HTMLDivElement>(null)
  const filters = useRef<HTMLDivElement>(null)
  const map = useRef<atlas.Map | null>(null)
  const mapPopup = useRef<atlas.Popup | null>(null)
  const waypointSource = useRef<atlas.source.DataSource | null>(null)
  const activitySource = useRef<atlas.source.DataSource | null>(null)
  const [mode, setMode] = useState<MapMode>('waypoints')
  const [statuses, setStatuses] = useState<Status[]>([...statusOrder])
  const [token, setToken] = useState<MapsToken | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(null)
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null)
  const [mobilePanel, setMobilePanel] = useState<'map' | 'list'>('map')
  const [originQuery, setOriginQuery] = useState('Brockworth, Gloucestershire')
  const [origin, setOrigin] = useState(brockworth)
  const [originResults, setOriginResults] = useState<SearchResult[]>([])
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true })
  const [mapHeight, setMapHeight] = useState(MIN_MAP_HEIGHT)

  useEffect(() => {
    void getMapsToken()
      .then(setToken)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
  }, [])

  useEffect(() => {
    const element = mapBox.current
    if (!element) return

    const updateHeight = () => {
      const top = element.getBoundingClientRect().top
      const available = window.innerHeight - top - MAP_BOTTOM_MARGIN
      setMapHeight(Math.max(available, MIN_MAP_HEIGHT))
    }

    updateHeight()
    window.addEventListener('resize', updateHeight)

    let observer: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined' && filters.current) {
      observer = new ResizeObserver(updateHeight)
      observer.observe(filters.current)
    }

    return () => {
      window.removeEventListener('resize', updateHeight)
      observer?.disconnect()
    }
  }, [error])

  useEffect(() => {
    if (!mapReady) return
    map.current?.resize()
  }, [mapHeight, mapReady])

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
      const popup = new atlas.Popup({ pixelOffset: [0, -20] })
      let activeClusterRequest = 0
      instance.events.add('close', popup, () => {
        activeClusterRequest += 1
        setSelectedWaypointId(null)
        setSelectedActivityId(null)
      })
      mapPopup.current = popup
      const waypoints = new atlas.source.DataSource('waypoints', { cluster: true, clusterRadius: 45 })
      const activities = new atlas.source.DataSource('activities', { cluster: true, clusterRadius: 45 })
      instance.sources.add([waypoints, activities])
      const waypointLayer = new atlas.layer.SymbolLayer(waypoints, 'waypoints', {
        filter: ['!', ['has', 'point_count']],
        iconOptions: { image: ['get', 'icon'], allowOverlap: true, size: 0.5 },
        textOptions: {
          textField: ['get', 'label'],
          offset: [0, 0.9],
          allowOverlap: false,
          minZoom: 11,
          color: '#263238',
          haloColor: '#fff',
          haloWidth: 2,
        },
      })
      const waypointClusterLayer = new atlas.layer.SymbolLayer(waypoints, 'waypoint-cluster-labels', {
        filter: ['has', 'point_count'],
        textOptions: { textField: ['get', 'point_count_abbreviated'], color: '#fff', size: 12 },
      })
      const activityLayer = new atlas.layer.SymbolLayer(activities, 'activities', {
        filter: ['!', ['has', 'point_count']],
        iconOptions: { image: ['get', 'icon'], allowOverlap: true, size: 0.5 },
        textOptions: {
          textField: ['get', 'label'],
          offset: [0, 0.9],
          allowOverlap: false,
          minZoom: 11,
          color: '#263238',
          haloColor: '#fff',
          haloWidth: 2,
        },
      })
      const activityClusterLayer = new atlas.layer.SymbolLayer(activities, 'activity-cluster-labels', {
        filter: ['has', 'point_count'],
        textOptions: { textField: ['get', 'point_count_abbreviated'], color: '#fff', size: 12 },
      })
      const waypointClusterBubbleLayer = new atlas.layer.BubbleLayer(waypoints, 'waypoint-clusters', {
        filter: ['has', 'point_count'],
        radius: 10,
        color: markerColors.notStarted,
        strokeColor: '#fff',
        strokeWidth: 2,
      })
      const activityClusterBubbleLayer = new atlas.layer.BubbleLayer(activities, 'activity-clusters', {
        filter: ['has', 'point_count'],
        radius: 10,
        color: markerColors.activity,
        strokeColor: '#fff',
        strokeWidth: 2,
      })
      instance.layers.add([
        waypointClusterBubbleLayer,
        activityClusterBubbleLayer,
        waypointLayer,
        waypointClusterLayer,
        activityLayer,
        activityClusterLayer,
      ])
      const listCluster = (source: atlas.source.DataSource, eyebrow: string) => (event: atlas.MapMouseEvent) => {
        const shape = event.shapes?.[0]
        if (!shape || !('getCoordinates' in shape) || !('getProperties' in shape)) return
        const properties = shape.getProperties()
        const clusterId = properties?.cluster_id as number | undefined
        if (clusterId === undefined) return
        const total = properties.point_count as number
        const position = shape.getCoordinates() as atlas.data.Position
        const request = ++activeClusterRequest
        void source.getClusterLeaves(clusterId, CLUSTER_LIST_LIMIT, 0).then((leaves) => {
          if (request !== activeClusterRequest) return
          const items = leaves.flatMap((leaf) => {
            const leafProperties = 'getProperties' in leaf ? leaf.getProperties() : leaf.properties
            const item = toClusterItem(leafProperties as Record<string, unknown> | undefined)
            return item ? [item] : []
          })
          if (items.length === 0) return
          popup.setOptions({ content: buildClusterPopupContent(eyebrow, total, items), position })
          popup.open(instance)
          setSelectedWaypointId(null)
          setSelectedActivityId(null)
        })
      }
      const listWaypointCluster = listCluster(waypoints, 'Waypoints here')
      const listActivityCluster = listCluster(activities, 'Activities here')
      instance.events.add('click', waypointClusterBubbleLayer, listWaypointCluster)
      instance.events.add('click', waypointClusterLayer, listWaypointCluster)
      instance.events.add('click', activityClusterBubbleLayer, listActivityCluster)
      instance.events.add('click', activityClusterLayer, listActivityCluster)
      instance.events.add('click', waypointLayer, (event) => {
        activeClusterRequest += 1
        const shape = event.shapes?.[0]
        const properties = shape && 'getProperties' in shape ? shape.getProperties() : shape?.properties
        const waypointId = properties?.waypointId as string | undefined
        if (!waypointId) return
        const waypoint = data.waypoints.find((item) => item.waypointId === waypointId)
        if (!waypoint) return
        const waypointActivities = data.activities
          .filter((activity) => activity.waypointId === waypoint.waypointId)
          .map((activity) => ({
            activityId: activity.activityId,
            label: activityDisplayName(activity),
          }))
        const content = buildWaypointPopupContent(waypointDisplayName(waypoint), waypointActivities, (href) =>
          navigate(href),
        )
        const coordinates = waypointCoordinates(waypoint)
        if (!coordinates) return
        popup.setOptions({ content, position: [coordinates.longitude, coordinates.latitude] })
        popup.open(instance)
        setSelectedActivityId(null)
        setSelectedWaypointId(waypointId)
      })
      instance.events.add('click', activityLayer, (event) => {
        activeClusterRequest += 1
        const shape = event.shapes?.[0]
        const properties = shape && 'getProperties' in shape ? shape.getProperties() : shape?.properties
        const activityId = properties?.activityId as string | undefined
        const activity = data.activities.find((item) => item.activityId === activityId)
        if (!activity) return
        const coordinates = activityCoordinates(activity)
        if (!coordinates) return
        const waypoint = activity.waypointId
          ? data.waypoints.find((item) => item.waypointId === activity.waypointId)
          : undefined
        const content = buildPopupContent({
          eyebrow: 'Activity',
          title: activityDisplayName(activity),
          metadata: [activity.category ? statusLabels[activity.category] : 'Uncategorised'],
          summary: waypoint ? waypointDisplayName(waypoint) : 'No linked waypoint',
          href: `/activities/${activity.activityId}`,
          onNavigate: (href) => navigate(href),
        })
        popup.setOptions({ content, position: [coordinates.longitude, coordinates.latitude] })
        popup.open(instance)
        setSelectedWaypointId(null)
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
      mapPopup.current = null
      setMapReady(false)
    }
  }, [data.activities, data.waypoints, navigate, origin.latitude, origin.longitude, token])

  const visibleWaypoints = useMemo(
    () => filterWaypointsByStatus(data.waypoints, statuses, statusFor),
    [data.waypoints, statuses, statusFor],
  )
  const nearby = useMemo(() => orderNearbyWaypoints(visibleWaypoints, origin).slice(0, 10), [origin, visibleWaypoints])
  const nearbyActivities = useMemo(
    () => orderNearbyActivities(data.activities, origin).slice(0, 10),
    [data.activities, origin],
  )
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
              label: waypointDisplayName(waypoint),
              icon:
                selectedWaypointId === waypoint.waypointId
                  ? completionStateForWaypoint(waypoint, data.activities) === 'complete'
                    ? 'waypoint-complete-selected'
                    : 'waypoint-not-started-selected'
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
              label: activityDisplayName(activity),
              icon: selectedActivityId === activity.activityId ? 'activity-selected' : 'activity',
              activityId: activity.activityId,
              description: `${waypoint ? waypointDisplayName(waypoint) : 'No linked waypoint'} · ${activity.category ? statusLabels[activity.category] : 'Uncategorised'}`,
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
    <Stack spacing={1}>
      <PageHeader title="Map">
        <Tabs
          value={mode}
          onChange={(_, nextMode: MapMode) => {
            mapPopup.current?.close()
            setSelectedWaypointId(null)
            setSelectedActivityId(null)
            setMode(nextMode)
          }}
          aria-label="Map mode"
        >
          <Tab id="waypoints-tab" aria-controls="map-panel" value="waypoints" label="Waypoints" />
          <Tab id="activities-tab" aria-controls="map-panel" value="activities" label="Activities" />
        </Tabs>
      </PageHeader>
      {error && <Alert severity="error">{error}</Alert>}
      <Card ref={filters}>
        <CardContent>
          <Stack
            component="form"
            spacing={1}
            aria-label="Find nearby waypoints"
            onSubmit={(event) => {
              event.preventDefault()
              void findNearby()
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                label="Nearby origin"
                value={originQuery}
                onChange={(event) => setOriginQuery(event.target.value)}
                sx={{ flex: { sm: 1 }, minWidth: 0 }}
              />
              <Button type="submit" variant="contained" sx={{ alignSelf: { sm: 'flex-start' } }}>
                Search
              </Button>
            </Stack>
            {mode === 'waypoints' && (
              <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap' }} role="group" aria-label="Waypoint filters">
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
            )}
          </Stack>
          {originResults.length > 0 && (
            <Stack spacing={1} sx={{ mt: 2 }}>
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
          )}
        </CardContent>
      </Card>
      {isMobile && (
        <ToggleButtonGroup
          exclusive
          value={mobilePanel}
          onChange={(_, value: 'map' | 'list' | null) => {
            if (value) setMobilePanel(value)
          }}
          aria-label="Map view"
          size="small"
        >
          <ToggleButton value="map">Map</ToggleButton>
          <ToggleButton value="list">List</ToggleButton>
        </ToggleButtonGroup>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: 'stretch' }}>
        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'white',
            p: { xs: 1.5, sm: 2 },
            width: { sm: 280 },
            flexShrink: 0,
            display: isMobile && mobilePanel !== 'list' ? 'none' : 'block',
          }}
          aria-label={mode === 'waypoints' ? 'Nearest visible waypoints' : 'Nearest activities'}
        >
          <Stack spacing={0}>
            {mode === 'waypoints'
              ? nearby.map(({ waypoint, distanceMiles: miles }) => {
                  const status = statusFor(waypoint.waypointId)
                  return (
                    <CompactMapListItem
                      key={waypoint.waypointId}
                      to={`/waypoints/${waypoint.waypointId}`}
                      name={waypointDisplayName(waypoint)}
                      complete={completionStateForWaypoint(waypoint, data.activities) === 'complete'}
                      tier={status === 'not-started' ? undefined : status}
                      distance={formatMiles(miles)}
                      onClick={() => setSelectedWaypointId(waypoint.waypointId)}
                    />
                  )
                })
              : nearbyActivities.map(({ activity, distanceMiles: miles }) => (
                  <CompactMapListItem
                    key={activity.activityId}
                    to={`/activities/${activity.activityId}`}
                    name={activityDisplayName(activity)}
                    complete={true}
                    tier={activity.category}
                    distance={formatMiles(miles)}
                    date={activity.date}
                  />
                ))}
            {mode === 'waypoints' && nearby.length === 0 && (
              <Typography color="text.secondary">No visible waypoints.</Typography>
            )}
            {mode === 'activities' && nearbyActivities.length === 0 && (
              <Typography color="text.secondary">No mapped activities yet.</Typography>
            )}
            {selectedWaypointId && <Typography role="status">Opening waypoint details.</Typography>}
          </Stack>
        </Box>
        <Box
          sx={{
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'white',
            flex: 1,
            display: isMobile && mobilePanel !== 'map' ? 'none' : 'block',
          }}
        >
          <Box id="map-panel" role="tabpanel" aria-labelledby={`${mode}-tab`} tabIndex={0}>
            <Box ref={mapBox} sx={{ position: 'relative', height: mapHeight }}>
              <Box ref={container} aria-label="Azure Maps interactive map" sx={{ height: '100%', width: '100%' }} />
              {!mapReady && !error && (
                <Stack
                  role="status"
                  spacing={1}
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'rgba(255, 255, 255, 0.88)',
                  }}
                >
                  <CircularProgress size={30} color="primary" />
                  <Typography variant="body2" color="text.secondary">
                    Loading map
                  </Typography>
                </Stack>
              )}
            </Box>
          </Box>
        </Box>
      </Stack>
      {waypointWithoutCoordinates + activityWithoutCoordinates > 0 && (
        <Alert severity="info">
          {waypointWithoutCoordinates} waypoint{waypointWithoutCoordinates === 1 ? '' : 's'} and{' '}
          {activityWithoutCoordinates} {activityWithoutCoordinates === 1 ? 'activity' : 'activities'} have no
          coordinates and are not shown. Locations are geocoded when they are saved, so re-saving a record resolves its
          coordinates.
        </Alert>
      )}
    </Stack>
  )
}
