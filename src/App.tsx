import { useMemo, useRef, useState } from 'react'
import { BrowserRouter, Link, Route, Routes, useParams } from 'react-router-dom'
import { Alert, AppBar, Box, Button, Card, CardContent, Chip, Container, CssBaseline, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Toolbar, Typography } from '@mui/material'
import { locations, type Status } from './data'
import { JourneyProvider, useJourney } from './JourneyContext'
import { parseImport } from './storage'
import './App.css'

const labels: Record<Status, string> = { 'not-started': 'Not Started', bronze: 'Bronze', silver: 'Silver', gold: 'Gold' }
const order: Status[] = ['not-started', 'bronze', 'silver', 'gold']

function Header() {
  return <AppBar position="static"><Toolbar><Typography variant="h6" sx={{ flexGrow: 1 }}>National Trust Tracker</Typography><Button color="inherit" component={Link} to="/">Locations</Button><Button color="inherit" component={Link} to="/rules">Challenge rules</Button><Button color="inherit" component={Link} to="/data">My data</Button></Toolbar></AppBar>
}

function Locations() {
  const { data } = useJourney()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('name')
  const list = useMemo(() => locations.filter((location) => {
    const visitStatus = data[location.id]?.status ?? 'not-started'
    return (status === 'all' || visitStatus === status) && `${location.name} ${location.county} ${location.type}`.toLowerCase().includes(query.toLowerCase())
  }).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : (data[b.id]?.status ?? 'not-started').localeCompare(data[a.id]?.status ?? 'not-started')), [data, query, sort, status])
  const complete = locations.filter((l) => order.indexOf(data[l.id]?.status ?? 'not-started') >= 2).length
  return <Stack spacing={3}><Box><Typography variant="h4">Your challenge</Typography><Typography color="text.secondary">Cheshire and Greater Manchester · {complete} of {locations.length} main experiences completed</Typography></Box><Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}><TextField label="Search locations" value={query} onChange={(e) => setQuery(e.target.value)} fullWidth /><FormControl><InputLabel>Status</InputLabel><Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><MenuItem value="all">All statuses</MenuItem>{order.map((s) => <MenuItem key={s} value={s}>{labels[s]}</MenuItem>)}</Select></FormControl><FormControl><InputLabel>Sort</InputLabel><Select label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}><MenuItem value="name">Name</MenuItem><MenuItem value="status">Progress</MenuItem></Select></FormControl></Stack><Box className="location-grid">{list.map((location) => <Card key={location.id}><CardContent><Stack spacing={1}><Typography variant="h6">{location.name}</Typography><Typography color="text.secondary">{location.county} · {location.type}</Typography><Chip label={labels[data[location.id]?.status ?? 'not-started']} color={data[location.id]?.status === 'gold' ? 'success' : 'default'} /><Button component={Link} to={`/locations/${location.id}`}>View details</Button></Stack></CardContent></Card>)}</Box></Stack>
}

function Detail() {
  const { id = '' } = useParams()
  const location = locations.find((item) => item.id === id)
  const { data, saveVisit } = useJourney()
  const visit = data[id]
  const [status, setStatus] = useState<Status>(visit?.status ?? 'bronze')
  const [date, setDate] = useState(visit?.date ?? new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState(visit?.notes ?? '')
  const [photos, setPhotos] = useState(visit?.photos.join('\n') ?? '')
  const [saved, setSaved] = useState(false)
  if (!location) return <Alert severity="error">Location not found.</Alert>
  return <Stack spacing={3}><Button component={Link} to="/">← All locations</Button><Typography variant="h4">{location.name}</Typography><Typography>{location.description}</Typography><Button component="a" href={location.url} target="_blank" rel="noreferrer">National Trust visitor information</Button><Card><CardContent><Stack component="form" spacing={2} onSubmit={(e) => { e.preventDefault(); saveVisit(id, { status, date, notes, photos: photos.split('\n').map((item) => item.trim()).filter(Boolean) }); setSaved(true) }}><Typography variant="h5">Log your visit</Typography>{saved && <Alert severity="success">Visit saved.</Alert>}<FormControl><InputLabel>Completion level</InputLabel><Select label="Completion level" value={status} onChange={(e) => setStatus(e.target.value as Status)}>{order.slice(1).map((item) => <MenuItem key={item} value={item}>{labels[item]}</MenuItem>)}</Select></FormControl><TextField label="Visit date" type="date" value={date} onChange={(e) => setDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} /><TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} multiline minRows={3} /><TextField label="Photo references (one URL or filename per line)" value={photos} onChange={(e) => setPhotos(e.target.value)} multiline minRows={2} /><Button type="submit" variant="contained">Save visit</Button></Stack></CardContent></Card></Stack>
}

function Rules() {
  return <Stack spacing={2}><Typography variant="h4">Challenge rules</Typography><Typography>Locations are publicly accessible National Trust visitor destinations with their own visitor information page in the Cheshire and Greater Manchester boundary. Cafés, shops, offices, holiday cottages, standalone car parks and non-qualifying tenant attractions are excluded.</Typography>{order.map((status) => <Card key={status}><CardContent><Typography variant="h6">{labels[status]}</Typography><Typography>{status === 'not-started' ? 'No visit recorded.' : status === 'bronze' ? 'Physically visited.' : status === 'silver' ? 'Main visitor experience completed — the main challenge completion level.' : 'Everything reasonably available to a normal visitor completed.'}</Typography></CardContent></Card>)}</Stack>
}

function DataPage() {
  const { data, restore } = useJourney()
  const input = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const exportData = () => { const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'national-trust-tracker.json'; link.click(); URL.revokeObjectURL(url) }
  return <Stack spacing={3}><Typography variant="h4">Your data</Typography><Typography>Visits, notes and photo references stay in this browser. Export regularly to keep a portable backup.</Typography><Button variant="contained" onClick={exportData}>Export JSON</Button><Button component="label" variant="outlined">Restore JSON<input ref={input} hidden type="file" accept="application/json" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; file.text().then((text) => { try { restore(parseImport(text)); setMessage('Your data was restored.') } catch { setMessage('That file is not a valid tracker export.') } }) }} /></Button>{message && <Alert severity={message.startsWith('Your') ? 'success' : 'error'}>{message}</Alert>}</Stack>
}

function Shell() { return <><Header /><Container maxWidth="md" sx={{ py: 4 }}><Routes><Route path="/" element={<Locations />} /><Route path="/locations/:id" element={<Detail />} /><Route path="/rules" element={<Rules />} /><Route path="/data" element={<DataPage />} /></Routes></Container></> }
export default function App() { return <BrowserRouter><JourneyProvider><CssBaseline /><Shell /></JourneyProvider></BrowserRouter> }
