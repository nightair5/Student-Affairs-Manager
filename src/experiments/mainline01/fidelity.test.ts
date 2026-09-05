import { expect, it } from 'vitest'
import { observeFidelity } from './fidelity'

it('direct domain control preserves supplied critical fields without UI overrides', async () => {
  const observation = await observeFidelity(false)
  expect(observation.checked).toBe(42)
  expect(observation.complete).toBe(true)
})

// Diagnostic reproduction, NOT a passing product acceptance assertion.
it('DIAGNOSTIC: unedited client deadline projections overwrite two raw time strings', async () => {
  const observation = await observeFidelity(true)
  expect(observation.checked).toBe(42)
  expect(observation.equal).toBe(40)
  expect(observation.complete).toBe(false)
  expect(observation.differences.map((row) => row.field)).toEqual(['time.rawText', 'time.rawText'])
})
