import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { decodeFactRoleRecording } from './factRoleContract'
import { decodeCurrentFactRoleRecording, workflowMaterialSupportFromSidecar } from './currentFactRoleProduct'
import { indexImmutableScopesV11 } from './scopeIndexV11'
import { assembleCurrentFirstSuggestion, groundMaterialChannels } from './materialChannelGrounding'
import { sourceWindowsFromSidecar } from './sourceWindowGrounding'
import { sourceActionTimesFromSidecar } from './sourceActionTime'
import { validateRecognitionResult } from './schema'
import { rebindRecordedScopes } from './recordedProjectionD26'
import { CanonicalWorkspaceRepository, MemoryWorkspaceRecordStore } from '../domain/v2/repository'
import { CapturePersistenceService } from '../domain/v2/capture'
import { emptyWorkspace } from '../experiments/mainline01/fixtures'

const root = 'docs/recognition-optimization/candidate19-public-development/current-notice-diagnostic/current-mechanism-followup/qualification-association-followup/real-notice-fact-role/'
const sources = JSON.parse(readFileSync(root + 'SOURCES.json', 'utf8')).sources as Array<{ sourceId: string; sourceVersionId: string; sourceText: string; referenceTime: string; timezone: string }>
async function recording(n: number) {
  const s = sources[n - 1], raw = (JSON.parse(readFileSync(root + `observed/raw-${String(n).padStart(2, '0')}.json`, 'utf8')) as { rawHttpText: string }).rawHttpText
  return { s, raw, context: { index: await indexImmutableScopesV11(s.sourceId, s.sourceVersionId, s.sourceText), referenceTime: s.referenceTime, timezone: s.timezone } }
}
function assemble(d: ReturnType<typeof decodeCurrentFactRoleRecording>, s: typeof sources[number]) {
  return assembleCurrentFirstSuggestion(d.result, { sourceText: s.sourceText, referenceTime: s.referenceTime, timezone: s.timezone,
    sourceWindows: sourceWindowsFromSidecar(d.sidecar), sourceActionTimes: sourceActionTimesFromSidecar(d.sidecar),
    workflowMaterialSupport: workflowMaterialSupportFromSidecar(d.sidecar) })
}

describe('current declared support uses the real ordinary pipeline without rewriting frozen results', () => {
  it('RN03 stops losing both real tasks but retains unknown qualification and unadjudicated window facts', async () => {
    const { s, raw, context } = await recording(3)
    expect(() => decodeFactRoleRecording(raw, context, 'SingleAuthority')).toThrow('ROLE_AUTHORITY_PARTICIPATION_EVIDENCE')
    const d = decodeCurrentFactRoleRecording(raw, context, 'SingleAuthority'), first = assemble(d, s)
    expect(validateRecognitionResult(first.result).valid).toBe(true)
    expect(d.sidecar.originalResponse).toBe(raw)
    expect(d.sidecar.currentDeclaredSupport.participation.decisions.map(t => t.addedScopeIds.length)).toEqual([1, 1])
    expect(d.sidecar.taskRequirementsAudit.requirements).toHaveLength(7)
    expect(first.result.standaloneTasks).toHaveLength(2)
    expect(first.result.events).toHaveLength(0)
    expect(first.result.standaloneTasks.every(t => !t.selected)).toBe(true)
    expect(d.sidecar.currentDeclaredSupport.original.tasks.every(t => t.condition.value === 'unknown')).toBe(true)
    expect(first.result.timePoints).toHaveLength(5)
    expect(d.sidecar.currentDeclaredSupport.original.timePoints.map(p => p.rawText)).toEqual(
      (JSON.parse(JSON.parse(raw).output[0].content[0].text) as { timePoints: Array<{ rawText: string }> }).timePoints.map(p => p.rawText))
  })
  it('RN02 retains declared system channels without changing personal state or declared dependencies', async () => {
    const { s, raw, context } = await recording(2)
    const previous = decodeFactRoleRecording(raw, context, 'SingleAuthority')
    const d = decodeCurrentFactRoleRecording(raw, context, 'SingleAuthority'), first = assemble(d, s)
    expect(previous.sidecar.roleAuthorityAudit.localChannels.quarantinedChannels).toHaveLength(4)
    expect(d.sidecar.roleAuthorityAudit.localChannels.quarantinedChannels).toHaveLength(0)
    expect(d.sidecar.currentDeclaredSupport.channels.decisions.filter(p => p.status === 'DERIVED_WORKFLOW_SUPPORT')).toHaveLength(4)
    expect(first.result.materials[0].submissionChannel).toBe('厦门大学学工系统https://xmuxg.xmu.edu.cn/app/515')
    expect(first.materialChannelAudit.decisions[0].status).toBe('EXPLICIT_WORKFLOW_CHANNEL')
    expect(d.result.standaloneTasks.map(t => t.dependencyTempIds)).toEqual(previous.result.standaloneTasks.map(t => t.dependencyTempIds))
    expect(d.sidecar.currentDeclaredSupport.original.tasks.map(t => t.condition)).toEqual(previous.sidecar.factRoleAudit.original.tasks.map(t => t.condition))
    expect(d.sidecar.originalResponse).toBe(raw)
  })
  it.each([1, 4])('unaffected RN0%i first facts remain exactly equal', async n => {
    const { s, raw, context } = await recording(n), old = decodeFactRoleRecording(raw, context, 'SingleAuthority')
    const before = assembleCurrentFirstSuggestion(old.result, { sourceText: s.sourceText, referenceTime: s.referenceTime, timezone: s.timezone,
      sourceWindows: sourceWindowsFromSidecar(old.sidecar), sourceActionTimes: sourceActionTimesFromSidecar(old.sidecar) })
    const after = assemble(decodeCurrentFactRoleRecording(raw, context, 'SingleAuthority'), s)
    expect(after.result).toEqual(before.result)
  })
  it.each(['missing-scope', 'different-mode'])('does not rescue real participation errors: %s', async kind => {
    const { raw, context } = await recording(3), envelope = JSON.parse(raw), facts = JSON.parse(envelope.output[0].content[0].text)
    if (kind === 'missing-scope') facts.tasks[0].participation.scopeIds = ['invented-other-source']
    else facts.tasks[0].participation.mode = 'required'
    envelope.output[0].content[0].text = JSON.stringify(facts)
    expect(() => decodeCurrentFactRoleRecording(JSON.stringify(envelope), context)).toThrow('PARTICIPATION_EVIDENCE')
  })
  it('material proof cannot invent a missing channel, borrow another owner or trust forged provenance', async () => {
    const { s, raw, context } = await recording(2), d = decodeCurrentFactRoleRecording(raw, context)
    const support = workflowMaterialSupportFromSidecar(d.sidecar)
    for (const bad of [{ ...support[0], sourceId: 'foreign-source' }, { ...support[0], ownerTaskIds: ['task-login'] }, { ...support[0], channel: '别的业务系统' }]) {
      const result = groundMaterialChannels(d.result, s.sourceText, [bad])
      expect(result.result.materials[0].submissionChannel).toBeNull()
    }
    const absent = structuredClone(d.result); absent.materials[0].submissionChannel = null
    expect(groundMaterialChannels(absent, s.sourceText, support).result.materials[0].submissionChannel).toBeNull()
    expect(workflowMaterialSupportFromSidecar({ currentDeclaredSupport: { version: 'fake', channels: { materialSupport: support } } })).toEqual([])
  })
  it('never removes an original model conflict that collides with a program channel warning id', async () => {
    const { s, raw, context } = await recording(2), envelope = JSON.parse(raw), facts = JSON.parse(envelope.output[0].content[0].text)
    const dispute = { id: 'material-channel:material-receipt', type: 'other', message: '模型声明的独立关系争议，仍须处理',
      entityTempIds: ['material-receipt', 'task-upload-receipt'], scopeIds: [...facts.materials[0].scopeIds], requiresDecision: true }
    facts.conflicts.push(dispute); envelope.output[0].content[0].text = JSON.stringify(facts)
    const d = decodeCurrentFactRoleRecording(JSON.stringify(envelope), context), first = assemble(d, s)
    expect(first.result.conflicts.some(c => c.id === dispute.id && c.message === dispute.message && c.requiresDecision)).toBe(true)
    expect(d.sidecar.currentDeclaredSupport.materialChannels.removedChannelOnlyConflicts.some(c => c.message === dispute.message)).toBe(false)
    expect(first.result.standaloneTasks.find(t => t.tempId === 'task-upload-receipt')!.selected).toBe(false)
  })
  it('RN03 enters Capture with real source rebinding and saves a draft, not invented formal tasks', async () => {
    const { s, raw, context } = await recording(3)
    const store = new MemoryWorkspaceRecordStore(), repo = new CanonicalWorkspaceRepository(store)
    await repo.initialize(emptyWorkspace())
    const capture = new CapturePersistenceService(repo), h = await capture.beginCapture({ operationId: crypto.randomUUID(), sourceType: 'text', title: s.sourceId,
      rawText: s.sourceText, provider: 'manual', modelName: 'ENGINEERING_FIXED_RECORDING', promptVersion: 'recognition-fact-role-authority-1.0.0', pipelineVersion: 'declared-support-current-product-1.0.0' })
    const target = { ...context, index: await indexImmutableScopesV11(h.sourceId, h.sourceVersionId, s.sourceText) }
    const rebound = rebindRecordedScopes(raw, context.index, target.index)
    const d = decodeCurrentFactRoleRecording(rebound.reboundHttpText, target, 'SingleAuthority')
    await capture.recognize(h, async () => assemble(d, s).result)
    const back = (await new CanonicalWorkspaceRepository(store).load())!
    expect(back.tasks).toHaveLength(0)
    expect(back.projects).toHaveLength(0)
    expect(back.extractionDrafts).toHaveLength(1)
    expect(back.extractionDrafts[0].result!.standaloneTasks).toHaveLength(2)
    expect(JSON.parse(d.sidecar.originalResponse).output).toEqual(JSON.parse(rebound.reboundHttpText).output)
  })
})
