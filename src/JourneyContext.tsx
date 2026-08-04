import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react'
import { load, save, type JourneyData, type Visit } from './storage'

type Action = { type: 'save'; id: string; visit: Visit } | { type: 'restore'; data: JourneyData }
const Context = createContext<{ data: JourneyData; saveVisit: (id: string, visit: Visit) => void; restore: (data: JourneyData) => void } | null>(null)

function reducer(data: JourneyData, action: Action): JourneyData {
  return action.type === 'save' ? { ...data, [action.id]: action.visit } : action.data
}

export function JourneyProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, undefined, load)
  useEffect(() => save(data), [data])
  return <Context.Provider value={{ data, saveVisit: (id, visit) => dispatch({ type: 'save', id, visit }), restore: (newData) => dispatch({ type: 'restore', data: newData }) }}>{children}</Context.Provider>
}

export function useJourney() {
  const value = useContext(Context)
  if (!value) throw new Error('useJourney must be used inside JourneyProvider')
  return value
}
