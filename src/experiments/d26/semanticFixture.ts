import { indexImmutableScopesV11 } from '../../recognition/scopeIndexV11'
import { SEMANTIC_VERSION, type SemanticInput, type SemanticTask } from '../mainline04/semanticContract'
import { bridgeSemanticToRecognitionD26 } from '../../recognition/firstSuggestionD26'

/** Anonymous local fake transport input. No expected labels, model client, storage or network. */
export async function createD26SemanticFixture(kind: 'conditions' | 'revision', referenceTime = '2026-10-02T09:00:00+08:00', identity?: { sourceId: string; sourceVersionId: string }) {
  const sourceText = kind === 'conditions'
    ? '请先填写设备核对表。填写完成后提交设备核对表。只有资格确认后才可以领取设备钥匙，资格尚未确认。你不符合借用资格，无需领取投影设备。'
    : '原提交旧版登记表的要求已取消。现在改为上传新版登记表。请保存报名回执。'
  const sourceId = identity?.sourceId ?? 'd26-engineering-' + kind, sourceVersionId = identity?.sourceVersionId ?? sourceId + '-v1', timezone = 'Asia/Shanghai'
  const index = await indexImmutableScopesV11(sourceId, sourceVersionId, sourceText)
  const scope = (fragment: string) => {
    const found = index.scopes.find(row => row.text.includes(fragment))
    if (!found) throw Error('D26_ENGINEERING_FIXTURE_SCOPE')
    return found.id
  }
  const task = (id: string, action: string, object: string, fragment: string): SemanticTask => ({
    id, propositionScopeIds: [scope(fragment)], semantics: { actor: 'addressee', speechAct: 'directive', polarity: 'affirmative', tense: 'future', status: 'pending', validity: 'active', modality: 'required' },
    inferenceLevel: 'explicit', actionType: 'other', action: { surface: action, scopeId: scope(fragment) }, object: { surface: object, scopeId: scope(fragment) }, effect: 'local_change',
    detail: { parentTempId: null, hierarchyType: 'task', title: action + object, description: '', completionCriteria: [], estimatedMinutes: null, statusSuggestion: 'todo', prioritySuggestion: 'medium', dependencyTempIds: [], materialTempIds: [], timePointTempIds: [], confidence: 1, userConfirmationRequired: true },
    condition: { value: 'not_applicable', conditionScopeIds: [], factScopeIds: [] }, coverage: { time: 'not_stated', material: 'not_stated', event: 'not_stated' }, eventTempIds: [],
  })
  const semantic: SemanticInput = { schemaVersion: SEMANTIC_VERSION, sourceId, sourceVersionId, sourceFingerprint: index.sourceFingerprint, tasks: [], materials: [], timePoints: [], events: [], revisions: [], conflicts: [], informationScopeIds: [], unresolvedScopeIds: [] }
  if (kind === 'conditions') {
    semantic.tasks = [task('T1', '填写', '设备核对表', '请先'), task('T2', '提交', '设备核对表', '填写完成后'), task('T3', '领取', '设备钥匙', '只有资格'), task('T4', '领取', '投影设备', '无需领取')]
    semantic.tasks[1].detail.dependencyTempIds = ['T1']
    semantic.tasks[2].condition = { value: 'unknown', conditionScopeIds: [scope('只有资格')], factScopeIds: [scope('资格尚未确认')] }
    semantic.tasks[3].condition = { value: 'false', conditionScopeIds: [scope('不符合借用资格')], factScopeIds: [scope('不符合借用资格')] }
    semantic.tasks[3].semantics.polarity = 'negative'; semantic.tasks[3].semantics.modality = 'informational'
    semantic.informationScopeIds = [scope('资格尚未确认'), scope('不符合借用资格')]
  } else {
    semantic.tasks = [task('T1', '提交', '旧版登记表', '原提交'), task('T2', '上传', '新版登记表', '现在改为'), task('T3', '保存', '报名回执', '请保存')]
    semantic.tasks[0].semantics.status = 'cancelled'; semantic.tasks[0].semantics.validity = 'superseded'
    semantic.revisions = [{ type: 'supersedes', targetDirectiveId: 'T1', fromDirectiveId: 'T2', effective: 'true', scopeIds: [scope('原提交'), scope('现在改为')] }]
  }
  return { kind, sourceText, referenceTime, timezone, mode: 'ENGINEERING_REPLAY' as const, ...bridgeSemanticToRecognitionD26(semantic, { index, referenceTime, timezone }) }
}
