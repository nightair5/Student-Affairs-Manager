import { describe, expect, it } from 'vitest'
import { buildModelRequest, adaptModelWire, parseModelEnvelope, projectSemantic, MODEL_JSON_SCHEMA, MODEL_NAME } from './modelWire'
import { cases, seenWire } from './seenInputs'
import { composeSemantics } from '../mainline04/semanticComposer'
import { stableJson } from '../mainline04/semanticContract'
import { scoreSeenResponse, countMultiset } from './evaluation'

const handle = { sourceId: 'source-wire', sourceVersionId: 'source-wire:version:1' }
describe('real input wire projection (zero model calls)', () => {
  it.each(cases)('seen diagnostic scorer %s retains complete normal controls including legitimate unknown',async name=>{
    const {original,rawHttpText}=await seenWire(name,handle)
    const score=await scoreSeenResponse(rawHttpText,original.context,original.rawResponse,original.context)
    expect(score.completeCase).toBe(true);expect(score.forbidden).toBe(0)
    expect(score.automaticSelection).toBe('NOT_ENABLED')
  })
  it('scorer counts omissions and unselected extras; duplicates do not earn extra correct facts',async()=>{
    expect(countMultiset(['a','a'],['a'])).toMatchObject({correct:1,falsePositive:1,falseNegative:0})
    expect(countMultiset([],['a'])).toMatchObject({correct:0,falseNegative:1,precision:null,recall:0})
    const {original,rawHttpText}=await seenWire('multi',handle),envelope=JSON.parse(rawHttpText)
    const wire=JSON.parse(envelope.output[0].content[0].text)
    wire.tasks=[];envelope.output[0].content[0].text=JSON.stringify(wire)
    const score=await scoreSeenResponse(JSON.stringify(envelope),original.context,original.rawResponse,original.context)
    expect(score.completeCase).toBe(false);expect(score.metrics.task.falseNegative).toBe(2)
    expect(score.majorCorrectionRequired).toBe(true)
  })
  it.each(['title','description','completionCriteria'] as const)('scorer rejects an unsupported displayed task %s while retaining the original control',async field=>{
    const {original,rawHttpText}=await seenWire('no-date',handle)
    expect((await scoreSeenResponse(rawHttpText,original.context,original.rawResponse,original.context)).completeCase).toBe(true)
    const envelope=JSON.parse(rawHttpText),wire=JSON.parse(envelope.output[0].content[0].text)
    wire.tasks[0].detail[field]=field==='completionCriteria'?['原文未要求的额外完成条件']:
      field==='title'?'禁止保存活动手册':'原文未要求的额外说明'
    envelope.output[0].content[0].text=JSON.stringify(wire)
    const score=await scoreSeenResponse(JSON.stringify(envelope),original.context,original.rawResponse,original.context)
    expect(score.completeCase).toBe(false)
    expect(score.majorCorrectionRequired).toBe(true)
    expect(score.metrics.semantic.falsePositive).toBeGreaterThan(0)
  })
  it('does not award exact scores for ambiguous same-name task ownership matching',async()=>{
    const {original,rawHttpText}=await seenWire('multi',handle),reference=structuredClone(original.rawResponse)
    reference.materials=[]
    for(const task of reference.tasks){task.detail.materialTempIds=[];task.coverage.material='not_stated'}
    for(const time of reference.timePoints)time.relatedMaterialTempIds=[]
    reference.tasks[1].action=structuredClone(reference.tasks[0].action)
    reference.tasks[1].object=structuredClone(reference.tasks[0].object)
    reference.tasks[1].semantics.status='completed';reference.tasks[1].semantics.tense='past'
    const wire=projectSemantic(reference),envelope=JSON.parse(rawHttpText)
    const score=()=>{envelope.output[0].content[0].text=JSON.stringify(wire);return scoreSeenResponse(JSON.stringify(envelope),original.context,reference,original.context)}
    // Ambiguous matching is disclosed even in an unchanged control; it is not a product refusal.
    expect((await score()).completeCase).toBe(false)
    ;[wire.tasks[0].detail.timePointTempIds,wire.tasks[1].detail.timePointTempIds]=
      [wire.tasks[1].detail.timePointTempIds,wire.tasks[0].detail.timePointTempIds]
    for(const time of wire.timePoints)time.relatedTaskTempIds=time.relatedTaskTempIds.map(id=>id===wire.tasks[0].id?wire.tasks[1].id:wire.tasks[0].id)
    const changed=await score()
    expect(changed.completeCase).toBe(false)
    expect(changed).toHaveProperty('metricStatus','MATCHING_REQUIRES_REVIEW')
  })
  it.each(cases)('%s preserves every source fact/relation with local time construction', async name => {
    const { original, wire } = await seenWire(name, handle)
    const { adapted } = adaptModelWire(wire, original.context)
    expect(adapted).toEqual(original.rawResponse)
    expect(wire).not.toHaveProperty('sourceId')
    expect(wire.timePoints.every(t => !('normalizedValue' in t))).toBe(true)
    expect((await composeSemantics(adapted, original.context)).original).toEqual(original.rawResponse)
  })
  it('keeps raw provider text, parsed output, and locally adapted structure separate', async () => {
    const { rawHttpText, original, wire } = await seenWire('multi', handle)
    const parsed = parseModelEnvelope(rawHttpText, original.context)
    expect(parsed.rawHttpText).toBe(rawHttpText)
    expect(JSON.parse(parsed.rawOutputText)).toEqual(wire)
    expect(parsed.adaptedResponse.sourceId).toBe(handle.sourceId)
    expect(parsed.rawResponse).not.toHaveProperty('sourceId')
  })
  it('accepts object-key reordering but never sparse arrays or added authority', async () => {
    const { wire, original } = await seenWire('no-date', handle)
    const reordered = Object.fromEntries(Object.entries(wire).reverse())
    expect(adaptModelWire(reordered, original.context).adapted).toEqual(original.rawResponse)
    expect(() => adaptModelWire({ ...wire, selected: true }, original.context)).toThrow('WIRE_FIELDS')
    expect(() => adaptModelWire({ ...wire, sourceId: 'spoof' }, original.context)).toThrow('WIRE_FIELDS')
    const sparse = structuredClone(wire); sparse.tasks.length = 2
    expect(() => adaptModelWire(sparse, original.context)).toThrow('NON_JSON_SPARSE')
    const taskSelected = structuredClone(wire)
    Object.assign(taskSelected.tasks[0], { selected: true })
    expect(() => adaptModelWire(taskSelected, original.context)).toThrow('SEMANTIC_SHAPE_INVALID')
  })
  it('rejects model-supplied normalized time, stable IDs, tool output and incomplete replies', async () => {
    const { wire, original, rawHttpText } = await seenWire('multi', handle)
    const normalized = structuredClone(wire); Object.assign(normalized.timePoints[0], { normalizedValue: '2026-09-10' })
    expect(() => adaptModelWire(normalized, original.context)).toThrow('WIRE_FIELDS')
    const wrongId = structuredClone(wire); wrongId.tasks[0].id = 'mainline05:task:spoof'
    expect(() => adaptModelWire(wrongId, original.context)).toThrow('LOCAL_ENTITY_ID')
    const envelope = JSON.parse(rawHttpText)
    expect(() => parseModelEnvelope(JSON.stringify({ ...envelope, model: 'other' }), original.context)).toThrow('MODEL_IDENTITY')
    expect(() => parseModelEnvelope(JSON.stringify({ ...envelope, status: 'incomplete' }), original.context)).toThrow('RESPONSE_INCOMPLETE')
    expect(() => parseModelEnvelope(JSON.stringify({ ...envelope, output: [{ type: 'function_call' }] }), original.context)).toThrow('RESPONSE_OUTPUT_KIND')
    expect(() => parseModelEnvelope(JSON.stringify({ ...envelope, usage: null }), original.context)).toThrow()
  })
  it('builds a bounded text-only request using inline existing vocabulary, not expected answers', async () => {
    const { original } = await seenWire('multi', handle)
    const { body, serialized } = await buildModelRequest(original.context)
    expect(body.model).toBe(MODEL_NAME); expect(body.reasoning.effort).toBe('none')
    expect(body.max_output_tokens).toBe(8192); expect(body.temperature).toBe(0)
    expect(body).not.toHaveProperty('tools'); expect(serialized).not.toContain('input_image')
    expect(new TextEncoder().encode(serialized).length).toBeLessThanOrEqual(65536)
    expect(serialized).not.toContain('rawResponse'); expect(serialized).not.toContain('human_engineering')
    expect(stableJson(MODEL_JSON_SCHEMA)).not.toContain('$ref')
    const tampered = structuredClone(original.context); tampered.index.sourceContent += '被替换'
    await expect(buildModelRequest(tampered)).rejects.toThrow('SOURCE_INDEX_MISMATCH')
  })
  it('binds the clock and source context before asynchronous verification starts', async () => {
    const { original } = await seenWire('no-date', handle)
    const context = structuredClone(original.context)
    const pending = buildModelRequest(context)
    context.referenceTime = 'invalid-time'; context.timezone = 'invalid-zone'
    const result = await pending
    const sent = JSON.parse(result.body.input[1].content[0].text)
    expect(sent.referenceTime).toBe(original.context.referenceTime)
    expect(sent.timezone).toBe(original.context.timezone)
    expect(sent.source).toBe(original.context.index.sourceContent)
  })
})
