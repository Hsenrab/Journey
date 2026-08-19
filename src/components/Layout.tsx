import { useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  AppBar,
  Box,
  Chip,
  Container,
  Divider,
  Drawer,
  FormControlLabel,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Switch,
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
import { isDemoModeEnabled, setDemoMode } from '../services/storage'

const navItems = [
  { label: 'Waypoints', to: '/waypoints', icon: <PlaceIcon /> },
  { label: 'Challenges', to: '/challenges', icon: <EmojiEventsIcon /> },
  { label: 'Ideas', to: '/ideas', icon: <LightbulbIcon /> },
  { label: 'Activities', to: '/activities', icon: <HikingIcon /> },
  { label: 'Map', to: '/map', icon: <MapIcon /> },
  { label: 'Settings', to: '/settings', icon: <SettingsIcon /> },
]

const drawerWidth = 240

export function Layout({ children }: { children: ReactNode }) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [open, setOpen] = useState(false)
  const [demoModeEnabled, setDemoModeEnabled] = useState(isDemoModeEnabled)
  const location = useLocation()
  const { reload } = useWaypoints()

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
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Waypoints
          </Typography>
          <Box
            sx={{
              alignItems: 'center',
              display: 'flex',
              flexShrink: 0,
              gap: 1,
            }}
          >
            <FormControlLabel
              control={
                <Switch
                  checked={demoModeEnabled}
                  color="default"
                  onChange={(event) => {
                    const enabled = event.target.checked
                    setDemoMode(enabled)
                    setDemoModeEnabled(enabled)
                    reload()
                  }}
                />
              }
              label="Demo data"
              sx={{ m: 0, whiteSpace: 'nowrap' }}
            />
            <Chip
              color={demoModeEnabled ? 'warning' : 'default'}
              label={demoModeEnabled ? 'Demo active' : 'Personal data'}
              size="small"
              variant={demoModeEnabled ? 'filled' : 'outlined'}
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

      <Box component="main" sx={{ flexGrow: 1, width: { sm: `calc(100% - ${drawerWidth}px)` } }}>
        <Toolbar />
        <Container maxWidth="md" sx={{ py: 4 }}>
          {children}
        </Container>
      </Box>
    </Box>
  )
}
