import { SOURCE_CONTRACT_SCHEMA, assembleSourceContractV4, type SourceContractV4 } from './sourceContractV4'
import { buildCandidate19Request } from '../experiments/realInput01/candidate19'
import { plainJson } from '../experiments/mainline04/semanticContract'
import type { WireContext } from '../experiments/realInput01/modelWire'
import { MAX_REQUEST_BYTES } from '../experiments/realInput01/modelWire'
import { decodeCurrentSourceRecording } from './conditionalNonActionProduct'
import { hasLiteralScopeSpan } from './authorityLiteralSupport'

export const SINGLE_AUTHORITY_VERSION = 'single-authority-source-contract-5.0.0'
export const SINGLE_AUTHORITY_CANDIDATE_VERSION = 'single-authority-generation-1.0.0'
export const SINGLE_AUTHORITY_PROMPT_VERSION = 'recognition-single-authority-1.0.0'
export const AUTHORITY_LOCAL_COVERAGE_VERSION = 'authority-local-coverage-1.1.0'
type Category = 'time' | 'material' | 'event'
type Owner = { kind: 'task' | 'material' | 'event_start' | 'event_end'; entityId: string }
type Claim = { status: 'present' | 'not_stated' | 'explicit_none' | 'unknown'; absenceScopeIds: string[] }
type Attribute = { kind: 'format' | 'participation' | 'outcome' | 'location_note'; text: string; scopeIds: string[] }
export type SingleAuthorityFacts = Omit<SourceContractV4, 'schemaVersion' | 'tasks' | 'events' | 'timePoints' | 'scopeAccounting'> & {
  schemaVersion: typeof SINGLE_AUTHORITY_VERSION
  tasks: Array<Omit<SourceContractV4['tasks'][number], 'coverage'> & { coverage: Record<Category, Claim> }>
  events: Array<Omit<SourceContractV4['events'][number], 'startTimePointTempId' | 'endTimePointTempId'> & { attributes: Attribute[] }>
  timePoints: Array<Omit<SourceContractV4['timePoints'][number], 'type' | 'relatedTaskTempIds' | 'relatedMaterialTempIds'> & { type: SourceContractV4['timePoints'][number]['type'] | 'window_start' | 'window_end'; owners: Owner[] }>
  scopeAccounting: Array<Omit<SourceContractV4['scopeAccounting'][number], 'secondaryEntityIds'>>
}
export const SINGLE_AUTHORITY_SCHEMA = structuredClone(SOURCE_CONTRACT_SCHEMA)
const id = { type: 'string', minLength: 1, maxLength: 4000 }
const ids = { type: 'array', maxItems: 200, uniqueItems: true, items: id }
SINGLE_AUTHORITY_SCHEMA.properties!.schemaVersion = { type: 'string', const: SINGLE_AUTHORITY_VERSION }
const claim = { type: 'object', additionalProperties: false, required: ['status', 'absenceScopeIds'], properties: { status: { type: 'string', enum: ['present', 'not_stated', 'explicit_none', 'unknown'] }, absenceScopeIds: ids } }
SINGLE_AUTHORITY_SCHEMA.properties!.tasks.items!.properties!.coverage = { type: 'object', additionalProperties: false, required: ['time', 'material', 'event'], properties: { time: claim, material: claim, event: claim } }
const point = SINGLE_AUTHORITY_SCHEMA.properties!.timePoints.items!
point.properties!.type.enum = [...point.properties!.type.enum!, 'window_start', 'window_end']
delete point.properties!.relatedTaskTempIds; delete point.properties!.relatedMaterialTempIds
point.required = point.required!.filter(k => !['relatedTaskTempIds', 'relatedMaterialTempIds'].includes(k))
point.required.push('owners')
point.properties!.owners = { type: 'array', minItems: 1, maxItems: 200, uniqueItems: true, items: { type: 'object', additionalProperties: false, required: ['kind', 'entityId'], properties: { kind: { type: 'string', enum: ['task', 'material', 'event_start', 'event_end'] }, entityId: id } } }
const event = SINGLE_AUTHORITY_SCHEMA.properties!.events.items!
delete event.properties!.startTimePointTempId; delete event.properties!.endTimePointTempId
event.required = event.required!.filter(k => !['startTimePointTempId', 'endTimePointTempId'].includes(k))
event.required.push('attributes')
event.properties!.attributes = { type: 'array', maxItems: 40, items: { type: 'object', additionalProperties: false, required: ['kind', 'text', 'scopeIds'], properties: { kind: { type: 'string', enum: ['format', 'participation', 'outcome', 'location_note'] }, text: id, scopeIds: { ...ids, minItems: 1 } } } }
const accounting = SINGLE_AUTHORITY_SCHEMA.properties!.scopeAccounting.items!
delete accounting.properties!.secondaryEntityIds
accounting.required = accounting.required!.filter(k => k !== 'secondaryEntityIds')
type Schema = typeof SINGLE_AUTHORITY_SCHEMA
function matches(value: unknown, schema: Schema): boolean {
  if ('const' in schema) return value === schema.const
  if (schema.anyOf) return schema.anyOf.some(s => matches(value, s))
  if (schema.enum && !schema.enum.includes(value)) return false
  if (schema.type === 'null') return value === null
  if (schema.type === 'string') return typeof value === 'string' && value.length >= (schema.minLength ?? 0) && value.length <= (schema.maxLength ?? 4000)
  if (schema.type === 'number') return typeof value === 'number' && Number.isFinite(value) && value >= (schema.minimum ?? -Infinity) && value <= (schema.maximum ?? Infinity)
  if (schema.type === 'boolean') return typeof value === 'boolean'
  if (schema.type === 'array') return Array.isArray(value) && value.length >= (schema.minItems ?? 0) && value.length <= (schema.maxItems ?? 200) && (!schema.uniqueItems || new Set(value.map(v => JSON.stringify(v))).size === value.length) && value.every(v => matches(v, schema.items!))
  if (schema.type === 'object') return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === schema.required!.length && schema.required!.every(k => Object.hasOwn(value, k) && matches((value as Record<string, unknown>)[k], schema.properties![k]))
  return false
}
const check = (ok: unknown, code: string) => { if (!ok) throw Error('SINGLE_AUTHORITY_' + code) }
const categories: Category[] = ['time', 'material', 'event']

/** Generates only inverse indexes. A missing fact, owner, endpoint or coverage claim remains an error. */
export function compileSingleAuthority(input: unknown, context: WireContext, quarantineInvalidOwners=false, localizeMissingCoverage=false) {
  const facts = plainJson(input) as SingleAuthorityFacts
  check(matches(facts, SINGLE_AUTHORITY_SCHEMA), 'SHAPE')
  const tasks = new Set(facts.tasks.map(t => t.id)), materials = new Set(facts.materials.map(m => m.tempId)), events = new Map(facts.events.map(e => [e.tempId, e]))
  const endpoints = new Map<string, string>()
  const quarantined:Array<{pointId:string;owner:Owner;affectedIds:string[];scopeIds:string[]}>=[]
  for (const p of facts.timePoints) for (const owner of p.owners) {
    if(p.type==='window_start'||p.type==='window_end')check(owner.kind==='task'||owner.kind==='material','WINDOW_OWNER_KIND')
    if (owner.kind === 'task') check(tasks.has(owner.entityId), 'TASK_OWNER')
    else if (owner.kind === 'material') check(materials.has(owner.entityId), 'MATERIAL_OWNER')
    else {
      const target = events.get(owner.entityId)
      check(target && p.type === owner.kind, 'EVENT_OWNER_TYPE')
      // Sharing requires each named event to cite this time's actual source span.
      if(target&&!p.scopeIds.some(id => target.scopeIds.includes(id))&&quarantineInvalidOwners){quarantined.push({pointId:p.tempId,owner,affectedIds:[owner.entityId,...facts.events.filter(e=>e.scopeIds.some(id=>p.scopeIds.includes(id))).map(e=>e.tempId)],scopeIds:p.scopeIds});continue}
      check(target && p.scopeIds.some(id => target.scopeIds.includes(id)), 'EVENT_OWNER_EVIDENCE')
      const key = owner.entityId + ':' + owner.kind
      check(!endpoints.has(key), 'DUPLICATE_ENDPOINT')
      endpoints.set(key, p.tempId)
    }
    if (p.type === 'event_start' || p.type === 'event_end') check(owner.kind === p.type, 'EVENT_TIME_OWNER_KIND')
  }
  const projected: SourceContractV4 = { ...facts, schemaVersion: 'explicit-source-contract-4.0.0',
    events: facts.events.map(({ attributes, ...e }) => {
      for (const a of attributes) check(a.scopeIds.every(id => e.scopeIds.includes(id)) && (localizeMissingCoverage
        ? hasLiteralScopeSpan(a.text, a.scopeIds, context)
        : a.scopeIds.some(id => context.index.scopes.find(s => s.id === id)?.text.includes(a.text))), 'ATTRIBUTE_EVIDENCE')
      return { ...e, description: [e.description, ...attributes.map(a => a.text)].filter(Boolean).join('；'), startTimePointTempId: endpoints.get(e.tempId + ':event_start') ?? null, endTimePointTempId: endpoints.get(e.tempId + ':event_end') ?? null }
    }),
    // v8 keeps its existing endpoint vocabulary; the explicit source-window role is separately retained in canonical legacyData.
    timePoints: facts.timePoints.map(({ owners, ...p }) => ({ ...p, type:p.type==='window_start'?'event_start':p.type==='window_end'?'event_end':p.type,relatedTaskTempIds: owners.filter(o => o.kind === 'task').map(o => o.entityId), relatedMaterialTempIds: owners.filter(o => o.kind === 'material').map(o => o.entityId) })),
    tasks: [], scopeAccounting: [],conflicts:[...facts.conflicts,...quarantined.map((q,i)=>({id:`owner-risk-${i}`,type:'other' as const,message:'时间归属与所引原文对象不一致，相关事件需重新核对；无关联项可继续保存。',entityTempIds:[q.pointId,...new Set(q.affectedIds)],scopeIds:q.scopeIds,requiresDecision:true}))],
  }
  const owned = (taskId: string, category: Category) => {
    const ms = projected.materials.filter(m => m.relatedTaskTempIds.includes(taskId)), es = projected.events.filter(e => e.relatedTaskTempIds.includes(taskId))
    return category === 'material' ? ms : category === 'event' ? es : projected.timePoints.filter(p => p.relatedTaskTempIds.includes(taskId) || p.relatedMaterialTempIds.some(id => ms.some(m => m.tempId === id)) || es.some(e => e.startTimePointTempId === p.tempId || e.endTimePointTempId === p.tempId))
  }
  const missingCoverage: Array<{ taskId: string; category: Category; originalClaim: Claim; code: 'MISSING_PRESENT_FACT' }> = []
  const associatedEventTimes: Array<{ taskId: string; originalClaim: Claim; timeIds: string[]; reason: 'LEGACY_ASSOCIATED_EVENT_TIME_INDEX_ONLY' }> = []
  projected.tasks = facts.tasks.map(t => ({ ...t, coverage: Object.fromEntries(categories.map(category => {
    const claim = t.coverage[category], entities = owned(t.id, category)
    // The legacy coverage index includes associated event endpoints. Their
    // presence does not mean a preparation task has its own deadline/time.
    const directTimes = category === 'time' && projected.timePoints.some(p => p.relatedTaskTempIds.includes(t.id)
      || p.relatedMaterialTempIds.some(id => projected.materials.some(m => m.tempId === id && m.relatedTaskTempIds.includes(t.id))))
    if (localizeMissingCoverage && category === 'time' && claim.status === 'not_stated' && !claim.absenceScopeIds.length
      && entities.length > 0 && !directTimes) {
      associatedEventTimes.push({ taskId: t.id, originalClaim: structuredClone(claim), timeIds: entities.map(e => e.tempId), reason: 'LEGACY_ASSOCIATED_EVENT_TIME_INDEX_ONLY' })
      return [category, { status: 'present', entityIds: entities.map(e => e.tempId), scopeIds: [...new Set(entities.flatMap(e => e.scopeIds))] }]
    }
    // The raw claim stays in audit. Only a demonstrably absent owner index may
    // become a guarded compatibility view; no owner or fact is synthesized.
    if (localizeMissingCoverage && claim.status === 'present' && entities.length === 0 && claim.absenceScopeIds.length === 0) {
      missingCoverage.push({ taskId: t.id, category, originalClaim: structuredClone(claim), code: 'MISSING_PRESENT_FACT' })
      return [category, { status: 'unknown', entityIds: [], scopeIds: t.propositionScopeIds }]
    }
    check(claim.status !== 'present' || entities.length > 0 && claim.absenceScopeIds.length === 0, 'MISSING_PRESENT_FACT')
    check(claim.status === 'present' || entities.length === 0, 'COVERAGE_OWNER_CONTRADICTION')
    return [category, { status: claim.status, entityIds: entities.map(e => e.tempId), scopeIds: claim.status === 'present' ? [...new Set(entities.flatMap(e => e.scopeIds))] : claim.absenceScopeIds }]
  })) as SourceContractV4['tasks'][number]['coverage'] }))
  projected.scopeAccounting = facts.scopeAccounting.map(row => ({ ...row, secondaryEntityIds: [...projected.materials, ...projected.timePoints].filter(e => e.scopeIds.includes(row.scopeId) && ('relatedMaterialTempIds' in e
    ? e.relatedTaskTempIds.some(id => row.primaryEntityIds.includes(id)) || e.relatedMaterialTempIds.some(id => projected.materials.some(m => m.tempId === id && m.relatedTaskTempIds.some(t => row.primaryEntityIds.includes(t)))) || projected.events.some(v => row.primaryEntityIds.includes(v.tempId) && [v.startTimePointTempId, v.endTimePointTempId].includes(e.tempId))
    : e.relatedTaskTempIds.some(id => row.primaryEntityIds.includes(id)))).map(e => e.tempId) }))
  const assembled = assembleSourceContractV4(projected, context)
  return { ...assembled, projected, audit: { version: SINGLE_AUTHORITY_VERSION, operation: 'EXPLICIT_OWNER_TO_ENDPOINT_AND_COVERAGE_INDEX', inferredFacts: 0, original: facts, localCoverage: { version: AUTHORITY_LOCAL_COVERAGE_VERSION, enabled: localizeMissingCoverage, missingCoverage, associatedEventTimes }, quarantinedOwners:quarantined,sourceWindows:facts.timePoints.filter(p=>p.type==='window_start'||p.type==='window_end').map(p=>({id:p.tempId,role:p.type,owners:p.owners})),timeOwners: facts.timePoints.map(p => ({ id: p.tempId, owners: p.owners })), projectedCoverage: projected.tasks.map(t => ({ id: t.id, coverage: t.coverage })) } }
}

export function decodeSingleAuthorityRecording(raw: string, context: WireContext, responseRole: 'EngineeringFixture' | 'SingleAuthority' = 'EngineeringFixture', localizeMissingCoverage=false) {
  check(new TextEncoder().encode(raw).byteLength <= 524288, 'RESPONSE_SIZE')
  const envelope = JSON.parse(raw)
  const messages = Array.isArray(envelope.output) ? envelope.output.filter((v: {type?:string}) => v.type === 'message') : []
  const texts = messages.flatMap((v: {content?:{type?:string;text?:string}[]}) => v.content?.filter(c=>c.type==='output_text') ?? [])
  check(texts.length === 1 && typeof texts[0].text === 'string', 'RESPONSE_TEXT')
  const text = texts[0].text as string
  const compiled = compileSingleAuthority(JSON.parse(text), context,true,localizeMissingCoverage)
  texts[0].text = JSON.stringify(compiled.projected)
  envelope.output = messages
  const decoded = decodeCurrentSourceRecording(JSON.stringify(envelope), 'EngineeringFixture', context)
  return { ...decoded, result: { ...decoded.result, promptVersion: SINGLE_AUTHORITY_PROMPT_VERSION, modelName:responseRole==='EngineeringFixture'?'匿名契约工程夹具（非模型输出）':'SingleAuthority 固定录制（非实时调用）' }, singleAuthorityAudit: compiled.audit,
    sidecar: { ...decoded.sidecar, singleAuthorityAudit: compiled.audit, originalResponse: raw } }
}

export const SINGLE_AUTHORITY_SYSTEM = `根据通知输出指定JSON。不得补常识、个人资格或已完成状态；不能用unknown代替原文明示的事实。
权威关系只声明一次：材料.relatedTaskTempIds声明材料所属任务；事件.relatedTaskTempIds声明相关任务；timePoints.owners声明每个时间的实际task/material/event_start/event_end所有者。不重复生成事件端点、任务实体清单、coverage实体或scope清单；程序从这些关系生成索引。共享时间须逐个列出真实owner，所有owner须有同一原文依据。依赖仅在任务detail.dependencyTempIds，修订仅在revisions，资格condition和前置prerequisiteStates分开。
coverage四态必须逐类明确：present需要真实实体及owner，absenceScopeIds为空；not_stated表示未提，explicit_none引用明确没有的片段，unknown保留未决。模糊、仅日期或未公布起止仍有time实体，rawText保留原文，日期由公共程序确定。日期窗口使用window_start/window_end，不把办理窗口写成deadline。没有任务也不能漏事件或时间。
一个活动只生成一个事件。形式、互动方式、地点附注、录取说明及结业结果放在该事件attributes，分别标format/participation/location_note/outcome并引用原文。不要把每句说明变成独立活动。另有明确独立活动、仪式或时间地点时分别生成事件，不能按名称相近自动合并。纯说明通过scopeAccounting信息表达。attributes.text逐字来自所引片段；事件名称、任务动作对象保留真实含义。
scopeAccounting逐片段只声明主任务/事件或information/unresolved。附属材料和时间引用由owner生成，不把scope当业务实体；没有主事实时不得伪造覆盖。材料格式、命名、渠道与完成标准完整保留；回执不能冒充提交渠道。关系端点不明保留冲突，资格未知不写true，“完成后”不证明已完成，禁止/取消不生成可执行动作。不生成个人计划或自动正式写入。仅输出JSON。`

export async function buildSingleAuthorityRequest(context: WireContext) {
  const base = await buildCandidate19Request(context)
  const body = structuredClone(base.body)
  body.input[0].content[0].text = SINGLE_AUTHORITY_SYSTEM
  body.text.format.schema = SINGLE_AUTHORITY_SCHEMA
  const serialized = JSON.stringify(body)
  check(new TextEncoder().encode(serialized).byteLength <= MAX_REQUEST_BYTES, 'REQUEST_SIZE')
  return { ...base, body, serialized, candidateVersion: SINGLE_AUTHORITY_CANDIDATE_VERSION, promptVersion: SINGLE_AUTHORITY_PROMPT_VERSION, componentVersion: SINGLE_AUTHORITY_VERSION, dispatchAuthorized: false as const }
}
