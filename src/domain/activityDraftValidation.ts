import { activityDateError } from './activityDate'
import type { ActivityLocation, AwardedStatus, ExternalPhotoReference, Reference } from './visit'

export type ActivityDraftValidationInput = {
  name: string
  date: string
  locationKind: ActivityLocation['kind']
  postcode: string
  latitude: string
  longitude: string
  supportsCategories: boolean
  category: AwardedStatus | ''
  removesRecordedAward: boolean
  awardRemovalConfirmed: boolean
  references: readonly Pick<Reference, 'title' | 'url' | 'previewImageUrl'>[]
  photoReferences: readonly Pick<ExternalPhotoReference, 'title' | 'url'>[]
}

export function validateActivityDraft(input: ActivityDraftValidationInput): {
  errors: Record<string, string>
  location?: ActivityLocation
} {
  const errors: Record<string, string> = {}
  if (!input.name.trim()) errors.name = 'Activity title is required.'
  const dateError = activityDateError(input.date)
  if (dateError) errors.date = dateError

  let location: ActivityLocation | undefined
  if (input.locationKind === 'postcode') {
    const postcode = input.postcode.trim()
    if (!postcode) errors.postcode = 'Postcode is required.'
    else location = { kind: 'postcode', postcode }
  } else if (!input.latitude.trim() || !input.longitude.trim()) {
    errors.coordinates = 'Enter both latitude and longitude.'
  } else {
    const latitude = Number(input.latitude)
    const longitude = Number(input.longitude)
    if (Number.isNaN(latitude) || Number.isNaN(longitude))
      errors.coordinates = 'Latitude and longitude must be numeric.'
    else if (latitude < -90 || latitude > 90) errors.coordinates = 'Latitude must be between -90 and 90.'
    else if (longitude < -180 || longitude > 180) errors.coordinates = 'Longitude must be between -180 and 180.'
    else location = { kind: 'coordinates', latitude, longitude }
  }

  if (input.supportsCategories && !input.category) errors.category = 'Select Bronze, Silver or Gold.'
  if (input.removesRecordedAward && !input.awardRemovalConfirmed)
    errors.awardRemoval = 'Confirm removal of the recorded award before saving.'
  input.references.forEach((reference, index) => {
    if (!reference.title.trim()) errors[`reference-${index}-title`] = 'Reference title is required.'
    if (!reference.url.trim().startsWith('https://'))
      errors[`reference-${index}-url`] = 'Reference URL must start with https://.'
    if (reference.previewImageUrl && !reference.previewImageUrl.trim().startsWith('https://'))
      errors[`reference-${index}-preview`] = 'Preview image URL must start with https://.'
  })
  input.photoReferences.forEach((photo, index) => {
    if (!photo.title.trim()) errors[`photo-${index}-title`] = 'Photo title is required.'
    if (!photo.url.trim().startsWith('https://')) errors[`photo-${index}-url`] = 'Photo URL must start with https://.'
  })
  return { errors, location }
}
