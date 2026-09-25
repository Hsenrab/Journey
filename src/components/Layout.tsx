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
import { useWaypoints } from '../features/journey/JourneyContext'

const navItems = [
  { label: 'Waypoints', to: '/waypoints', icon: <PlaceIcon /> },
  { label: 'Challenges', to: '/challenges', icon: <EmojiEventsIcon /> },
  { label: 'Ideas', to: '/ideas', icon: <LightbulbIcon /> },
  { label: 'Activities', to: '/activities', icon: <HikingIcon /> },
  { label: 'Map', to: '/map', icon: <MapIcon /> },
  { label: 'Settings', to: '/settings', icon: <SettingsIcon /> },
]

const drawerWidth = 240
type DataModeStatus = 'fallback' | 'error' | 'readOnly' | 'viewer' | 'demoWritable' | 'production'
const dataModeStatusView: Record<
  DataModeStatus,
  { label: string; color: 'default' | 'error' | 'info' | 'warning'; filled: boolean }
> = {
  fallback: { label: 'Local fallback read-only', color: 'warning', filled: true },
  error: { label: 'Load error', color: 'error', filled: true },
  readOnly: { label: 'Read-only', color: 'warning', filled: true },
  viewer: { label: 'Viewer read-only', color: 'warning', filled: true },
  demoWritable: { label: 'Demo writable', color: 'info', filled: false },
  production: { label: 'Production', color: 'default', filled: false },
}

export function Layout({ children }: { children: ReactNode }) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const { activeDataMode, dataMode, loadError, readOnly, role } = useWaypoints()
  const usingLocalFallback = dataMode === 'demo-cosmos' && activeDataMode === 'demo-local' && Boolean(loadError)
  const status: DataModeStatus = usingLocalFallback
    ? 'fallback'
    : loadError
      ? 'error'
      : role === 'viewer'
        ? 'viewer'
        : readOnly
          ? 'readOnly'
          : activeDataMode === 'demo-cosmos'
            ? 'demoWritable'
            : 'production'
  const chip = dataModeStatusView[status]

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
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 2 }}>
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
            sx={{ color: 'inherit', flexGrow: 1, textDecoration: 'none' }}
          >
            Journey
          </Typography>
          <Box
            sx={{
              alignItems: 'center',
              display: 'flex',
              flexShrink: 0,
              gap: 1,
            }}
          >
            <Chip color={chip.color} label={chip.label} size="small" variant={chip.filled ? 'filled' : 'outlined'} />
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

      <Box component="main" sx={{ flexGrow: 1, width: { sm: `calc(100% - ${drawerWidth}px)` } }}>
        <Toolbar />
        <Container maxWidth="md" sx={{ py: 2 }}>
          {children}
        </Container>
      </Box>
    </Box>
  )
}
