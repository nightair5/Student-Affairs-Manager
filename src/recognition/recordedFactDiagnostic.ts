import type { SemanticInput, SemanticTask } from '../experiments/mainline04/semanticContract'
import type { WireContext } from '../experiments/realInput01/modelWire'

export const RECORDED_FACT_DIAGNOSTIC_VERSION = 'recorded-source-fact-diagnostic-1.0.0'
interface TaskFact { key: string; actions: string[]; objects: string[]; actionType: string; condition: string; fragments: string[]; dependencies: string[]; completion: string[][]; optionalCompletion?: string[] }
interface EventFact { key: string; names: string[]; fragments: string[]; location: string | null }
interface TimeFact { key: string; owner: string; endpoint: 'start' | 'end' | 'task'; type: string; token: string; value: string | null; precision: string; fragments: string[] }
interface MaterialFact { owner: string; names: string[]; fragments: string[]; formats: string[][]; naming: string[][]; channels: Array<string | null> }
export interface FactReference { sourceId: string; completeness: 'COMPLETE_MINIMUM_OBLIGATIONS' | 'PARTIAL'; tasks: TaskFact[]; events: EventFact[]; times: TimeFact[]; materials: MaterialFact[]; information: string[] }
const n = (s: string) => s.replace(/[\s，。；,:：;！!]/gu, '')
const eq = (s: string, alternatives: string[]) => alternatives.some(a => n(a) === n(s))
const task = (key: string, action: string, object: string, actionType: string, fragments: string[], condition = 'not_applicable', dependencies: string[] = []): TaskFact => ({key, actions:[action],objects:[object],actionType,condition,fragments,dependencies,completion:[]})
const time = (key: string, owner: string, endpoint: TimeFact['endpoint'], type: string, token: string, value: string | null, precision: string, fragments: string[]): TimeFact => ({key,owner,endpoint,type,token,value,precision,fragments})

// Hand-specified from the original source, not calculated by the tested time parser/adapter.
// Post-hoc, single-author/model-assisted provisional minimum obligations; not independent truth.
export const RECORDED_FACT_REFERENCES: FactReference[] = [
  {sourceId:'C19-DEV-S01',completeness:'COMPLETE_MINIMUM_OBLIGATIONS',tasks:[],events:[{key:'pause',names:['校园失物查询网站暂停查询','校园失物查询网站将在周日晚间暂停查询'],fragments:['校园失物查询网站将在周日晚间暂停查询'],location:null}],times:[time('pause-start','pause','start','event_start','周日晚间',null,'vague',['校园失物查询网站将在周日晚间暂停查询'])],materials:[],information:['此前登记的信息保持不变','不需要重新登记','也不要发送补充邮件']},
  {sourceId:'C19-DEV-S02',completeness:'COMPLETE_MINIMUM_OBLIGATIONS',tasks:[],events:[{key:'briefing',names:['开放实验室说明会'],fragments:['开放实验室说明会2026年11月12日10:10开始','11:40结束'],location:null},{key:'network',names:['网络调试'],fragments:['网络调试从周五夜间开始','恢复时间尚未公布'],location:null}],times:[time('briefing-start','briefing','start','event_start','2026年11月12日10:10','2026-11-12T10:10','exact',['开放实验室说明会2026年11月12日10:10开始']),time('briefing-end','briefing','end','event_end','11:40','2026-11-12T11:40','exact',['11:40结束']),time('network-start','network','start','event_start','周五夜间',null,'vague',['网络调试从周五夜间开始']),time('network-end','network','end','event_end','尚未公布',null,'vague',['恢复时间尚未公布'])],materials:[],information:['两件事仅供了解','不要求报名']},
  {sourceId:'C19-DEV-S03',completeness:'COMPLETE_MINIMUM_OBLIGATIONS',tasks:[task('fill','填写','场地使用登记','fill',['先填写场地使用登记']),task('submit','递交','场地使用登记','submit',['填好之后递交场地使用登记'],'not_applicable',['fill']),task('collect','领取','演示器材','collect',['器材领用资格还未公布','符合资格才能领取演示器材'],'unknown')],events:[],times:[],materials:[],information:[]},
  {sourceId:'C19-DEV-S04',completeness:'COMPLETE_MINIMUM_OBLIGATIONS',tasks:[{...task('save','保存','活动联系编号','save',['另请保存活动联系编号']),optionalCompletion:['活动联系编号已保存']}],events:[],times:[],materials:[],information:['本轮展位申请仅限获准社团','你的社团尚未获准','不能提交展位申请']},
  {sourceId:'C19-DEV-S05',completeness:'COMPLETE_MINIMUM_OBLIGATIONS',tasks:[{...task('upload','上传','志愿服务统计表','upload',['请在2026年11月13日09:25前上传志愿服务统计表','统计表须为PDF','文件名包含小组编号','看到平台显示接收成功才算办结']),completion:[['看到平台显示接收成功才算办结','平台显示接收成功后办结']]}],events:[{key:'training',names:['培训说明会'],fragments:['培训说明会2026年11月14日14:20开始','15:35结束'],location:null}],times:[time('deadline','upload','task','submission_deadline','2026年11月13日09:25','2026-11-13T09:25','exact',['请在2026年11月13日09:25前上传志愿服务统计表']),time('training-start','training','start','event_start','2026年11月14日14:20','2026-11-14T14:20','exact',['培训说明会2026年11月14日14:20开始']),time('training-end','training','end','event_end','15:35','2026-11-14T15:35','exact',['15:35结束'])],materials:[{owner:'upload',names:['志愿服务统计表','统计表'],fragments:['请在2026年11月13日09:25前上传志愿服务统计表','统计表须为PDF','文件名包含小组编号'],formats:[['PDF']],naming:[['文件名包含小组编号','文件名称含小组编号']],channels:[null]}],information:[]},
  {sourceId:'C19-DEV-S06',completeness:'COMPLETE_MINIMUM_OBLIGATIONS',tasks:[task('review','核对','储物柜编号','review',['请核对储物柜编号'])],events:[],times:[],materials:[],information:['本通知没有截止日期','不需要准备附件','也没有活动安排']},
]

/** Fact value, evidence and graph are checked separately; quotation boundaries alone are not values. */
export function diagnoseRecordedFacts(ref: FactReference, input: SemanticInput, context: WireContext) {
  const risks: Array<{kind:string;fact:string;detail?:unknown}> = [], disputes: Array<{kind:string;fact:string;detail?:unknown}> = []
  const checks: Array<{fact:string;actualId:string|null;category:string}> = []
  const risk = (kind:string,fact:string,detail?:unknown) => risks.push({kind,fact,...(detail === undefined ? {} : {detail})})
  const scope = new Map(context.index.scopes.map(s => [s.id,s]))
  const evidence = (fact:string, ids:string[], fragments:string[]) => {
    if (!ids.length || ids.some(id => !scope.has(id))) {risk('EVIDENCE_INVALID',fact);return}
    for (const id of ids) if (!fragments.some(q => n(scope.get(id)!.text) === n(q))) risk('EVIDENCE_WRONG_OBJECT_OR_CONTEXT',fact,{scopeId:id,text:scope.get(id)!.text})
  }
  if (input.sourceId !== context.index.sourceId || input.sourceVersionId !== context.index.sourceVersionId || input.sourceFingerprint !== context.index.sourceFingerprint) risk('CROSS_SOURCE_INPUT','source')
  if(ref.sourceId!==context.index.sourceId)disputes.push({kind:'REFERENCE_IDENTITY_MISMATCH',fact:'source'})
  const entityIds=[...input.tasks.map(t=>t.id),...input.events.map(e=>e.tempId),...input.timePoints.map(t=>t.tempId),...input.materials.map(m=>m.tempId)]
  if(new Set(entityIds).size!==entityIds.length)risk('ENTITY_ID_COLLISION','source')
  const referenceFragments = [...ref.tasks.flatMap(t=>t.fragments),...ref.events.flatMap(e=>e.fragments),...ref.times.flatMap(t=>t.fragments),...ref.materials.flatMap(m=>m.fragments),...ref.information]
  if (!referenceFragments.every(q=>n(context.index.sourceContent).includes(n(q)))) disputes.push({kind:'REFERENCE_SOURCE_MISMATCH',fact:'source'})
  const taskMap = new Map<string,SemanticTask>(), eventMap = new Map<string,SemanticInput['events'][number]>()
  const usedTasks = new Set<string>(),usedEvents = new Set<string>(),usedTimes = new Set<string>(),usedMaterials = new Set<string>()
  for(const expected of ref.tasks){
    const found=input.tasks.filter(t=>eq(t.action.surface,expected.actions)&&eq(t.object.surface,expected.objects))
    if(found.length!==1){risk(found.length?'DUPLICATE_TASK':'TASK_MISSING',expected.key);continue}
    const t=found[0];taskMap.set(expected.key,t);usedTasks.add(t.id);checks.push({fact:expected.key,actualId:t.id,category:'task'})
    evidence(expected.key,t.propositionScopeIds,expected.fragments)
    if(t.actionType!==expected.actionType||t.semantics.polarity!=='affirmative'||t.semantics.status!=='pending'||t.semantics.validity!=='active'||!['addressee','addressed_group'].includes(t.semantics.actor)||t.semantics.speechAct!=='directive'||t.semantics.modality!=='required'||!['present','future'].includes(t.semantics.tense)||t.inferenceLevel!=='explicit')risk('TASK_CURRENT_ACTION_WRONG',expected.key)
    evidence(expected.key+':action',[t.action.scopeId],expected.fragments)
    evidence(expected.key+':object',[t.object.scopeId],expected.fragments)
    if(!scope.get(t.action.scopeId)?.text.includes(t.action.surface)||!scope.get(t.object.scopeId)?.text.includes(t.object.surface))risk('ACTION_OBJECT_LITERAL_EVIDENCE_WRONG',expected.key)
    if(t.condition.value!==expected.condition)risk('APPLICABILITY_WRONG',expected.key,{expected:expected.condition,actual:t.condition.value})
    if(t.condition.value==='unknown'&&!t.condition.factScopeIds.length)risk('CONDITION_EVIDENCE_MISSING',expected.key)
    evidence(expected.key+':condition',[...new Set([...t.condition.factScopeIds,...t.condition.conditionScopeIds])].length ? [...new Set([...t.condition.factScopeIds,...t.condition.conditionScopeIds])] : t.propositionScopeIds,expected.fragments)
    for(const values of expected.completion)if(!t.detail.completionCriteria.some(s=>eq(s,values)))risk('COMPLETION_MISSING_OR_WRONG',expected.key)
    for(const s of t.detail.completionCriteria)if(!expected.completion.some(values=>eq(s,values))&&!eq(s,expected.optionalCompletion??[]))risk('UNSUPPORTED_COMPLETION',expected.key,{actual:s})
  }
  for(const t of input.tasks)if(!usedTasks.has(t.id))risk('UNSUPPORTED_TASK',t.id,{action:t.action.surface,object:t.object.surface,condition:t.condition.value})
  for(const expected of ref.tasks){const t=taskMap.get(expected.key);if(!t)continue
    const dep=expected.dependencies.map(key=>taskMap.get(key)?.id),actual=t.detail.dependencyTempIds
    if(dep.some(id=>!id)||dep.length!==actual.length||actual.some(id=>!dep.includes(id)))risk('DEPENDENCY_ENDPOINT_WRONG',expected.key)
    for(const id of actual)if(input.tasks.find(p=>p.id===id)?.semantics.status==='completed')risk('PREREQUISITE_FALSE_COMPLETION',expected.key)
  }
  for(const expected of ref.events){const found=input.events.filter(e=>eq(e.title,expected.names));if(found.length!==1){risk(found.length?'DUPLICATE_EVENT':'EVENT_MISSING',expected.key);continue}
    const e=found[0];eventMap.set(expected.key,e);usedEvents.add(e.tempId);checks.push({fact:expected.key,actualId:e.tempId,category:'event'});evidence(expected.key,e.scopeIds,expected.fragments)
    if(e.location!==expected.location)risk('EVENT_LOCATION_WRONG',expected.key)
    if(e.relatedTaskTempIds.length)risk('EVENT_WRONG_TASK_OWNER',expected.key)
  }
  for(const e of input.events)if(!usedEvents.has(e.tempId))risk('UNSUPPORTED_EVENT',e.tempId)
  for(const expected of ref.times){
    const owner=expected.endpoint==='task'?taskMap.get(expected.owner):eventMap.get(expected.owner)
    const id=expected.endpoint==='task' ? input.timePoints.find(p=>p.relatedTaskTempIds.includes(taskMap.get(expected.owner)?.id??'')&&p.type===expected.type)?.tempId
      : expected.endpoint==='start' ? eventMap.get(expected.owner)?.startTimePointTempId : eventMap.get(expected.owner)?.endTimePointTempId
    const p=input.timePoints.find(t=>t.tempId===id)
    if(!owner||!p){risk('TIME_MISSING_OR_ENDPOINT_WRONG',expected.key);continue}
    usedTimes.add(p.tempId);checks.push({fact:expected.key,actualId:p.tempId,category:'time'});evidence(expected.key,p.scopeIds,expected.fragments)
    const quotes=p.scopeIds.flatMap(id=>scope.get(id)?.text??[])
    if(!n(p.rawText).includes(n(expected.token))||!quotes.some(q=>n(q).includes(n(p.rawText))))risk('TIME_EVIDENCE_VALUE_WRONG',expected.key,{rawText:p.rawText})
    if(p.normalizedValue!==expected.value||p.precision!==expected.precision||p.timezone!==context.timezone||p.type!==expected.type||p.isAllDay||p.needsConfirmation!==(expected.value===null))risk('TIME_VALUE_TYPE_PRECISION_WRONG',expected.key,{expected,actual:p})
    if(expected.endpoint!=='task'&&p.relatedTaskTempIds.length)risk('TIME_WRONG_TASK_OWNER',expected.key)
    if(expected.endpoint==='task'&&(p.relatedTaskTempIds.length!==1||p.relatedTaskTempIds[0]!==taskMap.get(expected.owner)?.id||!taskMap.get(expected.owner)?.detail.timePointTempIds.includes(p.tempId)))risk('TIME_TASK_GRAPH_WRONG',expected.key)
    for(const mid of p.relatedMaterialTempIds)if(!input.materials.find(m=>m.tempId===mid&&m.relatedTaskTempIds.includes(taskMap.get(expected.owner)?.id??'')))risk('TIME_MATERIAL_OWNER_WRONG',expected.key)
  }
  for(const p of input.timePoints)if(!usedTimes.has(p.tempId))risk('UNSUPPORTED_OR_WRONG_TYPE_TIME',p.tempId)
  for(const expected of ref.materials){const owner=taskMap.get(expected.owner),found=input.materials.filter(m=>eq(m.name,expected.names)&&m.relatedTaskTempIds.includes(owner?.id??''));if(found.length!==1){risk('MATERIAL_MISSING_OR_WRONG_OWNER',expected.owner);continue}
    const m=found[0];usedMaterials.add(m.tempId);evidence(expected.owner+':material',m.scopeIds,expected.fragments)
    if(!m.required||m.relatedTaskTempIds.length!==1||!owner?.detail.materialTempIds.includes(m.tempId))risk('MATERIAL_GRAPH_OR_REQUIREMENT_WRONG',expected.owner)
    for(const [values,actual,field] of [[expected.formats,m.formatRequirements,'format'],[expected.naming,m.namingRequirements,'naming']] as const){
      if(values.length!==actual.length||values.some(group=>!actual.some(s=>eq(s,group))))risk('MATERIAL_FIELD_WRONG',expected.owner,{field,actual})
    }
    if(!expected.channels.includes(m.submissionChannel))disputes.push({kind:'MATERIAL_CHANNEL_NOT_EXPLICITLY_RESOLVED',fact:expected.owner,detail:m.submissionChannel})
    if(m.quantity!==null)risk('MATERIAL_QUANTITY_UNSUPPORTED',expected.owner)
  }
  for(const m of input.materials)if(!usedMaterials.has(m.tempId))risk('UNSUPPORTED_MATERIAL',m.tempId)
  for(const expected of ref.tasks){const t=taskMap.get(expected.key);if(!t)continue
    const times=input.timePoints.filter(p=>p.relatedTaskTempIds.includes(t.id)).map(p=>p.tempId),materials=input.materials.filter(m=>m.relatedTaskTempIds.includes(t.id)).map(m=>m.tempId)
    const same=(a:string[],b:string[])=>a.length===b.length&&new Set(a).size===a.length&&a.every(id=>b.includes(id))
    if(!same(t.detail.timePointTempIds,times)||!same(t.detail.materialTempIds,materials)||t.eventTempIds.length||t.detail.parentTempId!==null)risk('TASK_REVERSE_GRAPH_WRONG',expected.key)
    for(const [category,present] of [['time',ref.times.some(p=>p.owner===expected.key&&p.endpoint==='task')],['material',ref.materials.some(m=>m.owner===expected.key)],['event',false]] as const){
      if(t.coverage[category] !== (present?'present':'not_stated'))risk('TASK_COVERAGE_WRONG',expected.key,{category})
    }
  }
  // Related evidence must be a known minimum fact/support; arbitrary scope supersets are not accepted.
  const accounted=new Set([...input.informationScopeIds,...input.tasks.flatMap(t=>t.propositionScopeIds),...input.events.flatMap(e=>e.scopeIds),...input.timePoints.flatMap(t=>t.scopeIds),...input.materials.flatMap(m=>m.scopeIds)])
  for(const q of ref.information)if(!context.index.scopes.some(s=>n(s.text)===n(q)&&accounted.has(s.id)))risk('INFORMATION_MISSING',q)
  for(const id of input.informationScopeIds)if(!scope.has(id)||!referenceFragments.some(q=>n(q)===n(scope.get(id)!.text)))risk('INFORMATION_UNSUPPORTED',id)
  if(input.revisions.length)risk('UNSUPPORTED_REVISION','source')
  if(input.conflicts.some(c=>c.requiresDecision)||input.unresolvedScopeIds.length)disputes.push({kind:'UNRESOLVED_SOURCE_OR_GRAPH',fact:'source'})
  const completeStatus=risks.length?'FACT_ERROR':disputes.length||ref.completeness==='PARTIAL'?'UNKNOWN':'PROVISIONAL_STRUCTURED_PASS'
  return {version:RECORDED_FACT_DIAGNOSTIC_VERSION,role:'POST_HOC_OLD_RECORDING_FACT_DIAGNOSIS_NOT_NEW_MODEL_EFFECT',truth:'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL',completeStatus,risks,disputes,checks,freeProseAndLeakage:'NOT_ADJUDICATED',wholeUserOutputCorrect:'NOT_OBSERVABLE'}
}
