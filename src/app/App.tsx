import { ThemeProvider } from '@mui/material'
import CssBaseline from '@mui/material/CssBaseline'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { theme } from './theme'
import { Layout } from '../components/Layout'
import { JourneyProvider } from '../features/journey/JourneyContext'
import Dashboard from '../pages/Dashboard'
import Locations from '../pages/Locations'
import LocationDetails from '../pages/LocationDetails'
import Settings from '../pages/Settings'

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <JourneyProvider>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/locations" element={<Locations />} />
              <Route path="/locations/:id" element={<LocationDetails />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Layout>
        </JourneyProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
