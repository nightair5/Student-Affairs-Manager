import { expect, it } from 'vitest'
import { buildCandidate05Request, buildFlash41ComparisonRequest, CANDIDATE05_VERSION } from './candidate05'
import { buildCandidate03Request } from './candidate03'
import { FACT_WIRE_VERSION } from './factAssembly'
import { seenWire } from './seenInputs'

it('uses explicit new model, original text and frozen vocabulary, never selected or duplicate task inverses', async () => {
  const { original } = await seenWire('multi', { sourceId: 'c05', sourceVersionId: 'c05:v1' })
  const current = await buildCandidate05Request(original.context), old = await buildCandidate03Request(original.context)
  expect(current.body.model).toBe('deepseek-flash')
  expect(current.body.input[1]).toEqual(old.body.input[1])
  expect(current.body).toMatchObject({ temperature: 0, reasoning: { effort: 'none' }, stream: false, max_output_tokens: 8192 })
  expect(current.body.input[0].content[0].text).toContain(CANDIDATE05_VERSION)
  const schema = current.body.text.format.schema
  expect(schema.properties!.schemaVersion.const).toBe(FACT_WIRE_VERSION)
  expect(schema.properties!.tasks.items!.properties!.detail.properties).not.toHaveProperty('timePointTempIds')
  expect(schema.properties!.tasks.items!.properties).not.toHaveProperty('eventTempIds')
  expect(JSON.stringify(schema)).not.toContain('selected')
  expect(JSON.parse(current.serialized)).toEqual(current.body)
  expect(old.body.model).toBe('deepseek-v4-flash-vision-exp')
  const control = await buildFlash41ComparisonRequest(original.context, '03')
  expect(control.body).toEqual({ ...old.body, model: 'deepseek-flash' })
  expect(JSON.parse(control.serialized)).toEqual(control.body)
})
