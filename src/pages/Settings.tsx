import { useRef, useState } from 'react'
import { Alert, Button, Card, CardContent, Stack, Typography } from '@mui/material'
import { statusLabels, statusOrder, statusRules } from '../domain/visit'
import { useJourney } from '../features/journey/JourneyContext'
import { parseImport } from '../services/storage'

export default function Settings() {
  const { data, restore } = useJourney()
  const input = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'national-trust-tracker.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Stack spacing={4}>
      <Typography variant="h4">Settings</Typography>

      <Stack spacing={2}>
        <Typography variant="h5">Your data</Typography>
        <Typography>
          Visits, notes and photo references stay in this browser. Export regularly to keep a portable backup.
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button variant="contained" onClick={exportData}>
            Export JSON
          </Button>
          <Button component="label" variant="outlined">
            Restore JSON
            <input
              ref={input}
              hidden
              type="file"
              accept="application/json"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                file.text().then((text) => {
                  try {
                    restore(parseImport(text))
                    setMessage('Your data was restored.')
                  } catch {
                    setMessage('That file is not a valid tracker export.')
                  }
                })
              }}
            />
          </Button>
        </Stack>
        {message && <Alert severity={message.startsWith('Your') ? 'success' : 'error'}>{message}</Alert>}
      </Stack>

      <Stack spacing={2}>
        <Typography variant="h5">Challenge rules</Typography>
        <Typography>
          Locations are publicly accessible National Trust visitor destinations with their own visitor information page,
          anywhere in the country. Distance and drive time from Brockworth, Gloucester are shown on each location so you
          can filter or sort by proximity. Cafés, shops, offices, holiday cottages, standalone car parks and
          non-qualifying tenant attractions are excluded.
        </Typography>
        {statusOrder.map((status) => (
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
