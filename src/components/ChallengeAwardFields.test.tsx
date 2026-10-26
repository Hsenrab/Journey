import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { ChallengeAwardFields, ChallengeAwardDefinitions, emptyAwardDescriptions } from './ChallengeAwardFields'
import { createAwardTestData } from '../test/demoData'

describe('Challenge award fields', () => {
  it('defaults disabled and exposes three individually labelled required explanations when enabled', async () => {
    function Form() {
      const [enabled, setEnabled] = useState(false)
      const [descriptions, setDescriptions] = useState(emptyAwardDescriptions)
      return (
        <ChallengeAwardFields
          enabled={enabled}
          descriptions={descriptions}
          onEnabledChange={setEnabled}
          onDescriptionsChange={setDescriptions}
          showErrors
        />
      )
    }
    render(<Form />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox'))
    for (const tier of ['Bronze', 'Silver', 'Gold']) {
      const field = screen.getByRole('textbox', { name: `${tier} explanation` })
      expect(field).toBeRequired()
      expect(field).toHaveValue('')
      expect(field).toHaveAccessibleDescription(`${tier} explanation is required.`)
    }
  })
  it('exposes every named explanation set for shared membership', () => {
    render(<ChallengeAwardDefinitions challenges={createAwardTestData().challenges.slice(0, 2)} />)
    expect(screen.getByText('Award Challenge A award explanations')).toBeInTheDocument()
    expect(screen.getByText('Award Challenge B award explanations')).toBeInTheDocument()
    expect(screen.getByText('Gold: Overnight exploration')).toBeInTheDocument()
  })
})
