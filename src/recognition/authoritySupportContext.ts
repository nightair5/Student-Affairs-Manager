import { plainJson } from '../experiments/mainline04/semanticContract'
import type { WireContext } from '../experiments/realInput01/modelWire'
import type { SingleAuthorityFacts } from './sourceContractV5'
import { hasLiteralScopeSpan } from './authorityLiteralSupport'

export const AUTHORITY_SUPPORT_CONTEXT_VERSION = 'authority-support-context-1.0.0'
export const AUTHORITY_TYPED_SUPPORT_CONTEXT_VERSION = 'authority-support-context-1.5.0'
const text = (s: string) => s.replace(/[\s，。；,:：;！!]/gu, '')
const check = (ok: unknown) => { if (!ok) throw Error('AUTHORITY_SUPPORT_CONTEXT_REFERENCE') }

/** A model's information row can name an existing task as context, not as a
 * new action. Keep the original declaration in audit; derive the legacy empty
 * information index only for literal, independently grounded support. */
export function projectAuthoritySupportContext(input: unknown, context: WireContext, allowTypedSupport = false) {
  const original = plainJson(input) as SingleAuthorityFacts, projected = structuredClone(original)
  check(Array.isArray(projected.scopeAccounting) && Array.isArray(projected.tasks))
  const changes: Array<{ scopeId: string; taskId: string; reason: 'LITERAL_SUPPORT' | 'URL_CONTINUATION' | 'TYPED_ATTRIBUTE_SUPPORT' | 'EXPLICIT_STATE_OR_RECEIPT_SUPPORT' | 'DECLARED_PREREQUISITE_CONTEXT' }> = []
  const omittedScopes: Array<{ scopeId: string; kind: 'information' | 'unresolved'; reason: 'PAIRED_STRUCTURAL_LABEL' | 'UNACCOUNTED_SCOPE' }> = []
  const prerequisiteSupport=(id:string,scopeId:string)=>{
    const scope=context.index.scopes.find(s=>s.id===scopeId),verb=scope?.text.match(/^(登记|报名|领取|提交|办理|申请|预约)(?:提交|完成|成功)?后[，。；]?$/u)?.[1]
    const t=original.tasks.find(t=>t.id===id)
    return allowTypedSupport&&!!verb&&!!t&&original.prerequisiteStates.some(p=>p.taskId===id&&p.completion==='unknown'&&p.factScopeIds.includes(scopeId)&&t.detail.dependencyTempIds.includes(p.predecessorId)&&original.tasks.some(pre=>pre.id===p.predecessorId&&(pre.action.surface.includes(verb)||pre.action.surface==='完成'&&pre.object.surface.endsWith(verb))))
  }
  for (const row of projected.scopeAccounting) {
    // A short "领取后" clause is an already declared unknown predecessor
    // context, never another submitted action. Do not reclassify full directives.
    if(allowTypedSupport&&row.kind==='action'&&row.primaryEntityIds.length&&row.primaryEntityIds.every(id=>prerequisiteSupport(id,row.scopeId))){row.kind='information'}
    if (row.kind !== 'information' || !row.primaryEntityIds.length) continue
    const scope = context.index.scopes.find(s => s.id === row.scopeId)
    check(scope && new Set(row.primaryEntityIds).size === row.primaryEntityIds.length)
    for (const id of row.primaryEntityIds) {
      const task = original.tasks.find(t => t.id === id)
      if (!task && allowTypedSupport) {
        const point = original.timePoints.find(p => p.tempId === id)
        const event = original.events.find(e => e.tempId === id)
        const material=original.materials.find(m=>m.tempId===id)
        // This changes only the legacy information index. The real entity,
        // owners and their separate source/type checks remain intact downstream.
        const valueScopes = point?.scopeIds.filter(id => context.index.scopes.find(s => s.id === id)?.text.includes(point.rawText)) ?? []
        // A window may cite its literal date plus an explicit owner-reference
        // clause. Separate those existing citations; do not invent an owner.
        const windowReference = point && ['window_start', 'window_end'].includes(point.type)
          && valueScopes.length > 0 && hasLiteralScopeSpan(point.rawText, valueScopes, context)
          && [...context.index.sourceContent.matchAll(/(?:\d{4}年)?\d{1,2}月\d{1,2}日?\s*[—–－\-~～至]\s*(?:\d{4}年)?(?:\d{1,2}月)?\d{1,2}日/gu)].length === 1
          && point.scopeIds.every(id => valueScopes.includes(id) || context.index.scopes.some(s => s.id === id
            && /(?:在|于)(?:上述|该|指定)(?:时间|时段|办理窗口)(?:内|期间)/u.test(s.text)
            && !/(?:不|无需|不要|不得|禁止).{0,5}(?:在|于)/u.test(s.text)))
          && point.owners.length > 0 && point.owners.every(o => o.kind === 'task' && original.tasks.some(t => t.id === o.entityId
            && t.propositionScopeIds.some(id => context.index.scopes.some(s => s.id === id
              && /(?:在|于)(?:上述|该|指定)(?:时间|时段|办理窗口)(?:内|期间)/u.test(s.text)
              && !/(?:不|无需|不要|不得|禁止).{0,5}(?:在|于)/u.test(s.text)))))
        const timeSupport = point && point.scopeIds.includes(row.scopeId)
          && (windowReference || hasLiteralScopeSpan(point.rawText, point.scopeIds.filter(s => context.index.scopes.find(v => v.id === s)?.text && !/^[^\d]*[:：]$/u.test(context.index.scopes.find(v => v.id === s)!.text)), context))
        // Nested attributes already declare their owner. Their valid literal
        // citations derive the inverse event index in the next stage; requiring
        // that duplicate index here rejected an otherwise supported attribute.
        const eventSupport = event && event.attributes.some(a => a.scopeIds.includes(row.scopeId)
          && hasLiteralScopeSpan(a.text, a.scopeIds, context))
        // A material cites its name, format and naming clauses together. Each
        // value must use its contributing citation, not require unrelated
        // attribute clauses to overlap the same occurrence of the name.
        const materialLiteral=(value:string)=>!!material&&material.scopeIds.some(id=>hasLiteralScopeSpan(value,[id],context))
        const previousMaterialScope=context.index.scopes.find(s=>s.order===scope!.order-1)
        const materialAttributeOwner=material&&(scope!.text.includes(material.name)
          ||/^(?:文件名|命名|格式|数量)/u.test(scope!.text)&&!!previousMaterialScope&&material.scopeIds.includes(previousMaterialScope.id)&&previousMaterialScope.text.includes(material.name))
          &&/(?:须为|格式|文件名|命名|数量)/u.test(scope!.text)
          &&!/(?:另|还|另外)(?:需|须|要).{0,8}(?:提交|领取|缴费|准备|办理)/u.test(scope!.text)
        const materialSupport=material&&material.scopeIds.includes(row.scopeId)&&material.relatedTaskTempIds.length>0&&material.relatedTaskTempIds.every(id=>original.tasks.some(t=>t.id===id))
          &&materialLiteral(material.name)&&materialAttributeOwner
          &&!original.materials.some(m=>m.tempId!==material.tempId&&scope!.text.includes(m.name)&&!scope!.text.includes(material.name))
          &&[material.name,...material.formatRequirements,...material.namingRequirements,material.submissionChannel??''].filter(Boolean).some(value=>hasLiteralScopeSpan(value,[row.scopeId],context))
        check(timeSupport || eventSupport || materialSupport)
        changes.push({ scopeId: row.scopeId, taskId: id, reason: 'TYPED_ATTRIBUTE_SUPPORT' })
        continue
      }
      check(task)
      // Derive an omitted inverse index from an existing exact receipt criterion
      // or explicitly cited unknown personal-state declaration. Neither creates
      // an obligation, changes qualification, nor classifies arbitrary prose.
      const receiptAction=scope!.text.match(/^(报名|登记|提交|办理|申请|预约)(?:成功|办结|完成)以.+为准[。；]?$/u)?.[1]
        ??scope!.text.match(/^收到[^，。；]{1,60}才算(报名|登记|提交|办理|申请|预约)完成[。；]?$/u)?.[1]
      const receiptSupport = allowTypedSupport && receiptAction
        && (task!.action.surface.includes(receiptAction)||task!.object.surface.includes(receiptAction))
        && task!.detail.completionCriteria.some(c=>hasLiteralScopeSpan(c,[row.scopeId],context)&&text(c).includes(text(scope!.text)))
      const unknownStateSupport = allowTypedSupport && task!.condition.value==='unknown'
        && task!.condition.conditionScopeIds.includes(row.scopeId)&&task!.condition.factScopeIds.includes(row.scopeId)
        && /^是否.{1,30}(?:尚未|还未|未)(?:公布|通知|确定)[。；]?$/u.test(scope!.text)
      const declaredPrerequisite=prerequisiteSupport(id,row.scopeId)
      check(task!.propositionScopeIds.includes(row.scopeId)||receiptSupport||unknownStateSupport||declaredPrerequisite)
      const action = context.index.scopes.find(s => s.id === task!.action.scopeId)
      const object = context.index.scopes.find(s => s.id === task!.object.scopeId)
      check(action?.text.includes(task!.action.surface) && object?.text.includes(task!.object.surface)
        && original.scopeAccounting.some(r => r.kind === 'action' && r.primaryEntityIds.includes(id)
          && task!.propositionScopeIds.includes(r.scopeId)))
      // A primary directive cannot be reclassified as information.
      check(row.scopeId !== task!.action.scopeId && row.scopeId !== task!.object.scopeId)
      if(receiptSupport||unknownStateSupport||declaredPrerequisite){
        const target=projected.tasks.find(t=>t.id===id)!
        target.propositionScopeIds=[...new Set([...target.propositionScopeIds,row.scopeId])]
        if(!target.detail.description.includes(scope!.text))target.detail.description=[target.detail.description,scope!.text].filter(Boolean).join('\n')
        changes.push({scopeId:row.scopeId,taskId:id,reason:declaredPrerequisite?'DECLARED_PREREQUISITE_CONTEXT':'EXPLICIT_STATE_OR_RECEIPT_SUPPORT'})
        continue
      }
      const literal = text(scope!.text), previous = context.index.scopes.find(s => s.order === scope!.order - 1)
      const url = /^\/\/[A-Za-z0-9.-]+\//u.test(scope!.text) && previous?.text.endsWith('https:')
        && task!.propositionScopeIds.includes(previous.id) && previous.id === action!.id
      const completion = /^(?:并)?确保/u.test(scope!.text) && task!.detail.completionCriteria
        .some(c => text(c).includes(literal.replace(allowTypedSupport ? /^(?:并)?确保/u : /^并/u, '')))
      const condition = task!.condition.value === 'unknown' && task!.condition.conditionScopeIds.includes(row.scopeId)
        && (allowTypedSupport ? /如|若|如果|仅|条件|尚未|有意|感兴趣|符合|适用|资格|被录取/u : /如|若|如果|仅|条件|尚未/u).test(scope!.text) && text(task!.detail.description).includes(literal)
      const classification = /^视同[^，。；]{1,40}管理[，。；]$/u.test(scope!.text)
        && previous && task!.condition.value === 'unknown' && task!.condition.conditionScopeIds.includes(previous.id)
        && task!.propositionScopeIds.includes(previous.id) && text(task!.detail.description).includes(literal)
      const supported = literal.length > 0 && (completion || condition || classification)
      const punctuatedCondition = allowTypedSupport && task!.condition.value === 'unknown' && task!.condition.conditionScopeIds.includes(row.scopeId)
        && /有意|感兴趣|符合|适用|资格|被录取/u.test(scope!.text)
        && text(task!.detail.description).replace(/[（）()“”"]/gu, '').includes(literal.replace(/[（）()“”"]/gu, ''))
      check(url || supported || punctuatedCondition)
      changes.push({ scopeId: row.scopeId, taskId: id, reason: url ? 'URL_CONTINUATION' : 'LITERAL_SUPPORT' })
    }
    row.primaryEntityIds = []
  }
  if (allowTypedSupport) for (const scope of context.index.scopes) {
    if (projected.scopeAccounting.some(r => r.scopeId === scope.id)) continue
    const next = context.index.scopes.find(s => s.order === scope.order + 1)
    const heading = scope.text.match(/^\*\*(时间|地点|报名)\*\*$/u)?.[1]
    const paired = next && (heading === '时间' ? original.timePoints.some(p => p.scopeIds.includes(next.id))
      : heading === '地点' ? original.events.some(e => e.scopeIds.includes(next.id) && !!e.location?.trim() && next.text.includes(e.location))
      : heading === '报名' ? original.tasks.some(t => t.propositionScopeIds.includes(next.id) && t.action.scopeId === next.id)
      : scope.text === '活动信息' && next.text === '**时间**' && original.events.length > 0)
    const kind = paired ? 'information' as const : 'unresolved' as const
    projected.scopeAccounting.push({ scopeId: scope.id, kind, primaryEntityIds: [] })
    omittedScopes.push({ scopeId: scope.id, kind, reason: paired ? 'PAIRED_STRUCTURAL_LABEL' : 'UNACCOUNTED_SCOPE' })
  }
  return { projected, audit: { version: allowTypedSupport ? AUTHORITY_TYPED_SUPPORT_CONTEXT_VERSION : AUTHORITY_SUPPORT_CONTEXT_VERSION, inferredFacts: 0,
    operation: 'EXISTING_TASK_SUPPORT_TO_LEGACY_INFORMATION_INDEX', changes, omittedScopes, original } }
}
