import { Alert, AlertTitle, Link as MuiLink } from '@mui/material'
import { Link } from 'react-router-dom'
import { readOnlyReason, type ReadOnlyReason } from '../domain/dataMode'
import { useWaypoints } from '../features/journey/JourneyContext'

const reasonText: Record<ReadOnlyReason, string> = {
  fallback: 'Demo Cosmos data could not be loaded, so bundled demo data is shown and cannot be changed.',
  error: 'The selected data could not be loaded, so nothing can be changed until it loads.',
  viewer: 'Your Journey access is viewer only, so you can read this data but not change it.',
  demoLocal: 'Demo local data is bundled sample data, so it cannot be changed.',
}

/**
 * Explains why write actions are hidden in the current data mode. Renders nothing
 * when the data is writable; distinct from EmptyState, which covers empty collections.
 */
export function ReadOnlyNotice() {
  const { activeDataMode, dataMode, loadError, loading, readOnly, role } = useWaypoints()
  const reason = readOnlyReason({ activeDataMode, dataMode, loadError, readOnly, role }, loading)
  if (!reason) return null

  return (
    <Alert severity="info">
      <AlertTitle>Read-only mode</AlertTitle>
      {reasonText[reason]}{' '}
      <MuiLink component={Link} to="/settings">
        Change the data mode in Settings
      </MuiLink>
      .
    </Alert>
  )
}
