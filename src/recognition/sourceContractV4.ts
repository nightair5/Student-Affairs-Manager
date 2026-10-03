import { SOURCE_FACT_SCHEMA, SOURCE_FACT_VERSION, assembleSourceFacts, type SourceFacts } from '../experiments/realInput01/sourceFactsV3'
import { plainJson } from '../experiments/mainline04/semanticContract'
import { buildModelRequest, MAX_REQUEST_BYTES, type WireContext } from '../experiments/realInput01/modelWire'
import { decodeRecordedD26 } from './recordedProjectionD26'

export const SOURCE_CONTRACT_VERSION = 'explicit-source-contract-4.0.0' as const
export const SOURCE_CONTRACT_PROMPT_VERSION = 'recognition-source-contract-4.0.0' as const
export const LEGACY_DECLARATION_VERSION = 'recorded-explicit-declaration-2' as const
type Category = 'time' | 'material' | 'event'
export interface CoverageClaim { status: 'present' | 'not_stated' | 'explicit_none' | 'unknown'; entityIds: string[]; scopeIds: string[] }
export interface TypedAccounting { scopeId: string; kind: 'action' | 'event' | 'information' | 'unresolved'; primaryEntityIds: string[]; secondaryEntityIds: string[] }
export type SourceContractV4 = Omit<SourceFacts, 'schemaVersion' | 'tasks' | 'scopeAccounting' | 'informationScopeIds' | 'unresolvedScopeIds'> & {
  schemaVersion: typeof SOURCE_CONTRACT_VERSION
  tasks: Array<Omit<SourceFacts['tasks'][number], 'coverage'> & { coverage: Record<Category, CoverageClaim> }>
  scopeAccounting: TypedAccounting[]
}
export const SOURCE_CONTRACT_SCHEMA = structuredClone(SOURCE_FACT_SCHEMA)
SOURCE_CONTRACT_SCHEMA.properties!.schemaVersion = { type: 'string', const: SOURCE_CONTRACT_VERSION }
// One authority for source accounting; the two legacy indexes are program-generated views.
delete SOURCE_CONTRACT_SCHEMA.properties!.informationScopeIds
delete SOURCE_CONTRACT_SCHEMA.properties!.unresolvedScopeIds
SOURCE_CONTRACT_SCHEMA.required = SOURCE_CONTRACT_SCHEMA.required!.filter(k => !['informationScopeIds', 'unresolvedScopeIds'].includes(k))
const ids = { type: 'array', maxItems: 200, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 4000 } }
const claim = { type: 'object', additionalProperties: false, required: ['status', 'entityIds', 'scopeIds'], properties: {
  status: { type: 'string', enum: ['present', 'not_stated', 'explicit_none', 'unknown'] }, entityIds: ids, scopeIds: ids,
} }
SOURCE_CONTRACT_SCHEMA.properties!.tasks.items!.properties!.coverage = { type: 'object', additionalProperties: false, required: ['time', 'material', 'event'], properties: { time: claim, material: claim, event: claim } }
SOURCE_CONTRACT_SCHEMA.properties!.scopeAccounting = { type: 'array', maxItems: 200, items: { type: 'object', additionalProperties: false, required: ['scopeId', 'kind', 'primaryEntityIds', 'secondaryEntityIds'], properties: {
  scopeId: { type: 'string', minLength: 1, maxLength: 4000 }, kind: { type: 'string', enum: ['action', 'event', 'information', 'unresolved'] }, primaryEntityIds: ids, secondaryEntityIds: ids,
} } }
type Schema = typeof SOURCE_CONTRACT_SCHEMA
function matches(value: unknown, schema: Schema): boolean {
  if ('const' in schema) return value === schema.const
  if (schema.anyOf) return schema.anyOf.some(s => matches(value, s))
  if (schema.enum && !schema.enum.includes(value)) return false
  if (schema.type === 'null') return value === null
  if (schema.type === 'string') return typeof value === 'string' && value.length >= (schema.minLength ?? 0) && value.length <= (schema.maxLength ?? 4000)
  if (schema.type === 'number') return typeof value === 'number' && Number.isFinite(value) && value >= (schema.minimum ?? -Infinity) && value <= (schema.maximum ?? Infinity)
  if (schema.type === 'boolean') return typeof value === 'boolean'
  if (schema.type === 'array') return Array.isArray(value) && value.length <= (schema.maxItems ?? 200) && value.length >= (schema.minItems ?? 0) && (!schema.uniqueItems || new Set(value.map(v => JSON.stringify(v))).size === value.length) && value.every(v => matches(v, schema.items!))
  if (schema.type === 'object') return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === schema.required!.length && schema.required!.every(k => Object.hasOwn(value, k) && matches((value as Record<string, unknown>)[k], schema.properties![k]))
  return false
}
const check = (ok: unknown, code: string) => { if (!ok) throw Error('SOURCE_CONTRACT_' + code) }
const categories: Category[] = ['time', 'material', 'event']
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every(id => b.includes(id))
/** Ownership follows explicit authoritative edges, including event endpoints and material-owned times. */
function owned(facts: Pick<SourceFacts, 'materials' | 'timePoints' | 'events'>, taskId: string, category: Category) {
  const materials = facts.materials.filter(m => m.relatedTaskTempIds.includes(taskId)), events = facts.events.filter(e => e.relatedTaskTempIds.includes(taskId))
  if (category === 'material') return materials
  if (category === 'event') return events
  return facts.timePoints.filter(p => p.relatedTaskTempIds.includes(taskId) || p.relatedMaterialTempIds.some(id => materials.some(m => m.tempId === id)) || events.some(e => e.startTimePointTempId === p.tempId || e.endTimePointTempId === p.tempId))
}
function supportedSecondary(facts: Pick<SourceFacts, 'materials' | 'timePoints' | 'events'>, primaryIds: string[], secondaryId: string) {
  const material = facts.materials.find(m => m.tempId === secondaryId), point = facts.timePoints.find(p => p.tempId === secondaryId)
  if (material) return material.relatedTaskTempIds.some(id => primaryIds.includes(id))
  if (!point) return false
  return point.relatedTaskTempIds.some(id => primaryIds.includes(id)) || point.relatedMaterialTempIds.some(id => facts.materials.some(m => m.tempId === id && m.relatedTaskTempIds.some(t => primaryIds.includes(t)))) || facts.events.some(e => primaryIds.includes(e.tempId) && (e.startTimePointTempId === point.tempId || e.endTimePointTempId === point.tempId))
}

/** Validate claims, retain unknowns, then delegate the real schema/graph/adapter to the existing compiler. */
export function assembleSourceContractV4(input: unknown, context: WireContext) {
  const facts = plainJson(input) as SourceContractV4
  check(matches(facts, SOURCE_CONTRACT_SCHEMA), 'SHAPE')
  const known = new Set(context.index.scopes.map(s => s.id))
  const unknownCoverage: Array<{ taskId: string; category: Category; scopeIds: string[] }> = []
  const primaries = new Map<string, { kind: 'action' | 'event'; scopes: string[] }>([
    ...facts.tasks.map(t => [t.id, { kind: 'action', scopes: t.propositionScopeIds }] as const),
    ...facts.events.map(e => [e.tempId, { kind: 'event', scopes: e.scopeIds }] as const),
  ])
  const secondary = new Map([...facts.materials, ...facts.timePoints].map(e => [e.tempId, e.scopeIds]))
  for (const prerequisite of facts.prerequisiteStates) if (prerequisite.completion === 'true') {
    const predecessor = facts.tasks.find(t => t.id === prerequisite.predecessorId)
    const evidence = prerequisite.factScopeIds.flatMap(id => context.index.scopes.find(s => s.id === id)?.text ?? [])
    check(predecessor && evidence.some(text => text.includes(predecessor.object.surface)
      && /已(?:经)?[^，。；]{0,40}(?:完成|填妥|通过)|(?:完成|填妥|通过)[^，。；]{0,12}(?:了|已确认)/u.test(text)
      && !/若|如果|一旦|尚未|未|没有|(?:完成|填妥|通过)(?:之后|以后|后)/u.test(text)), 'CONDITIONAL_NOT_COMPLETION_PROOF')
  }
  for (const event of facts.events) for (const [id, type] of [[event.startTimePointTempId, 'event_start'], [event.endTimePointTempId, 'event_end']] as const) {
    if (id !== null) check(facts.timePoints.find(p => p.tempId === id)?.type === type, 'EVENT_TIME_TYPE')
  }
  for (const row of facts.scopeAccounting) {
    check(known.has(row.scopeId), 'UNKNOWN_SCOPE')
    if (row.kind === 'action' || row.kind === 'event') {
      check(row.primaryEntityIds.length > 0 && row.primaryEntityIds.every(id => primaries.get(id)?.kind === row.kind && primaries.get(id)?.scopes.includes(row.scopeId)), 'PRIMARY_REFERENCE')
      check(row.secondaryEntityIds.every(id => secondary.get(id)?.includes(row.scopeId) && supportedSecondary(facts, row.primaryEntityIds, id)), 'SECONDARY_REFERENCE')
    } else check(row.primaryEntityIds.length === 0 && row.secondaryEntityIds.length === 0, 'INFORMATION_ENTITY')
  }
  const legacy: SourceFacts = { ...facts, schemaVersion: SOURCE_FACT_VERSION,
    informationScopeIds: facts.scopeAccounting.filter(r => r.kind === 'information').map(r => r.scopeId),
    unresolvedScopeIds: facts.scopeAccounting.filter(r => r.kind === 'unresolved').map(r => r.scopeId),
    scopeAccounting: facts.scopeAccounting.map(({ scopeId, kind, primaryEntityIds }) => ({ scopeId, kind, entityIds: primaryEntityIds })),
    tasks: facts.tasks.map(t => {
      const coverage = {} as SourceFacts['tasks'][number]['coverage']
      for (const category of categories) {
        const declaration = t.coverage[category], entities = owned(facts, t.id, category)
        check(declaration.scopeIds.every(id => known.has(id)), 'COVERAGE_SCOPE')
        if (declaration.status === 'present') {
          check(entities.length > 0 && sameSet(declaration.entityIds, entities.map(e => e.tempId)), 'COVERAGE_ENTITY')
          check(declaration.scopeIds.length > 0 && declaration.scopeIds.every(id => entities.some(e => e.scopeIds.includes(id))), 'COVERAGE_EVIDENCE')
          coverage[category] = null
        } else {
          check(declaration.entityIds.length === 0 && entities.length === 0, 'COVERAGE_CONTRADICTION')
          check(declaration.status !== 'explicit_none' || declaration.scopeIds.length > 0, 'EXPLICIT_NONE_EVIDENCE_REQUIRED')
          coverage[category] = declaration.status === 'unknown' ? 'unresolved' : 'not_stated'
          if (declaration.status === 'unknown') unknownCoverage.push({ taskId: t.id, category, scopeIds: declaration.scopeIds })
        }
      }
      return { ...t, coverage }
    }),
  }
  const assembled = assembleSourceFacts(legacy, context)
  return { ...assembled, explicitFacts: facts, unknownCoverage, conversion: { ...assembled.conversion, version: SOURCE_CONTRACT_VERSION, operation: 'VALIDATED_TYPED_DECLARATIONS_AND_EXPLICIT_EDGE_INVERSES_ONLY', originalDeclarations: facts.tasks.map(t => ({ taskId: t.id, coverage: t.coverage })), typedAccounting: facts.scopeAccounting } }
}

/** Read-only migration of ambiguous old declarations. No missing event/time/material is constructed. */
export function declareLegacyRecordingV4(input: unknown) {
  const original = plainJson(input) as SourceFacts
  check(matches(original, SOURCE_FACT_SCHEMA), 'LEGACY_SHAPE')
  check(sameSet(original.informationScopeIds, original.scopeAccounting.filter(r=>r.kind==='information').map(r=>r.scopeId))
    && sameSet(original.unresolvedScopeIds, original.scopeAccounting.filter(r=>r.kind==='unresolved').map(r=>r.scopeId)), 'LEGACY_INFORMATION_CONFLICT')
  const missingDeclarations: Array<{ taskId: string; category: Category; legacyValue: unknown; disposition: 'UNKNOWN_NOT_NONE' }> = []
  const payload = Object.fromEntries(Object.entries(original).filter(([key]) => !['informationScopeIds', 'unresolvedScopeIds'].includes(key))) as Omit<SourceFacts, 'informationScopeIds' | 'unresolvedScopeIds'>
  const facts: SourceContractV4 = { ...payload, schemaVersion: SOURCE_CONTRACT_VERSION,
    tasks: original.tasks.map(t => ({ ...t, coverage: Object.fromEntries(categories.map(category => {
      const entities = owned(original, t.id, category), value = t.coverage[category]
      if (value === null && entities.length) return [category, { status: 'present', entityIds: entities.map(e => e.tempId), scopeIds: [...new Set(entities.flatMap(e => e.scopeIds))] }]
      if (value === null || value === 'unresolved' || value === 'not_extracted') {
        check(entities.length === 0, 'LEGACY_UNKNOWN_WITH_FACTS')
        missingDeclarations.push({ taskId: t.id, category, legacyValue: value, disposition: 'UNKNOWN_NOT_NONE' })
        return [category, { status: 'unknown', entityIds: [], scopeIds: [] }]
      }
      return [category, { status: 'not_stated', entityIds: [], scopeIds: [] }]
    })) as Record<Category, CoverageClaim> })),
    scopeAccounting: original.scopeAccounting.map(row => ({ scopeId: row.scopeId, kind: row.kind,
      primaryEntityIds: row.entityIds.filter(id => original.tasks.some(t => t.id === id) || original.events.some(e => e.tempId === id)),
      secondaryEntityIds: row.entityIds.filter(id => original.materials.some(m => m.tempId === id) || original.timePoints.some(p => p.tempId === id)),
    })),
  }
  for (const [i, row] of original.scopeAccounting.entries()) check(row.entityIds.length === facts.scopeAccounting[i].primaryEntityIds.length + facts.scopeAccounting[i].secondaryEntityIds.length, 'LEGACY_FAKE_REFERENCE')
  return { facts, audit: { version: LEGACY_DECLARATION_VERSION, role: 'POST_COMPARISON_PROGRAM_CONVERSION', inferredFacts: 0, originalFacts: original, missingDeclarations } }
}

/** Both arms use the ordinary bridge. Unknown coverage blocks only the affected task. */
export function decodeSourceContractRecording(rawHttpText: string, candidate: 'Candidate17' | 'Candidate18' | 'EngineeringFixture', context: WireContext) {
  check(new TextEncoder().encode(rawHttpText).byteLength <= 524288, 'RESPONSE_SIZE')
  if (candidate === 'Candidate17') {
    const bridge = decodeRecordedD26(rawHttpText, candidate, context)
    const unknownCoverage = bridge.originalAdapted.tasks.flatMap(t => categories.filter(category => t.coverage[category] === 'unresolved' || t.coverage[category] === 'not_extracted').map(category => ({ taskId: t.id, category, scopeIds: t.propositionScopeIds })))
    addCoverageGuards(bridge.result, unknownCoverage)
    return { ...bridge, coverageAudit: { legacy: null, declarations: bridge.originalAdapted.tasks.map(t => ({ taskId: t.id, coverage: t.coverage })), unknownCoverage } }
  }
  const envelope = JSON.parse(rawHttpText), output = envelope.output?.[0]?.content?.[0]
  check(typeof output?.text === 'string', 'RESPONSE_TEXT')
  const input = JSON.parse(output.text), legacy = candidate === 'Candidate18' ? declareLegacyRecordingV4(input) : null
  const converted = assembleSourceContractV4(legacy?.facts ?? input, context)
  output.text = JSON.stringify(converted.assembledWire)
  const bridge = decodeRecordedD26(JSON.stringify(envelope), 'Candidate17', context)
  addCoverageGuards(bridge.result, converted.unknownCoverage)
  return { ...bridge, result: { ...bridge.result, promptVersion: SOURCE_CONTRACT_PROMPT_VERSION, modelName: candidate === 'EngineeringFixture' ? '匿名契约工程夹具（非模型输出）' : `${candidate} 固定录制（非实时调用）` },
    conversion: converted.conversion, coverageAudit: { legacy: legacy?.audit ?? null, declarations: converted.explicitFacts.tasks.map(t => ({ taskId: t.id, coverage: t.coverage })), unknownCoverage: converted.unknownCoverage } }
}
function addCoverageGuards(result: ReturnType<typeof decodeRecordedD26>['result'], unknownCoverage: Array<{ taskId: string; category: Category; scopeIds: string[] }>) {
  const labels = { time: '时间', material: '材料', event: '关联事件' }
  for (const missing of unknownCoverage) {
    const message = `这项任务的${labels[missing.category]}覆盖未说明清楚，保留已有事实，请核对；不能当成原文没有。`
    const evidenceIds = missing.scopeIds.length ? missing.scopeIds.map(id => 'd26-' + id) : result.standaloneTasks.find(t => t.tempId === missing.taskId)?.evidenceIds ?? []
    result.conflicts.push({ id: `coverage:${missing.taskId}:${missing.category}`, type: 'other', message, entityTempIds: [missing.taskId], evidenceIds, requiresDecision: true })
    result.standaloneTasks.filter(t => t.tempId === missing.taskId).forEach(t => { t.selected = false })
    result.quality.needsHumanReview = true
    result.quality.reviewReasons.push(message)
  }
}

export const SOURCE_CONTRACT_SYSTEM = `逐片段建立通知事实，不补常识，不把材料单独当任务。先列独立事件与原文时间，再列动作对象、材料、资格、依赖和真实取消/替代端点。没有任务也要保留原文事件、信息和时间。
coverage 每类使用明确状态：present 必须有实际实体ID与其原文scope；not_stated 表示原文没提；explicit_none 表示原文明示没有并引用依据；unknown 表示尚未提取清楚，不能拿它代替已知事实。时间未公布或模糊仍应有time实体、保留rawText；不得把日期未知误写为没有时间。禁止用null表示coverage。
scopeAccounting 是逐片段覆盖的一份权威表达，信息/未决反向索引由程序生成，不再重复输出两份索引。将主实体primaryEntityIds和附属引用secondaryEntityIds分开。action主实体只能是真实任务，event主实体只能是真实事件；材料和时间只能是同片段且通过明确关系连接该主实体的附属引用。纯信息没有实体。不得凭空补主实体、跨scope/来源引用或把所有内容改unknown。
资格condition、前置任务completion和可开始状态分别表达；“完成后”不是当前已完成事实，缺完成证据为unknown，依赖待办仍保留。关系只提供权威一边，程序生成反向索引；不输出相互矛盾的两边。办理时间不是原截止；材料对象、格式和完成标准完整保留。修订只指真实旧新任务，端点不明明确待核对。
所有值和引用必须有本通知依据。仅输出指定JSON，不调用工具，不改变来源，不生成个人计划时间。`
/** Proposed generation input, not a candidate result or dispatch permission. */
export async function buildSourceContractRequest(context: WireContext) {
  const base = await buildModelRequest(context)
  base.body.input[0].content[0].text = SOURCE_CONTRACT_SYSTEM
  base.body.text.format.schema = SOURCE_CONTRACT_SCHEMA
  const body = { ...base.body, model: 'deepseek-flash' as const }
  const serialized = JSON.stringify(body)
  check(new TextEncoder().encode(serialized).byteLength <= MAX_REQUEST_BYTES, 'REQUEST_SIZE')
  return { ...base, body, serialized, componentVersion: SOURCE_CONTRACT_VERSION, promptVersion: SOURCE_CONTRACT_PROMPT_VERSION, dispatchAuthorized: false }
}
