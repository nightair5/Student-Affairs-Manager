import { indexImmutableScopesV11 } from '../../recognition/scopeIndexV11'
import { SINGLE_AUTHORITY_VERSION, type SingleAuthorityFacts } from '../../recognition/sourceContractV5'
import { createContractFixture, type ContractFixtureKind } from '../d26Recorded/contractFixtures'
import type {WireContext} from '../realInput01/modelWire'
export const AUTHORITY_CASES = ['single', 'two', 'ceremony', 'information', 'similar', 'shared', 'bad-owner', 'window', 'mixed', 'dependency', 'deadline', 'revision'] as const
export type AuthorityCase = typeof AUTHORITY_CASES[number]
const texts = {
  single: '数据工作坊于2026年11月12日14:00开始，16:00结束。工作坊采用线上形式，安排分组互动，结业后提供参与证明。仅供了解，不要求报名。',
  two: '设计分享会于2026年11月13日09:00开始。数据沙龙于2026年11月14日15:00开始。两项活动分别举行，仅供了解。',
  ceremony: '数据工作坊于2026年11月12日14:00开始，16:00结束。另于2026年11月13日09:00举行颁发仪式，地点为报告厅。',
  information: '办事指南采用新版版式。参与证明的名称保持不变。这是资料说明，不要求操作，也未安排活动。',
  similar: '甲校数据分享会于2026年11月12日14:00开始。乙校数据分享会于2026年11月13日15:00开始。两个学校分别组织。',
  shared: '甲组讨论与乙组讨论同时于2026年11月12日14:00开始，各自组织。仅供了解。',
  'bad-owner': '甲组讨论于2026年11月12日14:00开始。乙组讨论于2026年11月13日15:00开始。丙组讨论于2026年11月14日16:00开始。仅供了解。',
} as const
/** Human-written wires are engineering fixtures, never evidence of generated accuracy. */
export async function createAuthorityFixture(kind: AuthorityCase):Promise<{kind:string;context:WireContext;sourceText:string;facts:SingleAuthorityFacts;rawHttpText:string;role?:'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT'}> {
  if(kind==='window'){
    const base=await createAuthorityFixture('deadline'),sourceText='请在开放时段办理申请。办理申请开放时间为2026年11月6日09:00至2026年11月8日17:00。',sourceId='authority-fixture-window',sourceVersionId=sourceId+'-v1',context={...base.context,index:await indexImmutableScopesV11(sourceId,sourceVersionId,sourceText)},scopeIds=context.index.scopes.map(s=>s.id),t=structuredClone(base.facts.tasks[0])
    t.action={surface:'办理',scopeId:scopeIds[0]};t.object={surface:'申请',scopeId:scopeIds[0]};t.propositionScopeIds=scopeIds;t.detail.title='办理申请';t.detail.completionCriteria=[];t.coverage={time:{status:'present',absenceScopeIds:[]},material:{status:'not_stated',absenceScopeIds:[]},event:{status:'not_stated',absenceScopeIds:[]}}
    const facts:SingleAuthorityFacts={...base.facts,tasks:[t],materials:[],events:[],timePoints:[{tempId:'P1',type:'window_start',rawText:'2026年11月6日09:00',scopeIds:[scopeIds[1]],owners:[{kind:'task',entityId:'T1'}],confidence:1},{tempId:'P2',type:'window_end',rawText:'2026年11月8日17:00',scopeIds:[scopeIds[1]],owners:[{kind:'task',entityId:'T1'}],confidence:1}],scopeAccounting:scopeIds.map(scopeId=>({scopeId,kind:'action',primaryEntityIds:['T1']}))}
    return {kind,context,sourceText,facts,rawHttpText:envelope(facts),role:'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT' as const}
  }
  if (['mixed', 'dependency', 'deadline', 'revision'].includes(kind)) {
    const old = await createContractFixture(kind as ContractFixtureKind), facts: SingleAuthorityFacts = {
      ...old.facts, schemaVersion: SINGLE_AUTHORITY_VERSION,
      tasks: old.facts.tasks.map(t => ({ ...t, coverage: Object.fromEntries(Object.entries(t.coverage).map(([c, v]) => [c, { status: v.status, absenceScopeIds: v.status === 'present' ? [] : v.scopeIds }])) as SingleAuthorityFacts['tasks'][number]['coverage'] })),
      events: old.facts.events.map(e => ({tempId:e.tempId,title:e.title,description:e.description,location:e.location,relatedTaskTempIds:e.relatedTaskTempIds,scopeIds:e.scopeIds,confidence:e.confidence,inferenceLevel:e.inferenceLevel,attributes: [] })),
      timePoints: old.facts.timePoints.map(({ relatedTaskTempIds, relatedMaterialTempIds, ...p }) => ({ ...p, owners: [...relatedTaskTempIds.map(entityId => ({ kind: 'task' as const, entityId })), ...relatedMaterialTempIds.map(entityId => ({ kind: 'material' as const, entityId })), ...old.facts.events.flatMap<SingleAuthorityFacts['timePoints'][number]['owners'][number]>(e => e.startTimePointTempId === p.tempId ? [{ kind: 'event_start', entityId: e.tempId }] : e.endTimePointTempId === p.tempId ? [{ kind: 'event_end', entityId: e.tempId }] : [])] })),
      scopeAccounting: old.facts.scopeAccounting.map(row => ({scopeId:row.scopeId,kind:row.kind,primaryEntityIds:row.primaryEntityIds})),
    }
    return { ...old, facts, rawHttpText: envelope(facts) }
  }
  const sourceText = texts[kind as keyof typeof texts], sourceId = `authority-fixture-${kind}`, sourceVersionId = sourceId + '-v1'
  const context = { index: await indexImmutableScopesV11(sourceId, sourceVersionId, sourceText), referenceTime: '2026-10-06T09:00:00+08:00', timezone: 'Asia/Shanghai' }
  const scope = (text: string) => { const found = context.index.scopes.find(s => s.text.includes(text)); if (!found) throw Error('AUTHORITY_FIXTURE_SCOPE'); return found.id }
  const facts: SingleAuthorityFacts = { schemaVersion: SINGLE_AUTHORITY_VERSION, events: [], timePoints: [], tasks: [], materials: [], revisions: [], conflicts: [], prerequisiteStates: [], scopeAccounting: [] }
  const event = (id: string, title: string, fragments: string[], location: string | null = null) => { const e: SingleAuthorityFacts['events'][number] = { tempId: id, title, description: '', location, relatedTaskTempIds: [], scopeIds: [...new Set(fragments.map(scope))], confidence: 1, inferenceLevel: 'explicit', attributes: [] }; facts.events.push(e); return e }
  const point = (id: string, rawText: string, type: 'event_start' | 'event_end', fragment: string, owners: string[]) => facts.timePoints.push({ tempId: id, rawText, type, scopeIds: [scope(fragment)], owners: owners.map(entityId => ({ kind: type, entityId })), confidence: 1 })
  if (kind === 'single' || kind === 'ceremony') {
    const e = event('E1', '数据工作坊', ['数据工作坊', '16:00结束', ...(kind === 'single' ? ['线上形式', '分组互动', '参与证明'] : [])])
    point('P1', '2026年11月12日14:00', 'event_start', '数据工作坊', ['E1']); point('P2', '16:00', 'event_end', '16:00结束', ['E1'])
    if (kind === 'single') e.attributes = [['format', '线上形式'], ['participation', '分组互动'], ['outcome', '参与证明']].map(([k, text]) => ({ kind: k as 'format' | 'participation' | 'outcome', text, scopeIds: [scope(text)] }))
    else { event('E2', '颁发仪式', ['颁发仪式', '报告厅'], '报告厅'); point('P3', '2026年11月13日09:00', 'event_start', '颁发仪式', ['E2']) }
  } else if (kind === 'two' || kind === 'similar' || kind === 'bad-owner') {
    const rows = kind === 'two' ? [['设计分享会', '2026年11月13日09:00'], ['数据沙龙', '2026年11月14日15:00']] : kind === 'similar' ? [['甲校数据分享会', '2026年11月12日14:00'], ['乙校数据分享会', '2026年11月13日15:00']] : [['甲组讨论', '2026年11月12日14:00'], ['乙组讨论', '2026年11月13日15:00']]
    rows.forEach(([title, raw], i) => { event('E' + (i + 1), title, [title]); point('P' + (i + 1), raw, 'event_start', title, [kind === 'bad-owner' && i === 0 ? 'E2' : 'E' + (i + 1)]) })
    if(kind==='bad-owner'){event('E3','丙组讨论',['丙组讨论']);point('P3','2026年11月14日16:00','event_start','丙组讨论',['E3'])}
  } else if (kind === 'shared') {
    event('E1', '甲组讨论', ['甲组讨论']); event('E2', '乙组讨论', ['乙组讨论']); point('P1', '2026年11月12日14:00', 'event_start', '甲组讨论', ['E1', 'E2'])
  }
  for (const s of context.index.scopes) { const es = facts.events.filter(e => e.scopeIds.includes(s.id)); facts.scopeAccounting.push({ scopeId: s.id, kind: es.length ? 'event' : 'information', primaryEntityIds: es.map(e => e.tempId) }) }
  return { kind, context, sourceText, facts, rawHttpText: envelope(facts), role: 'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT' as const }
}
function envelope(facts: SingleAuthorityFacts) { return JSON.stringify({ model: 'deepseek-flash', status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(facts) }] }], usage: { input_tokens: 0, output_tokens: 0 } }) }
