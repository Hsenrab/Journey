import { describe, expect, it } from 'vitest'
import { parseImport } from './storage'

describe('parseImport', () => {
  it('accepts a portable visit export', () => {
    expect(parseImport('{"lyme":{"status":"silver","date":"2026-08-01","notes":"Great day","photos":["lyme.jpg"]}}')).toMatchObject({ lyme: { status: 'silver' } })
  })

  it('rejects malformed imports', () => {
    expect(() => parseImport('{"lyme":{"status":"done"}}')).toThrow()
  })
})
