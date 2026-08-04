# Data, import, export, backup and restore

## Where data lives

All visit data is stored in the browser's local storage under the key
`national-trust-tracker-v1`. There is no server, database or account: the data belongs to the
browser profile on the device where it was entered.

Reference data about the locations themselves is compiled into the app from
`src/data/locations.ts` and is never stored in the browser.

## Format

The stored value (and the exported file) is a JSON object keyed by location id:

```json
{
  "dunham-massey": {
    "status": "silver",
    "date": "2026-04-12",
    "notes": "House and garden done, deer park next time.",
    "photos": ["https://example.com/photo.jpg", "IMG_1234.jpg"]
  }
}
```

| Field    | Type                                            | Notes                                        |
| -------- | ----------------------------------------------- | -------------------------------------------- |
| key      | string                                          | Location id from `src/data/locations.ts`     |
| `status` | `not-started` \| `bronze` \| `silver` \| `gold` | Stored records are normally bronze or better |
| `date`   | string                                          | Visit date in `YYYY-MM-DD` form              |
| `notes`  | string                                          | Free text; may be empty                      |
| `photos` | string[]                                        | URLs or filenames; no images are stored      |

## Validation

`src/services/storage.ts` validates data with Zod on every load and on import:

- Unreadable or invalid stored data falls back to an empty dataset rather than crashing the app.
- An invalid import file is rejected and the existing data is left unchanged.
- Ids that are not in the location list are kept but simply ignored by the pages, so data survives
  a rename or a future addition to the location list.

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

## Moving to another device or browser

Export on the old browser, transfer the file yourself (for example via a private file transfer),
and restore on the new browser.

## Privacy

Data never leaves the browser except when a backup file is exported deliberately. Do not record
secrets, precise home location information, or other people's personal data in notes or photo
references; exported files are ordinary unencrypted JSON.
