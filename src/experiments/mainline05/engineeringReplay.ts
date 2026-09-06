import type { CaptureHandle } from '../../domain/v2/capture'
import type { RecognitionResult } from '../../recognition/types'
import { indexImmutableScopesV11 } from '../../recognition/scopeIndexV11'
import { artificialResponse, cases, notices, NOW, type CaseName } from '../mainline01/fixtures'
import { SEMANTIC_VERSION, plainJson, type SemanticInput, type SemanticTask } from '../mainline04/semanticContract'
import type { ComposeContext } from '../mainline04/semanticComposer'

// Seen, explicitly human transcriptions from MAINLINE04 acceptance, not a classifier.
// This module is imported ONLY by tests/the isolated browser entry, never normal App.
export async function engineeringReply(name: CaseName, handle: Pick<CaptureHandle, 'sourceId' | 'sourceVersionId'>,
  transform?: (input: SemanticInput) => void) {
  const index = await indexImmutableScopesV11(handle.sourceId, handle.sourceVersionId, notices[name])
  const old = artificialResponse(name === 'condition-unknown' ? 'condition-true' : name, handle.sourceId)
  const locate = (surface: string) => {
    const scope = index.scopes.find(s => s.text.includes(surface))
    if (!scope) throw Error('ENGINEERING_TRANSCRIPTION_SOURCE_MISSING')
    return scope.id
  }
  const all = index.scopes.map(s => s.id)
  const strip = <T extends { evidenceIds: string[]; selected?: boolean }>(item: T) => {
    const { evidenceIds, selected, ...fields } = plainJson(item); void evidenceIds; void selected; return fields
  }
  const tasks: SemanticTask[] = old.standaloneTasks.map(t => {
    const { tempId, actionVerb, actionObject, inferenceLevel, ...detail } = strip(t)
    const conditional = name.startsWith('condition-')
    const value = name === 'condition-true' ? 'true' : name === 'condition-false' ? 'false' : 'unknown'
    const cancelled = name === 'revision' && tempId === 'old'
    return { id: tempId, propositionScopeIds: all, action: { scopeId: locate(actionVerb), surface: actionVerb },
      object: { scopeId: locate(actionObject), surface: actionObject }, inferenceLevel,
      semantics: { actor: 'addressee', speechAct: 'directive', polarity: 'affirmative', tense: cancelled ? 'past' : 'future',
        status: cancelled ? 'cancelled' : 'pending', validity: cancelled ? 'superseded' : 'active', modality: 'required' },
      actionType: actionVerb === '保存' ? 'save' : actionVerb === '打印' ? 'print' : 'submit', effect: 'physical_action', detail,
      condition: { value: conditional ? value : 'not_applicable', conditionScopeIds: conditional ? [all[0]] : [],
        factScopeIds: conditional ? [all.at(-1)!] : [] },
      coverage: { time: old.timePoints.some(p => p.relatedTaskTempIds.includes(tempId)
        || p.relatedMaterialTempIds.some(m => detail.materialTempIds.includes(m))) ? 'present' : 'not_stated',
        material: detail.materialTempIds.length ? 'present' : 'not_stated', event: 'not_stated' },
      eventTempIds: [] }
  })
  const input: SemanticInput = { schemaVersion: SEMANTIC_VERSION, sourceId: index.sourceId, sourceVersionId: index.sourceVersionId,
    sourceFingerprint: index.sourceFingerprint, tasks, materials: old.materials.map(m => ({ ...strip(m), scopeIds: all })),
    timePoints: old.timePoints.map(t => ({ ...strip(t), scopeIds: all })), events: [],
    revisions: name === 'revision' ? [{ type: 'supersedes', targetDirectiveId: 'old', fromDirectiveId: 'new', effective: 'true', scopeIds: all }] : [],
    conflicts: name === 'revision' ? [] : old.conflicts.map(c => ({ ...strip(c), scopeIds: all })),
    informationScopeIds: tasks.length ? [] : all, unresolvedScopeIds: [] }
  transform?.(input)
  const context: ComposeContext = { index, authority: 'human_engineering', referenceTime: NOW, timezone: 'Asia/Shanghai', ownershipMode: 'mainline05-own-assets-1' }
  return { rawOutputText: JSON.stringify(input), rawResponse: plainJson(input), context,
    legacyResponse: name === 'condition-unknown' ? null : plainJson(old) as RecognitionResult | null }
}
export function engineeringCase(text: string): CaseName {
  const name = cases.find(c => notices[c] === text)
  if (!name) throw Error('仅接受已登记人工工程通知，不调用模型')
  return name
}
export { cases, notices, NOW }

// Existing MAINLINE04 linked-event/material-only-time engineering transformation.
export function linkedEvent(input: SemanticInput) {
  const time = input.timePoints[0], task = input.tasks[0]
  time.type = 'event_start'
  task.detail.timePointTempIds = []
  task.eventTempIds = ['linked-event']; task.coverage.event = 'present'
  input.events.push({ tempId: 'linked-event', title: '入场', description: '已登记工程关系变形', startTimePointTempId: time.tempId,
    endTimePointTempId: null, location: null, confidence: 1, inferenceLevel: 'explicit',
    scopeIds: [...task.propositionScopeIds], relatedTaskTempIds: [task.id] })
}

// Registered shared-material/private-time variation; no new source or answer set.
export function sharedMaterial(input: SemanticInput) {
  input.materials[0].relatedTaskTempIds.push(input.tasks[1].id)
  input.tasks[1].detail.materialTempIds.push(input.materials[0].tempId)
  input.timePoints.forEach(point => { point.relatedMaterialTempIds = [] })
}

// The registered MAINLINE04 shared-event edges, combined with the existing event-start variant.
export function sharedEvent(input: SemanticInput) {
  linkedEvent(input)
  input.timePoints[0].relatedTaskTempIds.push(input.tasks[1].id)
  input.events[0].relatedTaskTempIds.push(input.tasks[1].id)
  input.tasks[1].eventTempIds.push(input.events[0].tempId)
  input.tasks[1].coverage.event='present'
}

// Cancel the old requirement without a replacement edge; retain the independent new directive.
export function cancelWithoutReplacement(input: SemanticInput) {
  input.revisions[0]={...input.revisions[0],type:'cancels',fromDirectiveId:null}
}
