export type Status = 'not-started' | 'bronze' | 'silver' | 'gold'

export type Location = {
  id: string
  name: string
  county: string
  type: string
  description: string
  url: string
}

export const locations: Location[] = [
  { id: 'dunham-massey', name: 'Dunham Massey', county: 'Greater Manchester', type: 'House and garden', description: 'A Georgian house, formal garden and historic deer park.', url: 'https://www.nationaltrust.org.uk/visit/cheshire-greater-manchester/dunham-massey' },
  { id: 'lyme', name: 'Lyme', county: 'Cheshire', type: 'House and garden', description: 'A grand house surrounded by garden, moorland and a deer park.', url: 'https://www.nationaltrust.org.uk/visit/cheshire-greater-manchester/lyme' },
  { id: 'quarry-bank', name: 'Quarry Bank', county: 'Cheshire', type: 'Mill and garden', description: 'Working cotton mill, apprentice house, gardens and woodland.', url: 'https://www.nationaltrust.org.uk/visit/cheshire-greater-manchester/quarry-bank' },
  { id: 'hare-hill', name: 'Hare Hill', county: 'Cheshire', type: 'Garden', description: 'A peaceful walled garden surrounded by woodland.', url: 'https://www.nationaltrust.org.uk/visit/cheshire-greater-manchester/hare-hill' },
  { id: 'alderley-edge', name: 'Alderley Edge and Cheshire Countryside', county: 'Cheshire', type: 'Countryside', description: 'Woodland walks and dramatic sandstone escarpment.', url: 'https://www.nationaltrust.org.uk/visit/cheshire-greater-manchester/alderley-edge-and-cheshire-countryside' },
  { id: 'little-moreton-hall', name: 'Little Moreton Hall', county: 'Cheshire', type: 'Historic house', description: 'An iconic, crooked Tudor manor house.', url: 'https://www.nationaltrust.org.uk/visit/cheshire-greater-manchester/little-moreton-hall' },
  { id: 'nether-alderley-mill', name: 'Nether Alderley Mill', county: 'Cheshire', type: 'Mill', description: 'A restored 16th-century corn mill.', url: 'https://www.nationaltrust.org.uk/visit/cheshire-greater-manchester/nether-alderley-mill' },
]
