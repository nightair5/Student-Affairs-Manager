import { describe, it, expect } from 'vitest'
import { assembleFacts, FACT_WIRE_VERSION, type FactWire } from './factAssembly'
import { adaptModelWire, type ModelWire } from './modelWire'
import { cases, seenWire } from './seenInputs'

function projection(wire: ModelWire): FactWire {
  const copy = structuredClone(wire)
  for (const t of copy.tasks) {
    Reflect.deleteProperty(t, 'eventTempIds')
    Reflect.deleteProperty(t.detail, 'timePointTempIds'); Reflect.deleteProperty(t.detail, 'materialTempIds')
    for (const key of ['time', 'material', 'event'] as const) if (t.coverage[key] === 'present') Reflect.set(t.coverage, key, null)
  }
  return { ...copy, schemaVersion: FACT_WIRE_VERSION } as unknown as FactWire
}
const handle = { sourceId: 'fact-assembly', sourceVersionId: 'fact-assembly:v1' }
describe('candidate05 deterministic assembly', () => {
  it.each(cases)('preserves all %s existing engineering facts without a model call', async name => {
    const { wire, original } = await seenWire(name, handle)
    const raw = projection(wire), before = structuredClone(raw), result = assembleFacts(raw)
    expect(result.rawFacts).toEqual(before); expect(raw).toEqual(before)
    expect(adaptModelWire(result.assembledWire, original.context).adapted).toEqual(original.rawResponse)
  })
  it('never derives absence from empty arrays or deletes a stated missing fact', async () => {
    const { wire } = await seenWire('no-date', handle), raw = projection(wire)
    raw.tasks[0].coverage.time = null
    expect(() => assembleFacts(raw)).toThrow('COVERAGE_MISSING_FACT')
    raw.tasks[0].coverage.time = 'not_extracted'
    expect(assembleFacts(raw).assembledWire.tasks[0].coverage.time).toBe('not_extracted')
    expect(assembleFacts(raw).assembledWire.timePoints).toEqual([])
  })
  it('rejects false absence, dangling references, duplicate IDs, injected inverses and authority', async () => {
    const { wire } = await seenWire('multi', handle), raw = projection(wire)
    const absence = structuredClone(raw); absence.tasks[0].coverage.time = 'not_stated'
    expect(() => assembleFacts(absence)).toThrow('COVERAGE_CONTRADICTION')
    const dangling = structuredClone(raw); dangling.timePoints[0].relatedTaskTempIds = ['not_a_task']
    expect(() => assembleFacts(dangling)).toThrow('REFERENCE')
    const duplicate = structuredClone(raw); duplicate.tasks.push(duplicate.tasks[0])
    expect(() => assembleFacts(duplicate)).toThrow('ENTITY_ID')
    expect(() => assembleFacts({ ...raw, selected: true })).toThrow('SHAPE')
    const inverse = structuredClone(raw); Object.assign(inverse.tasks[0].detail, { materialTempIds: [] })
    expect(() => assembleFacts(inverse)).toThrow('SHAPE')
    const sparse = structuredClone(raw); sparse.tasks.length += 1
    expect(() => assembleFacts(sparse)).toThrow('NON_JSON_SPARSE')
    expect(assembleFacts(raw).assembledWire.tasks).toHaveLength(2)
  })
  it('does not invent time-material edges or prepared state, preserves independent owners under reordering', async () => {
    const { wire } = await seenWire('multi', handle), raw = projection(wire)
    for (const p of raw.timePoints) p.relatedMaterialTempIds = []
    const first = assembleFacts(raw).assembledWire
    raw.tasks.reverse(); raw.materials.reverse(); raw.timePoints.reverse()
    const second = assembleFacts(raw).assembledWire
    for (const t of first.tasks) {
      const other = second.tasks.find(x => x.id === t.id)!
      expect([...other.detail.materialTempIds].sort()).toEqual([...t.detail.materialTempIds].sort())
      expect([...other.detail.timePointTempIds].sort()).toEqual([...t.detail.timePointTempIds].sort())
    }
    expect(second.timePoints.every(t => t.relatedMaterialTempIds.length === 0)).toBe(true)
    expect(second.materials).toEqual(raw.materials)
    expect(second.materials.every(m => !('status' in m))).toBe(true)
  })
})
