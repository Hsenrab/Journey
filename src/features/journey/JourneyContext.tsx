import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { load, save, type JourneyData } from '../../services/storage'
import { statusForLocation, visitsForLocation, type Visit } from '../../domain/visit'
import type { Status } from '../../domain/location'

type Action = { type: 'add'; visit: Visit } | { type: 'restore'; data: JourneyData }

type JourneyValue = {
  data: JourneyData
  addVisit: (visit: Visit) => void
  restore: (data: JourneyData) => void
  visitsFor: (locationId: string) => Visit[]
  statusFor: (locationId: string) => Status
}

const Context = createContext<JourneyValue | null>(null)

function reducer(data: JourneyData, action: Action): JourneyData {
  return action.type === 'add' ? { visits: [...data.visits, action.visit] } : action.data
}

export function JourneyProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, undefined, load)
  useEffect(() => save(data), [data])
  const value = useMemo<JourneyValue>(
    () => ({
      data,
      addVisit: (visit) => dispatch({ type: 'add', visit }),
      restore: (newData) => dispatch({ type: 'restore', data: newData }),
      visitsFor: (locationId) => visitsForLocation(data.visits, locationId),
      statusFor: (locationId) => statusForLocation(data.visits, locationId),
    }),
    [data],
  )
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useJourney() {
  const value = useContext(Context)
  if (!value) throw new Error('useJourney must be used inside JourneyProvider')
  return value
}
