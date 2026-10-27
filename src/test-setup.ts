import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// JSDOM has no layout or scrolling; browser acceptance checks the actual movement.
HTMLElement.prototype.scrollIntoView = vi.fn()

vi.mock('azure-maps-control', () => ({
  AuthenticationType: { anonymous: 'anonymous' },
  Map: class {
    events = { add: (_name: string, callback: () => void) => callback() }
    sources = { add: vi.fn() }
    layers = { add: vi.fn() }
    dispose = vi.fn()
  },
  Popup: class {
    setOptions = vi.fn()
    open = vi.fn()
  },
  source: {
    DataSource: class {
      add = vi.fn()
      clear = vi.fn()
    },
  },
  layer: { BubbleLayer: class {}, SymbolLayer: class {} },
  data: {
    Feature: class {
      constructor(..._args: unknown[]) {}
    },
    Point: class {
      constructor(..._args: unknown[]) {}
    },
  },
}))

afterEach(() => {
  cleanup()
})
