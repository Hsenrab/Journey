import { useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  AppBar,
  Box,
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
import DashboardIcon from '@mui/icons-material/Dashboard'
import PlaceIcon from '@mui/icons-material/Place'
import SettingsIcon from '@mui/icons-material/Settings'

const navItems = [
  { label: 'Dashboard', to: '/', icon: <DashboardIcon /> },
  { label: 'Locations', to: '/locations', icon: <PlaceIcon /> },
  { label: 'Settings', to: '/settings', icon: <SettingsIcon /> },
]

const drawerWidth = 240

export function Layout({ children }: { children: ReactNode }) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [open, setOpen] = useState(false)
  const location = useLocation()

  const navList = (
    <List>
      {navItems.map((item) => (
        <ListItemButton
          key={item.to}
          component={Link}
          to={item.to}
          selected={location.pathname === item.to}
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
        <Toolbar>
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
            National Trust Tracker
          </Typography>
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
