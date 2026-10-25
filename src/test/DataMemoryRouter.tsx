import { useState, type ComponentProps } from 'react'
import { createMemoryRouter, RouterProvider, type MemoryRouter as RouterProps } from 'react-router-dom'

export function MemoryRouter({ children, initialEntries, initialIndex }: ComponentProps<typeof RouterProps>) {
  const [router] = useState(() =>
    createMemoryRouter([{ path: '*', element: <>{children}</> }], { initialEntries, initialIndex }),
  )
  return <RouterProvider router={router} />
}
