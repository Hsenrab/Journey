# Settings

Route: `/settings` — implemented in `src/pages/Settings.tsx`.

## Purpose

Manage the active data partition (backup, restore, and clear), explain demo mode isolation,
and document the challenge rules and status definitions.

## Supported actions

- Read how the header **Demo data** switch swaps between personal and sample data
- Export the active data partition as a versioned JSON backup (`waypoints.json` or
  `waypoints-demo.json`)
- Restore the active data partition from a previously exported JSON backup
- Clear the active data partition, after confirming a warning dialog
- Read the qualifying-location rules and what each status means

## Data read

- The active Waypoints dataset from `useWaypoints().data`

## Data written

- On restore, the active dataset is replaced via `useWaypoints().restore` and saved to the
  active local-storage partition.
- On clear, the active dataset is reset and its activities, ideas, and photo references are
  emptied.

## Rules and data flow

1. The **Demo data** switch lives in the app header so it is available from every route.
   Turning it on loads the demo local-storage partition; turning it off restores the personal
   partition. The two partitions are stored separately.
2. Export wraps the active dataset in a `{ version, exportedAt, data }` envelope, serialises it as
   formatted JSON and downloads it in the browser; nothing is sent anywhere.
3. Restore parses and validates the selected file with the Zod schemas in `src/services/storage.ts`,
   including the backup version, the visit shape, dates, statuses and known location ids.
4. Invalid files are rejected with an error message and the existing active data is left untouched.
5. A successful restore **replaces** the active dataset — it is not a merge and does not change the
   inactive partition.
6. Clearing data requires confirmation and cannot be undone without a backup. It clears only the
   active partition.

## Future improvements

- Confirmation prompt before replacing data on restore
- Merge option instead of full replace
- Show when the last export was taken

See [../data.md](../data.md) for the data format and backup guidance.
