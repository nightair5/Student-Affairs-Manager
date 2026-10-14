import { describe, expect, it } from 'vitest'
import { indexImmutableScopesV11 } from '../../recognition/scopeIndexV11'
import { composeSemantics } from '../mainline04/semanticComposer'
import { assembleEvidenceRoleWire, EVIDENCE_ROLE_WIRE_VERSION, type EvidenceRoleWire } from './evidenceRoleWire'
import type { WireContext } from './modelWire'

async function fixture(text: string) {
  const context: WireContext = { index: await indexImmutableScopesV11('evidence-role-engineering', 'evidence-role-engineering:1', text),
    referenceTime: '2026-09-13T09:00:00+08:00', timezone: 'Asia/Shanghai' }
  const scope = (surface: string) => {
    const item = context.index.scopes.find(candidate => candidate.text.includes(surface))
    if (!item) throw Error('TEST_SCOPE_MISSING')
    return item.id
  }
  const role = (id: string, roleName: EvidenceRoleWire['evidenceRoles'][number]['role'], surfaces: string[]) => ({
    id, role: roleName, scopeIds: [...new Set(surfaces.map(scope))],
  })
  const task = (id: string, action: string, object: string, roleId: string): EvidenceRoleWire['tasks'][number] => ({
    id, evidenceRoleIds: [roleId], action: { scopeId: scope(action), surface: action }, object: { scopeId: scope(object), surface: object },
    inferenceLevel: 'explicit', actionType: 'other', effect: 'physical_action',
    semantics: { actor: 'addressee', speechAct: 'directive', polarity: 'affirmative', tense: 'future', status: 'pending', validity: 'active', modality: 'required' },
    detail: { parentTempId: null, hierarchyType: 'task', title: action + object, description: '', completionCriteria: [], estimatedMinutes: null,
      statusSuggestion: 'todo', prioritySuggestion: 'medium', dependencyTempIds: [], confidence: 1, userConfirmationRequired: true },
    condition: { value: 'not_applicable', conditionRoleIds: [], factRoleIds: [] },
    coverage: { time: 'not_stated', material: 'not_stated', event: 'not_stated' },
  })
  const wire: EvidenceRoleWire = { schemaVersion: EVIDENCE_ROLE_WIRE_VERSION, evidenceRoles: [], tasks: [], materials: [],
    timePoints: [], events: [], revisions: [], conflicts: [], informationRoleIds: [], unresolvedRoleIds: [] }
  const coverRemainingScopes = () => {
    const covered = new Set(wire.evidenceRoles.flatMap(item => item.scopeIds))
    for (const item of context.index.scopes.filter(item => !covered.has(item.id))) {
      const id = `auto_info_${wire.evidenceRoles.length + 1}`
      wire.evidenceRoles.push({ id, role: 'information_only', scopeIds: [item.id] }); wire.informationRoleIds.push(id)
    }
  }
  const assemble = () => { coverRemainingScopes(); return assembleEvidenceRoleWire(wire, context) }
  const compose = async () => composeSemantics(assemble().adaptedResponse,
    { ...context, authority: 'live_model_candidate', profile: 'real-input-01', ownershipMode: 'mainline05-own-assets-1' })
  return { context, scope, role, task, wire, assemble, compose }
}

describe('evidenceRoleWire deterministic assembly', () => {
  it('keeps a material specification attached to one task without creating another task', async () => {
    const f = await fixture('请寄送展品，包装须使用三层缓冲纸。')
    f.wire.evidenceRoles.push(f.role('r_action', 'directive_action', ['寄送展品']), f.role('r_material', 'material_requirement', ['三层缓冲纸']))
    f.wire.tasks.push(f.task('deliver', '寄送', '展品', 'r_action')); f.wire.tasks[0].coverage.material = 'present'
    f.wire.materials.push({ tempId: 'padding', name: '缓冲纸', required: true, quantity: 3, formatRequirements: ['三层'], namingRequirements: [],
      submissionChannel: null, relatedTaskTempIds: ['deliver'], evidenceRoleIds: ['r_material'], confidence: 1 })
    const result = await f.compose()
    expect(result.original.tasks.map(item => item.id)).toEqual(['deliver'])
    expect(result.original.tasks[0].detail.materialTempIds).toEqual(['padding'])
    expect(result.original.materials[0].relatedTaskTempIds).toEqual(['deliver'])
  })

  it('retains an explicit preparation action rather than treating it only as a material', async () => {
    const f = await fixture('请准备备用封条。')
    f.wire.evidenceRoles.push(f.role('r_action', 'directive_action', ['准备备用封条']))
    f.wire.tasks.push(f.task('prepare', '准备', '备用封条', 'r_action'))
    expect(f.assemble().assembledWire.tasks.map(item => item.id)).toEqual(['prepare'])
  })

  it('derives the reverse link for one shared material without guessing owners', async () => {
    const f = await fixture('请登记展位并领取储物柜，两项均需出示工作证。')
    f.wire.evidenceRoles.push(f.role('r_action', 'directive_action', ['登记展位', '领取储物柜']), f.role('r_material', 'material_requirement', ['工作证']))
    f.wire.tasks.push(f.task('register', '登记', '展位', 'r_action'), f.task('collect', '领取', '储物柜', 'r_action'))
    for (const item of f.wire.tasks) item.coverage.material = 'present'
    f.wire.materials.push({ tempId: 'credential', name: '工作证', required: true, quantity: 1, formatRequirements: [], namingRequirements: [],
      submissionChannel: null, relatedTaskTempIds: ['register', 'collect'], evidenceRoleIds: ['r_material'], confidence: 1 })
    const result = f.assemble().assembledWire
    expect(result.materials[0].relatedTaskTempIds).toEqual(['register', 'collect'])
    expect(result.tasks.map(item => item.detail.materialTempIds)).toEqual([['credential'], ['credential']])
  })

  it('does not infer not_stated or invent a material from an empty entity list', async () => {
    const f = await fixture('请提交记录，通知同时说明需要附件，但附件名称尚不清楚。')
    f.wire.evidenceRoles.push(f.role('r_action', 'directive_action', ['提交记录']), f.role('r_material', 'material_requirement', ['需要附件']))
    f.wire.tasks.push(f.task('submit', '提交', '记录', 'r_action')); f.wire.tasks[0].coverage.material = 'not_extracted'
    f.wire.unresolvedRoleIds.push('r_material')
    const result = f.assemble().assembledWire
    expect(result.materials).toEqual([])
    expect(result.tasks[0].coverage.material).toBe('not_extracted')
    expect(result.unresolvedScopeIds).toEqual(f.wire.evidenceRoles[1].scopeIds)
  })

  it('keeps an unknown prerequisite unknown and derives no cancellation', async () => {
    const f = await fixture('设备核验完成后请领取配件，当前核验结果未知。')
    f.wire.evidenceRoles.push(f.role('r_action', 'directive_action', ['领取配件']), f.role('r_condition', 'condition_or_dependency', ['核验完成后', '结果未知']))
    f.wire.tasks.push(f.task('collect', '领取', '配件', 'r_action'))
    f.wire.tasks[0].condition = { value: 'unknown', conditionRoleIds: ['r_condition'], factRoleIds: ['r_condition'] }
    const result = f.assemble().assembledWire
    expect(result.tasks[0].condition.value).toBe('unknown')
    expect(result.revisions).toEqual([])
  })

  it('keeps a cancellation with a missing old entity unresolved instead of creating a dangling revision', async () => {
    const f = await fixture('此前要求已经取消，但通知没有给出旧要求内容。')
    f.wire.evidenceRoles.push(f.role('r_revision', 'cancellation_or_revision', ['要求已经取消']))
    f.wire.unresolvedRoleIds.push('r_revision')
    expect(f.assemble().assembledWire).toMatchObject({ tasks: [], revisions: [] })
    f.wire.revisions.push({ type: 'cancels', targetDirectiveId: 'missing', fromDirectiveId: null, effective: 'true', evidenceRoleIds: ['r_revision'] })
    f.wire.unresolvedRoleIds = []
    expect(f.assemble).toThrow('EVIDENCE_REVISION_TARGET')
  })

  it('preserves explicit, vague, absent time and an independent information scope', async () => {
    const f = await fixture('请近期提交总结，具体日期另行通知。背景资料仅供阅读。')
    f.wire.evidenceRoles.push(f.role('r_action', 'directive_action', ['提交总结']), f.role('r_time', 'time_requirement', ['近期', '另行通知']),
      f.role('r_info', 'information_only', ['背景资料']))
    f.wire.tasks.push(f.task('submit', '提交', '总结', 'r_action')); f.wire.tasks[0].coverage.time = 'present'
    f.wire.timePoints.push({ tempId: 'vague_time', type: 'task_deadline', rawText: '近期', relatedTaskTempIds: ['submit'], relatedMaterialTempIds: [],
      evidenceRoleIds: ['r_time'], confidence: 1 })
    f.wire.informationRoleIds.push('r_info')
    const result = f.assemble().assembledWire
    expect(result.timePoints[0]).toMatchObject({ rawText: '近期', relatedTaskTempIds: ['submit'] })
    expect(result.tasks[0].detail.timePointTempIds).toEqual(['vague_time'])
    expect(result.informationScopeIds).toEqual(f.wire.evidenceRoles[2].scopeIds)
  })

  it('rejects orphan roles, wrong role classes, bad references and false coverage instead of repairing them', async () => {
    const f = await fixture('请提交记录，需要附件。')
    f.wire.evidenceRoles.push(f.role('r_action', 'directive_action', ['提交记录']), f.role('r_material', 'material_requirement', ['附件']))
    f.wire.tasks.push(f.task('submit', '提交', '记录', 'r_action'))
    expect(f.assemble).toThrow('EVIDENCE_ROLE_ORPHAN')
    f.wire.unresolvedRoleIds.push('r_material')
    f.wire.tasks[0].coverage.material = 'present'
    expect(f.assemble).toThrow('EVIDENCE_COVERAGE_MATERIAL')
    f.wire.tasks[0].coverage.material = 'not_extracted'; f.wire.tasks[0].evidenceRoleIds = ['r_material']
    expect(f.assemble).toThrow('EVIDENCE_TASK_ROLE')
  })
})
