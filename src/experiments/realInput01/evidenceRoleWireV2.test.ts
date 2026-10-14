import { describe, expect, it } from 'vitest'
import { indexImmutableScopesV11 } from '../../recognition/scopeIndexV11'
import { assembleEvidenceRoleWireV2, EVIDENCE_ROLE_V2_VERSION, parseEvidenceRoleEnvelopeV2, type EvidenceRoleWireV2 } from './evidenceRoleWireV2'
import { FLASH41_MODEL_NAME, type WireContext } from './modelWire'

async function fixture(text: string) {
  const context: WireContext = { index: await indexImmutableScopesV11('typed-fact-engineering', 'typed-fact-engineering:1', text),
    referenceTime: '2026-09-13T09:00:00+08:00', timezone: 'Asia/Shanghai' }
  const scope = (surface: string) => {
    const item = context.index.scopes.find(candidate => candidate.text.includes(surface))
    if (!item) throw Error('TEST_SCOPE_MISSING')
    return item.id
  }
  const task = (id: string, action: string, object: string): EvidenceRoleWireV2['tasks'][number] => ({
    factType: 'task', id, propositionScopeIds: [...new Set([scope(action), scope(object)])],
    action: { scopeId: scope(action), surface: action }, object: { scopeId: scope(object), surface: object },
    inferenceLevel: 'explicit', actionType: 'other', effect: 'physical_action',
    semantics: { actor: 'addressee', speechAct: 'directive', polarity: 'affirmative', tense: 'future', status: 'pending', validity: 'active', modality: 'required' },
    detail: { parentTempId: null, hierarchyType: 'task', title: action + object, description: '', completionCriteria: [], estimatedMinutes: null,
      statusSuggestion: 'todo', prioritySuggestion: 'medium', dependencyTempIds: [], confidence: 1, userConfirmationRequired: true },
    condition: { value: 'not_applicable', conditionScopeIds: [], factScopeIds: [] }, coverage: { time: 'not_stated', material: 'not_stated', event: 'not_stated' },
  })
  const wire: EvidenceRoleWireV2 = { schemaVersion: EVIDENCE_ROLE_V2_VERSION, tasks: [], materials: [], timePoints: [], events: [], revisions: [], conflicts: [], informationScopeIds: [], unresolvedScopeIds: [] }
  // Engineering fixture explicitly identifies any otherwise-unused fragments; production never does this.
  const assemble = () => assembleEvidenceRoleWireV2(wire, context)
  return { context, scope, task, wire, assemble }
}

describe('typed fact wire v2 engineering responses (not model accuracy)', () => {
  it('keeps material specifications and one shared ownership list without adding tasks or changing raw input', async () => {
    const f = await fixture('请登记展位并领取储物柜，两项均需出示工作证。')
    f.wire.tasks.push(f.task('register', '登记', '展位'), f.task('collect', '领取', '储物柜'))
    f.wire.tasks.forEach(item => { item.coverage.material = 'present' })
    f.wire.materials.push({ factType: 'material', tempId: 'credential', name: '工作证', required: true, quantity: 1,
      formatRequirements: ['原件'], namingRequirements: [], submissionChannel: null, relatedTaskTempIds: ['register', 'collect'], scopeIds: [f.scope('工作证')], confidence: 1 })
    const original = structuredClone(f.wire), result = f.assemble()
    expect(f.wire).toEqual(original)
    expect(result.rawEvidence).toEqual(original)
    expect(result.assembledWire.tasks.map(item => item.detail.materialTempIds)).toEqual([['credential'], ['credential']])
    expect(result.assembledWire.materials[0]).toMatchObject({ required: true, quantity: 1, formatRequirements: ['原件'], relatedTaskTempIds: ['register', 'collect'] })
    expect(result.assembledWire.materials[0]).not.toHaveProperty('preparationStatus')
  })
  it('retains an explicit preparation action and a genuinely absent date', async () => {
    const f = await fixture('请准备备用封条。')
    f.wire.tasks.push(f.task('prepare', '准备', '备用封条'))
    expect(f.assemble().assembledWire).toMatchObject({ tasks: [{ id: 'prepare', coverage: { time: 'not_stated' } }], materials: [], timePoints: [] })
  })
  it('preserves missing material as not_extracted, never manufactures a fact from emptiness', async () => {
    const f = await fixture('请提交记录，另需附件，附件名称待通知。')
    f.wire.tasks.push(f.task('submit', '提交', '记录')); f.wire.tasks[0].coverage.material = 'not_extracted'
    f.wire.unresolvedScopeIds = f.context.index.scopes.filter(item => !f.wire.tasks[0].propositionScopeIds.includes(item.id)).map(item => item.id)
    expect(f.assemble().assembledWire).toMatchObject({ materials: [], tasks: [{ coverage: { material: 'not_extracted' } }] })
    f.wire.tasks[0].coverage.material = 'present'
    expect(f.assemble).toThrow('TYPED_COVERAGE_MATERIAL')
  })
  it.each(['近期', '2026年9月20日18:00前'])('retains supported time: %s', async rawText => {
    const f = await fixture(`请${rawText}提交总结。`)
    f.wire.tasks.push(f.task('submit', '提交', '总结')); f.wire.tasks[0].coverage.time = 'present'
    f.wire.timePoints.push({ factType: 'time', tempId: 'deadline', type: 'task_deadline', rawText, relatedTaskTempIds: ['submit'], relatedMaterialTempIds: [], scopeIds: [f.scope(rawText)], confidence: 1 })
    const result = f.assemble()
    expect(result.assembledWire.timePoints[0].rawText).toBe(rawText)
    expect(result.assembledWire.tasks[0].detail.timePointTempIds).toEqual(['deadline'])
    if (rawText === '近期') expect(result.adaptedResponse.timePoints[0]).toMatchObject({ normalizedValue: null, needsConfirmation: true })
  })
  it('retains unknown condition and does not derive cancellation', async () => {
    const f = await fixture('核验完成后请领取配件，核验结果未知。')
    f.wire.tasks.push(f.task('collect', '领取', '配件'))
    f.wire.tasks[0].condition = { value: 'unknown', conditionScopeIds: [f.scope('核验完成后')], factScopeIds: [f.scope('结果未知')] }
    expect(f.assemble().assembledWire).toMatchObject({ tasks: [{ condition: { value: 'unknown' } }], revisions: [] })
  })
  it('keeps missing cancellation target unresolved and rejects a fabricated reference', async () => {
    const f = await fixture('此前要求已经取消，但旧要求内容未提供。')
    f.wire.unresolvedScopeIds = f.context.index.scopes.map(item => item.id)
    expect(f.assemble().assembledWire).toMatchObject({ tasks: [], revisions: [] })
    f.wire.revisions.push({ factType: 'revision', type: 'cancels', targetDirectiveId: 'missing', fromDirectiveId: null, effective: 'true', scopeIds: [f.scope('已经取消')] })
    expect(f.assemble).toThrow('TYPED_REVISION_TARGET')
  })
  it.each(['parent', 'dependency', 'owner', 'kind', 'extra', 'source'])('rejects invalid %s without changing the input', async mutation => {
    const f = await fixture('请提交记录，需要附件。')
    f.wire.tasks.push(f.task('submit', '提交', '记录')); f.wire.tasks[0].coverage.material = 'present'
    f.wire.materials.push({ factType: 'material', tempId: 'attachment', name: '附件', required: true, quantity: null, formatRequirements: [], namingRequirements: [], submissionChannel: null, relatedTaskTempIds: ['submit'], scopeIds: [f.scope('附件')], confidence: 1 })
    expect(f.assemble().assembledWire.tasks).toHaveLength(1)
    if (mutation === 'parent') f.wire.tasks[0].detail.parentTempId = 'missing'
    if (mutation === 'dependency') f.wire.tasks[0].detail.dependencyTempIds = ['missing']
    if (mutation === 'owner') f.wire.materials[0].relatedTaskTempIds = ['missing']
    if (mutation === 'kind') Object.assign(f.wire.materials[0], { factType: 'task' })
    if (mutation === 'extra') Object.assign(f.wire.tasks[0].detail, { materialTempIds: ['attachment'] })
    if (mutation === 'source') f.wire.materials[0].scopeIds = ['missing']
    const before = structuredClone(f.wire)
    expect(f.assemble).toThrow(); expect(f.wire).toEqual(before)
  })
  it('preserves raw envelope separately and rejects identity or usage anomalies', async () => {
    const f = await fixture('请提交记录。'); f.wire.tasks.push(f.task('submit', '提交', '记录'))
    const envelope = { model: FLASH41_MODEL_NAME, status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(f.wire) }] }], usage: { input_tokens: 10, output_tokens: 100 } }
    const text = JSON.stringify(envelope), parsed = parseEvidenceRoleEnvelopeV2(text, f.context)
    expect(parsed.rawHttpText).toBe(text); expect(parsed.rawResponse).toEqual(f.wire)
    expect(() => parseEvidenceRoleEnvelopeV2(JSON.stringify({ ...envelope, model: 'different' }), f.context)).toThrow('MODEL_IDENTITY')
    expect(() => parseEvidenceRoleEnvelopeV2(JSON.stringify({ ...envelope, usage: { input_tokens: 0, output_tokens: 8193 } }), f.context)).toThrow('USAGE_INVALID')
  })
})
