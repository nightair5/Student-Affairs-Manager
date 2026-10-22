import {normalizeRecognitionResult} from './recognition.mjs'
import {parseChineseTimeAst} from './chinese-time-ast.generated.mjs'
import {resolveLiteralSourceSpan} from './recognition-literal-evidence.mjs'
import {deadlineRangeRoleIssue} from './deadline-range-role.mjs'
import {TWO_STEP_VERSION,validateTwoStep} from './recognition-two-step-contract.mjs'
const norm=s=>String(s??'').replace(/\s/gu,''),verbs='填写并发送|下载并填写|撰写并提交|确认并提交|提交|上传|发送|填写|申请|报名|选课|缴纳|缴费|领取|归还|确认|核对|办理|完成|撰写|参加|准备|签署|打印|出示|登记|注册|预约|学习'
const types=new Set(['截止','开始','结束','办理时段','地点','材料','渠道','条件','取消','变更'])
export function alignTwoStepQuote(quote,source){
 if(typeof quote!=='string'||!quote.trim()||quote.length>500)return null
 const at=source.indexOf(quote);if(at>=0)return source.indexOf(quote,at+1)<0?{literal:quote,start:at,end:at+quote.length,rule:'EXACT_UNIQUE_SOURCE_SPAN'}:null
 const span=resolveLiteralSourceSpan(quote,source);return span?{...span,rule:'UNIQUE_REVERSIBLE_TYPOGRAPHY_SPAN'}:null
}
const sentenceAt=(span,source)=>{const before=source.slice(0,span.start),left=Math.max(before.lastIndexOf('。'),before.lastIndexOf('；'),before.lastIndexOf(';'))+1,tail=source.slice(span.end).search(/[。；;]/u),end=tail<0?source.length:span.end+tail+1;return{start:left,end,text:source.slice(left,end)}}
const sameSentence=(a,b,source)=>{const left=Math.min(a.start,b.start),right=Math.max(a.end,b.end);return !/[。；;！？!?]/u.test(source.slice(left,right))}
const valueOf=(q,type)=>q.replace(new RegExp('^(?:活动)?'+type+'[：:]\\s*','u'),'').replace(/^[在至到]\s*/u,'').replace(/(?:举办|举行|办理)[。；;]?$/u,'').replace(/[。；;]$/u,'').trim()
export function compileTwoStep(raw,{source,referenceTime,timezone='Asia/Shanghai',model='deepseek-v4-flash',version=TWO_STEP_VERSION}){
 const check=validateTwoStep(raw);if(!check.valid)return{result:null,audit:{version,rootFailure:true,losses:check.errors},rootFailure:true}
 const result=normalizeRecognitionResult({schemaVersion:'2.0',sourceSummary:{title:'通知建议',sourceType:'text',notificationType:'teacher_task',summary:'',requiresAction:false},projectMatch:{decision:'standalone_task'},standaloneTasks:[],events:[],materials:[],timePoints:[],evidence:[]},source,referenceTime,model,version,true,timezone)
 const audit={version,mode:'MODEL_SEMANTIC_FACTS_THEN_DETERMINISTIC_STRUCTURE',rootFailure:false,inferredFacts:0,items:[],facts:[],losses:[],offsets:[],calls:1},declared=new Map(),usedIds=new Set(),pending=[]
 const evidence=(span,field)=>{let e=result.evidence.find(e=>e.textStart===span.start&&e.textEnd===span.end&&e.field===field);if(!e){e={id:'g2-e'+(result.evidence.length+1),sourceId:'pending-source',quote:span.literal,quotedText:span.literal,textStart:span.start,textEnd:span.end,field,extractionMethod:'parser',confidence:1};result.evidence.push(e)}return e.id}
 const note=(layer,id,reason,quote)=>{audit.losses.push({layer,id,reason,quote});pending.push({layer,id,reason})}
 for(const [i,item]of raw.items.entries()){
  const span=alignTwoStepQuote(item?.quote,source),valid=item&&typeof item.id==='string'&&item.id.length<=40&&typeof item.name==='string'&&item.name.trim().length>0&&item.name.length<=120&&['任务','活动','信息'].includes(item.kind)&&!Object.keys(item).some(k=>!['id','kind','name','quote'].includes(k))
  if(!valid||usedIds.has(item.id)){note('ITEM_STRUCTURE',item?.id??String(i),'INVALID_OR_DUPLICATE_ITEM',item?.quote);continue}usedIds.add(item.id)
  if(!span){note('ALIGNMENT',item.id,'ITEM_QUOTE_NOT_UNIQUELY_ALIGNED',item.quote);continue}
  const record={id:item.id,kind:item.kind,name:item.name,span,entity:null};declared.set(item.id,record);audit.items.push({id:item.id,name:item.name,kind:item.kind,start:span.start,end:span.end,status:'ALIGNED_MODEL_PROPOSAL_NOT_INDEPENDENT_SEMANTIC_TRUTH'});audit.offsets.push(span)
  const eid=evidence(span,item.kind==='活动'?'event':item.kind==='任务'?'description':'description')
  if(item.kind==='信息'){result.ignoredContent.push({text:span.literal,reason:'other'});continue}
  if(/取消|不再|无需|无须|不必|不得|禁止|请勿/u.test(sentenceAt(span,source).text)&&!/改为|调整至|变更为/u.test(sentenceAt(span,source).text)){result.ignoredContent.push({text:span.literal,reason:'policy'});note('POLARITY',item.id,'CANCELLED_OR_NEGATED_ITEM_NOT_EXECUTABLE',item.quote);continue}
  const tempId='g2-'+(i+1)
  if(item.kind==='任务'){
   const match=new RegExp('^('+verbs+')(?:\\s*)?(.+)$','u').exec(item.name.trim());if(!match){note('ITEM_STRUCTURE',item.id,'TASK_NEEDS_ACTION_AND_OBJECT',item.quote);continue}
   const objectSupported=norm(span.literal).includes(norm(match[2]));if(!objectSupported){note('ITEM_STRUCTURE',item.id,'TASK_OBJECT_NOT_LITERAL_IN_OWN_QUOTE',item.quote);continue}
   record.entity={tempId,parentTempId:null,hierarchyType:'task',title:item.name,actionVerb:match[1],actionObject:match[2],description:span.literal,completionCriteria:[],estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:[],materialTempIds:[],timePointTempIds:[],evidenceIds:[eid],confidence:.8,inferenceLevel:'explicit',userConfirmationRequired:true,selected:true};result.standaloneTasks.push(record.entity)
  }else{if(!norm(span.literal).includes(norm(item.name))){note('ITEM_STRUCTURE',item.id,'EVENT_NAME_NOT_LITERAL_IN_OWN_QUOTE',item.quote);continue}record.entity={tempId,title:item.name,description:span.literal,startTimePointTempId:null,endTimePointTempId:null,location:null,relatedTaskTempIds:[],evidenceIds:[eid],confidence:.8,inferenceLevel:'explicit',selected:true};result.events.push(record.entity)}
 }
 const staged=[]
 for(const [i,fact]of raw.facts.entries()){
  if(!fact||!types.has(fact.type)||!['string','object'].includes(typeof fact.item)||typeof fact.item==='object'&&fact.item!==null||Object.keys(fact).some(k=>!['type','quote','item'].includes(k))){note('FACT_STRUCTURE',String(i),'INVALID_TYPED_FACT',fact?.quote);continue}
  const span=alignTwoStepQuote(fact.quote,source);if(!span){note('ALIGNMENT',String(i),'FACT_QUOTE_NOT_UNIQUELY_ALIGNED',fact.quote);continue}
  let owner=declared.get(fact.item)
  if(!owner&&fact.item===null){const options=[...declared.values()].filter(r=>r.entity&&sameSentence(r.span,span,source));if(options.length===1)owner=options[0]}
  if(!owner?.entity){note('OWNERSHIP',String(i),'FACT_OWNER_MISSING_OR_AMBIGUOUS',fact.quote);continue}
  const neighbours=[...declared.values()].filter(r=>r.entity&&sameSentence(r.span,span,source));if(neighbours.length===1&&neighbours[0].id!==owner.id){note('OWNERSHIP',String(i),'FACT_CONTRADICTS_UNIQUE_SOURCE_SENTENCE_OWNER',fact.quote);continue}
  const eid=evidence(span,['截止','开始','结束','办理时段'].includes(fact.type)?'deadline':fact.type==='材料'?'materials':fact.type==='条件'?'requirement':'description')
  staged.push({type:fact.type,span,owner,eid});owner.entity.evidenceIds=[...new Set([...owner.entity.evidenceIds,eid])];audit.facts.push({type:fact.type,item:owner.id,start:span.start,end:span.end,status:'ALIGNED_AND_OWNED'})
 }
 const point=(entry,role,ast,value)=>{const owner=entry.owner.entity,p={tempId:'g2-p'+(result.timePoints.length+1),type:role,rawText:entry.span.literal,normalizedValue:value??null,timezone,isAllDay:ast.isAllDay,precision:ast.precision,needsConfirmation:ast.needsConfirmation||!value,relatedTaskTempIds:entry.owner.kind==='任务'?[owner.tempId]:[],relatedMaterialTempIds:[],evidenceIds:[entry.eid],confidence:.8,selected:!!value&&!ast.needsConfirmation};result.timePoints.push(p);if(entry.owner.kind==='任务')owner.timePointTempIds.push(p.tempId);return p}
 staged.sort((a,b)=>Number(b.type==='开始')-Number(a.type==='开始'))
 const cancelledOwners=new Set(staged.filter(e=>e.type==='取消').map(e=>e.owner.id))
 for(const e of staged){
  const owner=e.owner.entity
  if(cancelledOwners.has(e.owner.id)){if(e.type==='取消'){result.standaloneTasks=result.standaloneTasks.filter(t=>t.tempId!==owner.tempId);result.events=result.events.filter(t=>t.tempId!==owner.tempId);result.ignoredContent.push({text:e.span.literal,reason:'policy'});note('REVISION',e.owner.id,'CANCELLED_ITEM_RETAINED_AS_INFORMATION',e.span.literal)}continue}
  if(e.type==='条件'){owner.selected=false;owner.description+='\n适用条件待确认：'+e.span.literal;if(e.owner.kind==='任务')owner.completionCriteria.push('若符合以下条件则适用：'+e.span.literal);continue}
  if(e.type==='取消'||e.type==='变更'){owner.selected=false;if(e.type==='取消'){result.standaloneTasks=result.standaloneTasks.filter(t=>t.tempId!==owner.tempId);result.events=result.events.filter(t=>t.tempId!==owner.tempId);}result.ignoredContent.push({text:e.span.literal,reason:'policy'});result.ambiguities.push({id:'g2-revision-'+e.eid,field:'revision',message:'原文有取消或变更，请核对当前事项：'+e.span.literal,options:['保留当前事项','拒绝当前事项'],evidenceIds:[e.eid]});note('REVISION',e.owner.id,'REVISION_ENDPOINTS_REQUIRE_REVIEW',e.span.literal);continue}
  if(e.type==='地点'){if(e.owner.kind!=='活动'){note('OWNERSHIP',e.owner.id,'LOCATION_HAS_NO_EVENT_FIELD_RETAINED_IN_DESCRIPTION',e.span.literal);owner.description+='\n地点：'+e.span.literal}else owner.location=valueOf(e.span.literal,'地点').slice(0,160);continue}
  if(e.type==='材料'){if(e.owner.kind==='任务'){const m={tempId:'g2-m'+(result.materials.length+1),name:valueOf(e.span.literal,'材料').slice(0,120),required:true,formatRequirements:[],namingRequirements:[],quantity:null,submissionChannel:null,relatedTaskTempIds:[owner.tempId],evidenceIds:[e.eid],confidence:.8,selected:owner.selected};result.materials.push(m);owner.materialTempIds.push(m.tempId)}else owner.description+='\n准备要求：'+e.span.literal;continue}
  if(e.type==='渠道'){owner.description+='\n提交渠道：'+e.span.literal;const ms=result.materials.filter(m=>m.relatedTaskTempIds.includes(owner.tempId));if(ms.length===1)ms[0].submissionChannel=valueOf(e.span.literal,'渠道').slice(0,200);continue}
  const isWindow=e.type==='办理时段';if(isWindow&&e.owner.kind==='活动'){owner.selected=false;owner.description+='\n办理窗口：'+e.span.literal;note('OWNERSHIP',e.owner.id,'WINDOW_IS_NOT_FIXED_ATTENDANCE',e.span.literal);continue}
  const role=e.type==='截止'?'task_deadline':e.type==='结束'?'event_end':'event_start'
  const anchor=e.type==='结束'&&e.owner.kind==='活动'?result.timePoints.find(p=>p.tempId===owner.startTimePointTempId&&!p.needsConfirmation):null
  const ast=parseChineseTimeAst(e.span.literal,{type:role,referenceTime,timezone,...(anchor?.normalizedValue?{inheritedDate:anchor.normalizedValue.slice(0,10)}:{})})
  const alternative=/(?:任选|备选|可选择|[0-9一二三四五六七八九十]日[^。；]{0,10}或)/u.test(e.span.literal)
  const ctx=sentenceAt(e.span,source),openingAsCutoff=e.type==='截止'&&deadlineRangeRoleIssue(e.span.literal,'task_deadline',ctx.text)
  const correction=/(?:改为|调整至|变更为)/u.exec(ctx.text),obsolete=e.type==='截止'&&/取消|作废|失效/u.test(ctx.text)&&(!correction||e.span.end<=ctx.start+correction.index)
  if(obsolete){ast.normalizedValue=null;ast.rangeEndNormalizedValue=null;ast.needsConfirmation=true;note('TIME',e.owner.id,'OLD_TIME_NOT_REACTIVATED',e.span.literal)}
  if(alternative||openingAsCutoff){ast.normalizedValue=null;ast.rangeEndNormalizedValue=null;ast.needsConfirmation=true;note('TIME',e.owner.id,alternative?'ALTERNATIVE_DATES_NOT_A_DEADLINE':'WINDOW_START_NOT_A_DEADLINE',e.span.literal)}
  const value=e.type==='结束'?(ast.rangeEndNormalizedValue??ast.normalizedValue):ast.normalizedValue,p=point(e,role,ast,value)
  if(e.owner.kind==='活动'){const key=role==='event_end'?'endTimePointTempId':'startTimePointTempId';if(e.type==='截止'){note('OWNERSHIP',e.owner.id,'EVENT_DEADLINE_NEEDS_ACTION_OWNER',e.span.literal);p.selected=false;p.needsConfirmation=true}else if(owner[key]){p.selected=false;p.needsConfirmation=true;owner.selected=false;note('TIME',e.owner.id,'CONFLICTING_KEY_TIME',e.span.literal)}else owner[key]=p.tempId}
  if(isWindow){if(ast.rangeEndNormalizedValue)point(e,'event_end',ast,ast.rangeEndNormalizedValue);else{p.selected=false;p.needsConfirmation=true;note('TIME',e.owner.id,'WINDOW_ENDPOINT_INCOMPLETE',e.span.literal)}}
  if(!value){owner.selected=false;note('TIME',e.owner.id,'TIME_UNRESOLVED',e.span.literal)}
 }
 // Material/channel and condition order in a JSON array is not semantic.
 for(const e of staged.filter(e=>e.type==='渠道')){const ms=result.materials.filter(m=>m.relatedTaskTempIds.includes(e.owner.entity.tempId));if(ms.length===1)ms[0].submissionChannel=valueOf(e.span.literal,'渠道').slice(0,200)}
 for(const e of staged.filter(e=>e.type==='条件'))for(const m of result.materials.filter(m=>m.relatedTaskTempIds.includes(e.owner.entity.tempId)))m.selected=false
 for(const t of result.standaloneTasks){const ps=result.timePoints.filter(p=>t.timePointTempIds.includes(p.tempId)&&/deadline$/u.test(p.type)&&p.normalizedValue),values=new Set(ps.map(p=>p.normalizedValue));if(values.size>1){t.selected=false;ps.forEach(p=>{p.selected=false;p.needsConfirmation=true});note('TIME',t.tempId,'CONFLICTING_KEY_TIME',ps.map(p=>p.rawText).join('；'))}}
 for(const record of declared.values())if(record.entity&&/若|如果|入选|录取|已缴费|错过|未领取|未办理|审核后|通过后|有[^，。；]{0,12}(?:需求|意向)|决定放弃/u.test(sentenceAt(record.span,source).text)){record.entity.selected=false;audit.items.find(r=>r.id===record.id).sourceCondition='UNKNOWN_NOT_MANDATORY'}
 result.sourceSummary.requiresAction=result.standaloneTasks.length>0
 result.sourceSummary.notificationType=result.standaloneTasks.length?'teacher_task':result.events.length?'event_notice':'information_only'
 result.sourceSummary.title=result.standaloneTasks[0]?.title??result.events[0]?.title??'通知资料'
 result.sourceSummary.summary=result.standaloneTasks.length+'项任务，'+result.events.length+'项活动。'+(pending.length?'有'+pending.length+'项原文关联或时间需要核对。':'请查看后接受。')
 if(raw.noAction&&result.standaloneTasks.length){note('ITEM_STRUCTURE','noAction','NO_ACTION_CONTRADICTS_DECLARED_TASKS','');result.standaloneTasks.forEach(t=>t.selected=false)}
 result.quality.needsHumanReview=pending.length>0;result.quality.reviewReasons=pending.length?['部分提取内容仍需核对，原文和已定位的事实已保留。']:[]
 const labels={ALIGNMENT:'有一段引用无法在原文中唯一定位',OWNERSHIP:'有一项事实的归属尚不明确',TIME:'有一项时间尚不能确认',POLARITY:'原文包含取消或禁止的事项，已保留说明',REVISION:'有一项取消或变更需要核对当前要求',ITEM_STRUCTURE:'有一项事项尚未整理完整',FACT_STRUCTURE:'有一项事实尚未整理完整'}
 for(const [i,p]of pending.slice(0,20).entries())result.ambiguities.push({id:'g2-pending-'+i,field:'source_reference',message:(labels[p.layer]??'有一项内容需要核对')+'，请查看原文',options:['查看原文','保留待核对'],evidenceIds:[]})
 return{result,audit,rootFailure:false}
}
export function mergeTwoStepFacts(samples,source){
 const merged={items:[],facts:[],noAction:true},byKey=new Map(),factKeys=new Set(),audit={version:TWO_STEP_VERSION,samples:samples.length,unmatched:[],itemMappings:[]}
 for(const [index,raw]of samples.entries()){if(!validateTwoStep(raw).valid){audit.unmatched.push({sample:index,reason:'INVALID_ROOT'});continue}const mapping=new Map();for(const item of raw.items){const span=alignTwoStepQuote(item.quote,source);if(!span){audit.unmatched.push({sample:index,item:item.id,reason:'UNALIGNED_ITEM'});continue}const nameSpan=alignTwoStepQuote(item.name,span.literal),key=item.kind+':'+norm(item.name)+':'+(nameSpan?span.start+nameSpan.start:span.start)+':'+(nameSpan?span.start+nameSpan.end:span.end);let id=byKey.get(key);if(!id){id='u'+(merged.items.length+1);byKey.set(key,id);merged.items.push({...item,id})}mapping.set(item.id,id);audit.itemMappings.push({sample:index,from:item.id,to:id,start:span.start,end:span.end})}for(const fact of raw.facts){const span=alignTwoStepQuote(fact.quote,source),item=mapping.get(fact.item);if(!span||!item){audit.unmatched.push({sample:index,type:fact.type,reason:'UNALIGNED_OR_UNOWNED_FACT'});continue}const key=[item,fact.type,span.start,span.end].join(':');if(!factKeys.has(key)){factKeys.add(key);merged.facts.push({...fact,item})}}merged.noAction=merged.noAction&&raw.noAction}return{raw:merged,audit}
}
