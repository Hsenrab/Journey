import { useState } from 'react'
import { Alert, ThemeProvider } from '@mui/material'
import CssBaseline from '@mui/material/CssBaseline'
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useRouteError } from 'react-router-dom'
import { theme } from './theme'
import { Layout } from '../components/Layout'
import { WaypointsProvider } from '../features/journey/JourneyContext'
import Dashboard from '../pages/Dashboard'
import Locations from '../pages/Locations'
import LocationDetails from '../pages/LocationDetails'
import Settings from '../pages/Settings'
import Ideas from '../pages/Ideas'
import IdeaDetails from '../pages/IdeaDetails'
import Activities from '../pages/Activities'
import ActivityDetails from '../pages/ActivityDetails'
import MapPage from '../pages/MapPage'
import ChallengeDetails from '../pages/ChallengeDetails'

export function ApplicationError() {
  const error = useRouteError()
  return <Alert severity="error">{error instanceof Error ? error.message : String(error)}</Alert>
}

function Shell() {
  return (
    <WaypointsProvider>
      <Layout>
        <Outlet />
      </Layout>
    </WaypointsProvider>
  )
}

const routes = [
  { path: '/', element: <Navigate to="/challenges" replace /> },
  { path: '/waypoints', element: <Locations /> },
  { path: '/waypoints/:id', element: <LocationDetails /> },
  { path: '/challenges', element: <Dashboard /> },
  { path: '/challenges/:challengeId', element: <ChallengeDetails /> },
  { path: '/ideas', element: <Ideas /> },
  { path: '/ideas/:ideaId', element: <IdeaDetails /> },
  { path: '/activities', element: <Activities /> },
  { path: '/activities/:activityId', element: <ActivityDetails /> },
  { path: '/map', element: <MapPage /> },
  { path: '/settings', element: <Settings /> },
]

export default function App() {
  const [router] = useState(() =>
    createBrowserRouter([{ element: <Shell />, errorElement: <ApplicationError />, children: routes }]),
  )
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <RouterProvider router={router} />
    </ThemeProvider>
  )
}
