import { ThemeProvider } from '@mui/material'
import CssBaseline from '@mui/material/CssBaseline'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { theme } from './theme'
import { Layout } from '../components/Layout'
import { WaypointsProvider } from '../features/journey/JourneyContext'
import Dashboard from '../pages/Dashboard'
import Locations from '../pages/Locations'
import LocationDetails from '../pages/LocationDetails'
import Settings from '../pages/Settings'
import Ideas from '../pages/Ideas'
import Activities from '../pages/Activities'
import MapPage from '../pages/MapPage'

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <WaypointsProvider>
          <Layout>
            <Routes>
              <Route path="/" element={<Navigate to="/waypoints" replace />} />
              <Route path="/waypoints" element={<Locations />} />
              <Route path="/waypoints/:id" element={<LocationDetails />} />
              <Route path="/challenges" element={<Dashboard />} />
              <Route path="/ideas" element={<Ideas />} />
              <Route path="/activities" element={<Activities />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Layout>
        </WaypointsProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
