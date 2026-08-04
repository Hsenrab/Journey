export type Status = 'not-started' | 'bronze' | 'silver' | 'gold'

export type Location = {
  id: string
  name: string
  county: string
  type: string
  description: string
  url: string
}
