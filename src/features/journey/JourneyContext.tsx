import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { load, save } from '../../services/storage'
import {
  activitiesForWaypoint,
  statusForWaypoint,
  type Activity,
  type Status,
  type WaypointsData,
} from '../../domain/visit'

type Action = { type: 'add-activity'; activity: Activity } | { type: 'restore'; data: WaypointsData }

type WaypointsValue = {
  data: WaypointsData
  addActivity: (activity: Activity) => void
  restore: (data: WaypointsData) => void
  activitiesFor: (waypointId: string) => Activity[]
  statusFor: (waypointId: string) => Status
}

const Context = createContext<WaypointsValue | null>(null)

function reducer(data: WaypointsData, action: Action): WaypointsData {
  return action.type === 'add-activity' ? { ...data, activities: [...data.activities, action.activity] } : action.data
}

export function WaypointsProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, undefined, load)
  useEffect(() => save(data), [data])
  const value = useMemo<WaypointsValue>(
    () => ({
      data,
      addActivity: (activity) => dispatch({ type: 'add-activity', activity }),
      restore: (newData) => dispatch({ type: 'restore', data: newData }),
      activitiesFor: (waypointId) => activitiesForWaypoint(data.activities, waypointId),
      statusFor: (waypointId) => statusForWaypoint(data.activities, waypointId),
    }),
    [data],
  )
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useWaypoints() {
  const value = useContext(Context)
  if (!value) throw new Error('useWaypoints must be used inside WaypointsProvider')
  return value
}

export type { WaypointsData }
