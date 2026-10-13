import { describe, expect, it } from 'vitest'
import { ordinaryWorkflowFixture, ordinaryWorkflowText } from './ordinaryProviderSupport.fixture'
import { bindOrdinaryProviderSupport, ordinaryWorkflowMaterialSupportFromSidecar } from './ordinaryProviderSupport'
import { assembleCurrentFirstSuggestion } from './materialChannelGrounding'
import { sourceReviewProblem } from '../domain/v2/sourceReviewD26'

const input = { sourceId: 'captured-source', sourceVersionId: 'captured-source:version:1', sourceText: ordinaryWorkflowText,
  referenceTime: '2026-10-13T02:00:00Z', timezone: 'Asia/Shanghai' }

describe('ordinary proxy declaration support shares role verification without inventing wire fields', () => {
  it('retains existing channel on first screen while preserving proxy input and raw body', () => {
    const original = ordinaryWorkflowFixture(), raw = JSON.stringify({ result: original }), originalCopy = structuredClone(original)
    const before = assembleCurrentFirstSuggestion(original, input)
    expect(before.result.materials[0].submissionChannel).toBeNull()
    const bound = bindOrdinaryProviderSupport(original, input, raw)
    const support = ordinaryWorkflowMaterialSupportFromSidecar(bound.sidecar)
    const after = assembleCurrentFirstSuggestion(bound.result, { ...input, workflowMaterialSupport: support })
    expect(after.result.materials[0].submissionChannel).toBe('甲业务系统')
    expect(after.materialChannelAudit.decisions[0].status).toBe('EXPLICIT_WORKFLOW_CHANNEL')
    expect(after.result.standaloneTasks[0].actionObject).toBe('本学年回执')
    expect(original).toEqual(originalCopy)
    expect(bound.sidecar.ordinaryProviderSupport.originalProxyResponse).toBe(raw)
    expect(bound.sidecar.ordinaryProviderSupport.originalProxyRecognitionResult).toEqual(original)
    expect(support[0]).toMatchObject({ citationKind: 'RECOGNITION_RESULT_EVIDENCE', channelScopeIds: [], taskScopeIds: [], sourceId: input.sourceId })
    expect(bound.sidecar.ordinaryProviderSupport.unsupportedContractFields).toContain('personalCondition')
  })
  it.each([
    ['conditional', '如果登录甲业务系统，选择本学期业务，上传本学年回执。'],
    ['different destination', '登录甲业务系统，选择本学期业务，上传本学年回执至乙业务系统。'],
    ['negated current action', '登录甲业务系统，选择本学期业务，不要上传本学年回执。'],
    ['separate instruction', '登录甲业务系统，选择本学期业务。上传本学年回执。'],
  ])('does not force an unsupported channel definite: %s', (_label, sourceText) => {
    const original = ordinaryWorkflowFixture(sourceText)
    const bound = bindOrdinaryProviderSupport(original, { ...input, sourceText }, JSON.stringify({ result: original }))
    expect(bound.sidecar.ordinaryProviderSupport.workflowMaterialSupport).toEqual([])
    const first = assembleCurrentFirstSuggestion(bound.result, { ...input, sourceText, workflowMaterialSupport: [] })
    expect(first.result.materials[0].submissionChannel).toBeNull()
  })
  it.each(['missing-value', 'wrong-owner', 'multi-owner', 'missing-evidence', 'wrong-object'])('keeps actual missing or bad declaration unrescued: %s', kind => {
    const original = ordinaryWorkflowFixture()
    if (kind === 'missing-value') original.materials[0].submissionChannel = null
    if (kind === 'wrong-owner') original.materials[0].relatedTaskTempIds = ['not-upload']
    if (kind === 'multi-owner') original.materials[0].relatedTaskTempIds.push('another-owner')
    if (kind === 'missing-evidence') original.standaloneTasks[0].evidenceIds = []
    if (kind === 'wrong-object') original.standaloneTasks[0].actionObject = '缴费凭证'
    const bound = bindOrdinaryProviderSupport(original, input, JSON.stringify({ result: original }))
    expect(bound.sidecar.ordinaryProviderSupport.workflowMaterialSupport).toEqual([])
    expect(bound.result.standaloneTasks).toEqual(original.standaloneTasks)
    expect(bound.result.materials).toEqual(original.materials)
  })
  it('rejects a real foreign source instead of treating it as the server placeholder', () => {
    const original = ordinaryWorkflowFixture(); original.evidence[0].sourceId = 'other-notice'
    expect(() => bindOrdinaryProviderSupport(original, input, '')).toThrow('ORDINARY_PROVIDER_FOREIGN_SOURCE')
  })
  it('does not turn an unsent remainder quote into model-provided support', () => {
    const original = ordinaryWorkflowFixture()
    const bound = bindOrdinaryProviderSupport(original, { ...input, processedSourceText: '请登录甲业务系统，' }, '')
    expect(bound.sidecar.ordinaryProviderSupport.processedCharacterCount).toBe('请登录甲业务系统，'.length)
    expect(bound.sidecar.ordinaryProviderSupport.workflowMaterialSupport).toEqual([])
  })
  it('retains an unfamiliar literal destination by its workflow role rather than a channel name allowlist', () => {
    const sourceText = ordinaryWorkflowText.replace('甲业务系统', '昼溪办事入口')
    const original = ordinaryWorkflowFixture(sourceText)
    original.materials[0].submissionChannel = '昼溪办事入口'
    original.evidence[0].quote = '登录昼溪办事入口，'
    const bound = bindOrdinaryProviderSupport(original, { ...input, sourceText }, '')
    const first = assembleCurrentFirstSuggestion(bound.result, { ...input, sourceText, workflowMaterialSupport: ordinaryWorkflowMaterialSupportFromSidecar(bound.sidecar) })
    expect(first.result.materials[0].submissionChannel).toBe('昼溪办事入口')
    expect(first.materialChannelAudit.decisions[0].status).toBe('EXPLICIT_WORKFLOW_CHANNEL')
  })
  it('preserves a model conflict even when the material channel has a proven workflow', () => {
    const original = ordinaryWorkflowFixture()
    const modelConflict = { id: 'material-channel:material-receipt', type: 'other' as const, message: '原模型声明该关系仍有争议',
      entityTempIds: ['material-receipt', 'task-upload'], evidenceIds: ['e-action'], requiresDecision: true }
    original.conflicts.push(modelConflict)
    const bound = bindOrdinaryProviderSupport(original, input, '')
    const first = assembleCurrentFirstSuggestion(bound.result, { ...input, workflowMaterialSupport: ordinaryWorkflowMaterialSupportFromSidecar(bound.sidecar) })
    expect(first.result.materials[0].submissionChannel).toBe('甲业务系统')
    expect(first.result.conflicts).toContainEqual(modelConflict)
    expect(sourceReviewProblem(first.result, 'task-upload')).toBe(modelConflict.message)
  })
  it('rejects a forged version or owner proof through the independent ordinary material grounder', () => {
    const bound = bindOrdinaryProviderSupport(ordinaryWorkflowFixture(), input, '')
    expect(ordinaryWorkflowMaterialSupportFromSidecar({ ordinaryProviderSupport: { version: 'unrecognized', workflowMaterialSupport: bound.sidecar.ordinaryProviderSupport.workflowMaterialSupport } })).toEqual([])
    const support = ordinaryWorkflowMaterialSupportFromSidecar(bound.sidecar).map(p => ({ ...p, ownerTaskIds: ['another-owner'] }))
    const first = assembleCurrentFirstSuggestion(bound.result, { ...input, workflowMaterialSupport: support })
    expect(first.result.materials[0].submissionChannel).toBeNull()
  })
})
