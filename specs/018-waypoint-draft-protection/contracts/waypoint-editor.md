# Waypoint Editor Interaction Contract

**Feature**: [spec.md](../spec.md) |
**State model**: [data-model.md](../data-model.md)

This is a UI/callback contract. No HTTP endpoint or persisted schema is added.

## Component boundary

The existing [WaypointEditor](../../../src/components/WaypointEditor.tsx)
keeps its props except submission must expose its real async lifetime:

```typescript
onSubmit: (draft: WaypointDraft) => Promise<void>
onCancel?: () => void
```

Both production page callbacks already satisfy this contract. Replace synchronous
test doubles with typed promise-returning mocks; do not add a compatibility union
or boolean success result.

The parent owns persistence, existing messages and successful editor closure.
Fulfillment means only that the callback finished: the parent may have handled
a failed save and intentionally kept the editor open.

## Cancel

| Condition       | Required result                                                |
| --------------- | -------------------------------------------------------------- |
| No `onCancel`   | No Cancel control, unchanged from current behavior.            |
| Save pending    | Cancel visibly disabled; direct/repeated attempts do nothing.  |
| Unchanged draft | Invoke `onCancel` once, with no confirmation.                  |
| Changed draft   | Ask `You have unsaved Waypoint changes. Discard them?`.        |
| Decline         | No `onCancel`, submit, reset, cleared errors or changed tab.   |
| Accept          | Invoke `onCancel` once; parent closes/resets only that editor. |

Use an explicit non-submit Cancel button. Neither decision initiates a request,
submits the form or invokes global navigation confirmation.

The add parent retains existing query/list context while removing add mode.
The edit parent remains on the same saved Waypoint detail. This is not a guarantee
of new discovery-state persistence beyond current parent behavior.

## Submission

1. Keep the existing form-only submission rule and validation.
2. Reject a repeated pending submit synchronously before invoking the callback.
3. After successful validation, capture the draft and take the saving lock before
   calling `onSubmit`.
4. Disable form controls, Save and Cancel. Expose busy state and `Saving...`
   without changing the existing layout/theme.
5. Await the callback and always release the lock on settlement.
6. Do not close or clear the draft merely because the promise fulfilled.
7. Preserve handled-failure messages and the retained draft.
8. Forward an escaped rejection unchanged to the root error element through the
   existing render-time fatal-error pattern, without fabricated success.

The pending interval does not change `useJourneyDraft`, unload handling or
router/navigation rules.

## Accessibility and viewports

- Cancel is keyboard reachable and activates without submitting.
- Native confirmation identifies unsaved Waypoint changes and asks about discard.
  Button labels, placement and appearance are browser/OS-controlled.
- Dismissal returns focus to the editing interaction; the retained form/JSON tab
  remains usable.
- Pending disabled controls cannot be activated by pointer or keyboard.
- At 360 by 800 and 1280 by 800, actions/errors are reachable without horizontal
  overflow or overlapping content.
- No custom dialog, focus trap or browser-confirmation imitation is introduced.

## Read-only and failures

Viewers in both remote datasets, Demo local and blocked-write states retain current
notices/browsing controls, without mutation access.

An invalid/failed save does not silently reset the editor. Known failures retain
existing parent handling; escaped errors retain their exact value/message.
No retry, fallback, offline draft or recovery after deliberate discard is added.
