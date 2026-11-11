import { useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  AppBar,
  Box,
  Chip,
  Container,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import PlaceIcon from '@mui/icons-material/Place'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import LightbulbIcon from '@mui/icons-material/Lightbulb'
import HikingIcon from '@mui/icons-material/Hiking'
import MapIcon from '@mui/icons-material/Map'
import SettingsIcon from '@mui/icons-material/Settings'
import { dataModeStatus, type DataModeStatus } from '../domain/dataMode'
import { useWaypoints } from '../features/journey/JourneyContext'

const navItems = [
  { label: 'Waypoints', to: '/waypoints', icon: <PlaceIcon /> },
  { label: 'Progress', to: '/challenges', icon: <EmojiEventsIcon /> },
  { label: 'Ideas', to: '/ideas', icon: <LightbulbIcon /> },
  { label: 'Activities', to: '/activities', icon: <HikingIcon /> },
  { label: 'Map', to: '/map', icon: <MapIcon /> },
  { label: 'Settings', to: '/settings', icon: <SettingsIcon /> },
]

const drawerWidth = 240
const dataModeStatusView: Record<
  DataModeStatus,
  { label: string; color: 'default' | 'error' | 'info' | 'warning'; filled: boolean }
> = {
  fallback: { label: 'Read-only · load warning', color: 'warning', filled: true },
  error: { label: 'Load failed', color: 'error', filled: true },
  loading: { label: 'Loading', color: 'info', filled: true },
  viewer: { label: 'Viewer read-only', color: 'warning', filled: true },
  demoLocal: { label: 'Read-only · sample data', color: 'warning', filled: true },
  readOnly: { label: 'Read-only', color: 'warning', filled: true },
  admin: { label: 'Admin · can edit', color: 'info', filled: false },
  local: { label: 'No authenticated role', color: 'default', filled: false },
}

const dataModeLabels = {
  'demo-local': 'Demo local',
  'demo-cosmos': 'Demo Cosmos',
  production: 'Production',
} as const

export function Layout({ children }: { children: ReactNode }) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const { activeDataMode, dataMode, loadError, loading, readOnly, role, confirmNavigation } = useWaypoints()
  const status = dataModeStatus({ activeDataMode, dataMode, loadError, loading, readOnly, role })
  const chip = dataModeStatusView[status]
  const datasetLabel =
    status === 'fallback'
      ? 'Demo Cosmos · showing Demo local'
      : status === 'error'
        ? `${dataModeLabels[dataMode]} · not loaded`
        : loading
          ? activeDataMode === dataMode
            ? `Loading ${dataModeLabels[dataMode]}`
            : `${dataModeLabels[dataMode]} · showing ${dataModeLabels[activeDataMode]}`
          : dataModeLabels[activeDataMode]

  const navList = (
    <List>
      {navItems.map((item) => (
        <ListItemButton
          key={item.to}
          component={Link}
          to={item.to}
          selected={location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)}
          onClick={() => setOpen(false)}
        >
          <ListItemIcon>{item.icon}</ListItemIcon>
          <ListItemText primary={item.label} />
        </ListItemButton>
      ))}
    </List>
  )

  return (
    <Box
      sx={{ display: 'flex' }}
      onClickCapture={(event) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.altKey ||
          event.ctrlKey ||
          event.shiftKey
        )
          return
        const anchor = (event.target as HTMLElement).closest('a')
        if (anchor?.target && anchor.target !== '_self') return
        if (anchor?.getAttribute('href') === '/settings' && !confirmNavigation('Settings')) {
          event.preventDefault()
          event.stopPropagation()
        }
      }}
    >
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ flexWrap: 'wrap', gap: 1, py: { xs: 1, sm: 0 } }}>
          {isMobile && (
            <IconButton
              color="inherit"
              edge="start"
              aria-label="open navigation"
              onClick={() => setOpen(true)}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography
            variant="h6"
            component={Link}
            to="/challenges"
            sx={{ color: 'inherit', flexGrow: 1, minWidth: 0, textDecoration: 'none' }}
          >
            Journey
          </Typography>
          <Box
            sx={{
              alignItems: 'center',
              display: 'flex',
              flexShrink: 0,
              gap: 1,
              justifyContent: { xs: 'flex-end', sm: 'flex-start' },
              width: { xs: '100%', sm: 'auto' },
            }}
          >
            <Chip
              aria-label={`Dataset: ${datasetLabel}`}
              color="default"
              label={datasetLabel}
              size="small"
              variant="outlined"
            />
            <Chip
              aria-label={`Access and load status: ${chip.label}`}
              color={chip.color}
              label={chip.label}
              size="small"
              variant={chip.filled ? 'filled' : 'outlined'}
            />
          </Box>
        </Toolbar>
      </AppBar>

      {isMobile ? (
        <Drawer anchor="left" open={open} onClose={() => setOpen(false)}>
          <Toolbar />
          {navList}
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
          }}
        >
          <Toolbar />
          <Divider />
          {navList}
        </Drawer>
      )}

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, width: { sm: `calc(100% - ${drawerWidth}px)` } }}>
        <Toolbar />
        <Container maxWidth="md" sx={{ py: 2 }}>
          {children}
        </Container>
      </Box>
    </Box>
  )
}
