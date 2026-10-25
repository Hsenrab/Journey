import { fireEvent, screen } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'

export async function submitActivity(user: ReturnType<typeof userEvent.setup>, label: string) {
  const title = screen.getByLabelText<HTMLInputElement>('Activity title')
  if (!title.value) fireEvent.change(title, { target: { value: 'Recorded activity' } })
  await user.click(screen.getByRole('button', { name: label }))
}

export async function openActivityEvidence(user: ReturnType<typeof userEvent.setup>, section: string) {
  const summary = screen.getByRole('button', { name: new RegExp(`^${section} \\(optional\\)`) })
  if (summary.getAttribute('aria-expanded') === 'false') await user.click(summary)
}
