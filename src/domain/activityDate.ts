export function ukToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find((item) => item.type === type)?.value
    if (!value) throw new Error(`UK date is missing ${type}.`)
    return value
  }
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function activityDateError(value: string, now = new Date()): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Activity date must use YYYY-MM-DD format.'
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value)
    return 'Activity date must be a real calendar date.'
  if (value > ukToday(now)) return 'Activity date cannot be in the future (UK time).'
  return undefined
}
