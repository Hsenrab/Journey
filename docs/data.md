# Data, import, export, backup and restore

## Where data lives

All visit data is stored in the browser's local storage under the key
`national-trust-tracker-v1`. There is no server, database or account: the data belongs to the
browser profile on the device where it was entered.

Reference data about the locations themselves is compiled into the app from
`src/data/locations.json` (validated by `src/data/locations.ts`) and is never stored in the browser.

## Format

The stored value is a JSON object keyed by location id:

```json
{
  "may-hill": {
    "status": "silver",
    "date": "2026-04-12",
    "notes": "Walked to the summit and the topograph.",
    "photos": ["https://example.com/photo.jpg", "IMG_1234.jpg"]
  }
}
```

| Field    | Type                                            | Notes                                        |
| -------- | ----------------------------------------------- | -------------------------------------------- |
| key      | string                                          | `locationId` from `src/data/locations.json`  |
| `status` | `not-started` \| `bronze` \| `silver` \| `gold` | Stored records are normally bronze or better |
| `date`   | string                                          | Visit date in `YYYY-MM-DD` form              |
| `notes`  | string                                          | Free text; may be empty                      |
| `photos` | string[]                                        | URLs or filenames; no images are stored      |

## Validation

`src/services/storage.ts` validates data with Zod on every load and on import:

- Unreadable or invalid stored data falls back to an empty dataset rather than crashing the app.
- An import file is parsed as data only — nothing in it is executed — and its type, structure,
  `version`, location ids, dates and status values are all validated before anything is saved.
- An invalid or unsupported-version file is rejected with an error and the existing data is left
  unchanged.
- Backups referencing location ids that are not in the catalogue are rejected.

## Backup file format

Exports wrap the visit records in a versioned envelope so future formats can be migrated:

```json
{
  "version": 1,
  "exportedAt": "2026-08-01T00:00:00.000Z",
  "visits": {
    "may-hill": { "status": "silver", "date": "2026-04-12", "notes": "", "photos": [] }
  }
}
```

## Export (backup)

1. Open **Settings**.
2. Select **Export JSON**.
3. The browser downloads `national-trust-tracker.json` containing all visit data.

Take a backup regularly, and especially before clearing browser data, switching device or browser,
or restoring a file.

## Import (restore)

1. Open **Settings**.
2. Select **Restore JSON** and choose a previously exported file.
3. A confirmation message appears on success; an error message appears if the file is not a valid
   tracker export.

Restore **replaces** the whole dataset — it does not merge with what is already there.

## Clearing data

**Settings → Clear data** removes every visit from this browser after a confirmation prompt. Export
a backup first if the data is still wanted.

## Moving to another device or browser

Export on the old browser, transfer the file yourself (for example via a private file transfer),
and restore on the new browser.

## Privacy

Data never leaves the browser except when a backup file is exported deliberately. Do not record
secrets, precise home location information, or other people's personal data in notes or photo
references; exported files are ordinary unencrypted JSON.
