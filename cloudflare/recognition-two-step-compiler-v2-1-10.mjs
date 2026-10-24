import {normalizeRecognitionResult} from './recognition.mjs'
import {parseTwoStepTime as parseChineseTimeAst} from './two-step-time.mjs'
import {deadlineRangeRoleIssue} from './deadline-range-role.mjs'
import {validateTwoStep} from './recognition-two-step-contract.mjs'
import {alignSourceQuote,sourceScopes} from './two-step-source-alignment.mjs'
import {applyScopedApplicability} from './two-step-applicability.mjs'
const TWO_STEP_VERSION='recognition-two-step-2.1.0'
const norm=s=>String(s??'').normalize('NFKC').replace(/\s/gu,''),verbs='补领|代领|申领|补办|换发|签到|携带|告知|清理|带离|到达|领|登录|关闭|补选|通知|履行|报送|提前到达|组织|做好|扫码|清点|保管|指派|查询|储水|退回|重新提交|申请退费|签字|盖章|联系|回复|下载|制作|收集|激活|阅读|熟悉|填写并发送|下载并填写|撰写并提交|确认并提交|提交|上传|发送|填写|申请|报名|选课|缴纳|缴费|领取|归还|确认|核对|办理|完成|撰写|参加|准备|签署|打印|出示|登记|注册|预约|学习'.split('|').sort((a,b)=>b.length-a.length).join('|')
const types=new Set(['截止','开始','结束','办理时段','地点','材料','渠道','条件','取消','变更'])

function sourceNameParts(name,literal){
 let rest=norm(name).replace(/[《》“”"'、，,（）()·：:]/gu,'')
 let available=norm(literal).replace(/[《》“”"'、，,（）()·：:]/gu,'')
 while(rest){
  if(/^[的和与及并]/u.test(rest)){rest=rest.slice(1);continue}
  let n=rest.length
  while(n>=2&&!available.includes(rest.slice(0,n)))n--
  if(n<2){if(rest.length===1&&available.includes(rest))return true;return false}
  const at=available.indexOf(rest.slice(0,n))
  available=available.slice(0,at)+'\u0000'.repeat(n)+available.slice(at+n)
  rest=rest.slice(n)
 }
 return true
}


// An explicit section heading can supply a repeated/omitted object, but only
// within its one contiguous section. The full original range becomes evidence.
function itemScope(span,source,name){
 const scopes=sourceScopes(span,source),sentence=scopes[0];
 if(sourceNameParts(name,sentence.text))return sentence;
 const section=scopes[2],header=/^(?:[一二三四五六七八九十]+[、．.]|[（(][一二三四五六七八九十0-9]+[）)]|[0-9]+[、．.])[^\n]*/u.exec(section.text);
 if(header&&section.start<=span.start&&span.start-section.start<=500&&sentence.end-section.start<=650&&sourceNameParts(name,source.slice(section.start,sentence.end)))return {start:section.start,end:sentence.end,text:source.slice(section.start,sentence.end)};
 return sentence;
}

export const alignTwoStepQuote=alignSourceQuote
const sentenceAt=(span,source)=>{const before=source.slice(0,span.start),left=Math.max(before.lastIndexOf('。'),before.lastIndexOf('；'),before.lastIndexOf(';'))+1,tail=source.slice(span.end).search(/[。；;]/u),end=tail<0?source.length:span.end+tail+1;return{start:left,end,text:source.slice(left,end)}}
const sameSentence=(a,b,source)=>{const left=Math.min(a.start,b.start),right=Math.max(a.end,b.end);return !/[。；;！？!?]/u.test(source.slice(left,right))}
const valueOf=(q,type)=>q.replace(new RegExp('^(?:活动)?'+type+'[：:]\\s*','u'),'').replace(/^[在至到]\s*/u,'').replace(/(?:举办|举行|办理)[。；;]?$/u,'').replace(/[。；;]$/u,'').trim()
export function compileTwoStep(raw,{source,referenceTime,timezone='Asia/Shanghai',model='deepseek-v4-flash',version=TWO_STEP_VERSION,alignmentHints=null}){
 const hinted=(kind,id,q)=>{const h=alignmentHints?.[kind]?.find(x=>kind==='items'?x.id===id:x.index===id)?.span;if(!h||source.slice(h.start,h.end)!==h.literal)return null;const aligned=alignTwoStepQuote(q,h.literal);return aligned&&aligned.start===0&&aligned.end===h.literal.length?h:null}
 const check=validateTwoStep(raw);if(!check.valid)return{result:null,audit:{version,rootFailure:true,losses:check.errors},rootFailure:true}
 const result=normalizeRecognitionResult({schemaVersion:'2.0',sourceSummary:{title:'通知建议',sourceType:'text',notificationType:'teacher_task',summary:'',requiresAction:false},projectMatch:{decision:'standalone_task'},standaloneTasks:[],events:[],materials:[],timePoints:[],evidence:[]},source,referenceTime,model,version,true,timezone)
 const audit={version,compilerVersion:'two-step-compiler-2.1.10',mode:'MODEL_SEMANTIC_FACTS_THEN_DETERMINISTIC_STRUCTURE',rootFailure:false,inferredFacts:0,items:[],facts:[],losses:[],offsets:[],calls:1},declared=new Map(),usedIds=new Set(),pending=[]
 const evidence=(span,field)=>{let e=result.evidence.find(e=>e.textStart===span.start&&e.textEnd===span.end&&e.field===field);if(!e){e={id:'g2-e'+(result.evidence.length+1),sourceId:'pending-source',quote:span.literal,quotedText:span.literal,textStart:span.start,textEnd:span.end,field,extractionMethod:'parser',confidence:1};result.evidence.push(e)}return e.id}
 const note=(layer,id,reason,quote)=>{audit.losses.push({layer,id,reason,quote});pending.push({layer,id,reason,quote})}
 for(const [i,item]of raw.items.entries()){
  const span=hinted('items',item?.id,item?.quote)??alignTwoStepQuote(item?.quote,source),valid=item&&typeof item.id==='string'&&item.id.length<=40&&typeof item.name==='string'&&item.name.trim().length>0&&item.name.length<=120&&['任务','活动','信息'].includes(item.kind)&&!Object.entries(item).some(([k,v])=>!['id','kind','name','quote'].includes(k)&&v!==null&&v!=='')
  if(!valid||usedIds.has(item.id)){note('ITEM_STRUCTURE',item?.id??String(i),'INVALID_OR_DUPLICATE_ITEM',item?.quote);continue}usedIds.add(item.id)
  if(!span){note('ALIGNMENT',item.id,'ITEM_QUOTE_NOT_UNIQUELY_ALIGNED',item.quote);continue}
  const record={id:item.id,kind:item.kind,name:item.name,span,entity:null};
  const ownScope=itemScope(span,source,item.name),sentence=ownScope.text
  let displayName=item.name,eventSupportSpan=null
  const topicScope=sourceScopes(span,source)[1]
  const topicMatches=raw.items.filter(x=>x.kind==='活动').length===1?[...source.matchAll(/(?:讲座主题|报告题目|活动主题|讲座题目)[：:]\s*([^\n。；]{2,120})/gu)].map(m=>{const literal=m[1].replace(/\*+$/u,'').trim(),start=m.index+m[0].indexOf(literal);return {literal,start,end:start+literal.length,rule:'UNIQUE_EXPLICIT_EVENT_TOPIC_WITH_DECLARED_NAME'}}).filter(x=>topicScope.end-topicScope.start<=650&&x.start>=topicScope.start&&x.end<=topicScope.end&&norm(item.name).includes(norm(x.literal))):[]
  if(item.kind==='活动'&&topicMatches.length===1){displayName=topicMatches[0].literal;eventSupportSpan=topicMatches[0];audit.items.push({id:item.id,rule:'UNIQUE_EXPLICIT_EVENT_TOPIC_WITH_DECLARED_NAME',before:item.name,after:displayName,start:eventSupportSpan.start,end:eventSupportSpan.end})}
  if(item.kind==='活动'&&!eventSupportSpan&&!sourceNameParts(item.name,sentence)){const literalName=span.literal.replace(/^(?:活动名称|主题讲座|活动主题)[：:]\s*/u,'').trim();if(literalName.length>=2&&literalName.length<=120&&norm(item.name).includes(norm(literalName))&&!/时间|另行通知|[0-9]月[0-9]日/u.test(literalName)&&/[\p{Script=Han}A-Za-z]/u.test(literalName)){displayName=literalName;audit.items.push({id:item.id,rule:'DISPLAY_FROM_ALIGNED_EVENT_QUOTE',before:item.name,after:displayName})}}
  if(item.kind==='活动'&&!eventSupportSpan&&!sourceNameParts(displayName,sentence)&&/讲座|讲堂|会议|考试|停电|停水|停网|闭馆|开放|封闭|维护|检修|说明会|报告会|培训|工作坊/u.test(span.literal)&&span.literal.length<=120&&!/取消|不再|禁止|不得/u.test(span.literal)){
   displayName=span.literal;audit.items.push({id:item.id,rule:'UNSUPPORTED_DISPLAY_MODIFIERS_REMOVED_FROM_EXISTING_EVENT',before:item.name,after:displayName,start:span.start,end:span.end});
  }
  let actionMatch=new RegExp('('+verbs+'|协助|清点|发放|张贴|提供)(?:\\s*)?(.+)','u').exec(item.name.trim())
  if(!actionMatch){const suffix=new RegExp('^(.+?)('+verbs+')$','u').exec(item.name.trim());if(suffix)actionMatch=[suffix[0],suffix[2],suffix[1]]}
  const hasActionInSource=new RegExp(verbs+'|协助|清点|发放|张贴|提供|交至','u').test(sentence)
  const attached=raw.facts.filter(f=>f.item===item.id)
  const historicalOnly=actionMatch&&new RegExp('(?:已(?:经)?|现已)[^，。；]{0,10}'+actionMatch[1],'u').test(span.literal)&&!new RegExp('(?:请|须|需|应|务必|可|欢迎|自愿)[^，。；]{0,14}'+actionMatch[1],'u').test(span.literal)
  const explicitAction=actionMatch&&!historicalOnly&&sourceNameParts(actionMatch[2],span.literal)&&span.literal.includes(actionMatch[1])&&!/^(?:准备|制作|签字|盖章|核对|阅读|查询|熟悉)$/u.test(actionMatch[1]),actionableName=actionMatch&&sourceNameParts(actionMatch[2],sentence)&&!/^(?:时间|日期|截止|要求|说明|地点|安排|方式|渠道|对象|通知|信息|结果|记录保留|记录有效|完成状态|状态)$/u.test(norm(actionMatch[2]))
  const statusOnly=item.kind==='信息'&&/^(?:另行通知[^，。；]{0,12}(?:时间|日期)|[^，。；]{0,30}(?:通道|要求|信息|记录)[^，。；]{0,6}(?:不变|有效))$/u.test(norm(item.quote))&&!/(?:请|须|务必)[^。；]{0,15}通知/u.test(item.quote)
  const promoted=item.kind==='信息'&&!statusOnly&&hasActionInSource&&actionableName&&(attached.some(f=>['截止','渠道'].includes(f.type))||explicitAction)&&!/已(?:经)?(?:完成|发布)|仅供知悉/u.test(span.literal)
  if(promoted){record.kind='任务';audit.items.push({id:item.id,rule:'INFORMATION_WITH_EXPLICIT_ACTION_REVIEW_AS_TASK'});}
declared.set(item.id,record);audit.items.push({id:item.id,name:item.name,kind:item.kind,start:span.start,end:span.end,status:'ALIGNED_MODEL_PROPOSAL_NOT_INDEPENDENT_SEMANTIC_TRUTH'});audit.offsets.push({...span,modelQuote:item.quote})
  const eid=evidence(span,item.kind==='活动'?'event':item.kind==='任务'?'description':'description')
  if(record.kind==='信息'){result.ignoredContent.push({text:span.literal,reason:'other'});continue}
  const anchor=alignTwoStepQuote(item.name,source)??span
  const before=source.slice(0,anchor.start),left=Math.max(...['。','；',';','，',',','\n'].map(x=>before.lastIndexOf(x)))+1
  const tail=source.slice(anchor.end),right=tail.search(/[。；;，,\n]/u),clause=source.slice(left,right<0?source.length:anchor.end+right)
  const polarity=clause.replace(/逾期(?:将)?(?:不再受理|不予受理|不受理|不得补交)|不得(?:缺席|迟到|早退|缺考)/gu,'')
  if(/取消|不再|不需要|无需|无须|不必|不得|禁止|请勿/u.test(polarity)&&!/改为|调整至|变更为/u.test(polarity)){result.ignoredContent.push({text:span.literal,reason:'policy'});note('POLARITY',item.id,'CANCELLED_OR_NEGATED_ITEM_NOT_EXECUTABLE',item.quote);continue}
  const tempId='g2-'+(i+1)
  if(record.kind==='任务'){
   const match=actionMatch;if(!match){note('ITEM_STRUCTURE',item.id,'TASK_NEEDS_ACTION_AND_OBJECT',item.quote);continue}
   const equivalentActions={提交:['交至','交到','递交','报送','上传','投稿'],发送:['发至','发到'],登录:['登陆'],扫码:['扫以下二维码','扫描二维码'],缴纳:['缴费','支付'],撰写:['写'],补领:['领取'],领:['领取']}
   const objectInQuote=sourceNameParts(match[2],span.literal),channelSupported=attached.some(f=>f.type==='渠道'&&alignTwoStepQuote(f.quote,source))
   const actionSupported=sentence.includes(match[1])||(equivalentActions[match[1]]??[]).some(v=>sentence.includes(v))||objectInQuote&&channelSupported
   const verbAt=span.literal.lastIndexOf(match[1]),tail=verbAt<0?'':span.literal.slice(verbAt+match[1].length).trim(),quotedTail=new RegExp('^(?:'+verbs+'|并|且|将|把|可|须|需|请|应当|先|再|后|到|至|自行|\\s)*$','u').test(tail)?'':tail
   const otherActions=[...new Set([...sentence.matchAll(new RegExp(verbs+'|协助|清点|发放|张贴|提供|交至','gu'))].map(m=>m[0]))]
   const heading=/^(?:[一二三四五六七八九十]+[、．.]|[（(][一二三四五六七八九十0-9]+[）)]|[0-9]+[、．.])[^\n]*/u.exec(ownScope.text)?.[0]
   const continuationObject=norm(quotedTail).replace(/第[一二三四五六七八九十0-9]+批(?:次)?/gu,'').replace(/[。；，,：:]/gu,'')
   const headingContinuation=!!heading&&sourceNameParts(match[2],heading)&&continuationObject.length>=2&&sourceNameParts(continuationObject,heading)
   if(!actionSupported||!objectInQuote&&!headingContinuation&&otherActions.length>1&&quotedTail.length>=2){note('ITEM_STRUCTURE',item.id,'ACTION_OBJECT_SCOPE_AMBIGUOUS',item.quote);continue}
   if(!sourceNameParts(match[2],sentence)){note('ITEM_STRUCTURE',item.id,'TASK_OBJECT_NOT_LITERAL_IN_OWN_QUOTE',item.quote);continue}
   if(!sourceNameParts(match[2],span.literal)){const scope=ownScope;if(scope.text.length<=650)record.supportSpan={literal:scope.text,start:scope.start,end:scope.end,rule:'DISPLAY_NAME_SUPPORTED_BY_SAME_SENTENCE'};}
   record.entity={tempId,parentTempId:null,hierarchyType:'task',title:item.name,actionVerb:match[1],actionObject:match[2],description:span.literal,completionCriteria:[],estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:[],materialTempIds:[],timePointTempIds:[],evidenceIds:[eid],confidence:.8,inferenceLevel:'explicit',userConfirmationRequired:true,selected:!promoted};if(promoted)note('ITEM_STRUCTURE',item.id,'INFORMATION_PROMOTED_REQUIRES_ACTION_REVIEW',span.literal);result.standaloneTasks.push(record.entity)
  }else{if(!eventSupportSpan&&!sourceNameParts(displayName,sentence)){note('ITEM_STRUCTURE',item.id,'EVENT_NAME_NOT_LITERAL_IN_OWN_QUOTE',item.quote);continue}if(eventSupportSpan)record.supportSpan=eventSupportSpan;else if(!sourceNameParts(displayName,span.literal)){const scope=ownScope;if(scope.text.length<=650)record.supportSpan={literal:scope.text,start:scope.start,end:scope.end,rule:'DISPLAY_NAME_SUPPORTED_BY_SAME_SENTENCE'};}record.entity={tempId,title:displayName,description:span.literal,startTimePointTempId:null,endTimePointTempId:null,location:null,relatedTaskTempIds:[],evidenceIds:[eid],confidence:.8,inferenceLevel:'explicit',selected:true};result.events.push(record.entity)}
  if(record.supportSpan){record.entity.evidenceIds.push(evidence(record.supportSpan,'description'));audit.offsets.push(record.supportSpan)}
 }
 const staged=[]
 for(const [i,fact]of raw.facts.entries()){
  if(!fact||!types.has(fact.type)||!['string','object'].includes(typeof fact.item)||typeof fact.item==='object'&&fact.item!==null||Object.keys(fact).some(k=>!['type','quote','item'].includes(k))){note('FACT_STRUCTURE',String(i),'INVALID_TYPED_FACT',fact?.quote);continue}
  let owner=declared.get(fact.item),span=hinted('facts',i,fact.quote)??alignTwoStepQuote(fact.quote,source)
  if(!span&&owner?.entity&&typeof fact.quote==='string'&&source.includes(fact.quote)){const options=[];let at=-1;while((at=source.indexOf(fact.quote,at+1))>=0){const candidate={literal:fact.quote,start:at,end:at+fact.quote.length,rule:'EXACT_UNIQUE_WITHIN_DECLARED_ITEM_SENTENCE'};if(sameSentence(owner.span,candidate,source))options.push(candidate)}if(options.length===1)span=options[0]}
  if(!span){note('ALIGNMENT',String(i),'FACT_QUOTE_NOT_UNIQUELY_ALIGNED',fact.quote);continue}
  if(owner&&!owner.entity&&['取消','变更'].includes(fact.type)){result.ignoredContent.push({text:span.literal,reason:'policy'});audit.facts.push({rule:'INFORMATION_REVISION_KEEPS_ORIGINAL_OWNER',item:owner.id,start:span.start,end:span.end});continue}
  if(!owner?.entity){
   const originalOwner=owner
   for(const scope of sourceScopes(span,source)){
    const options=[...declared.values()].filter(r=>r.entity&&r.span.start>=scope.start&&r.span.end<=scope.end)
    if(options.length===1){owner=options[0];audit.facts.push({rule:'UNIQUE_'+scope.level+'_FALLBACK_OWNER',from:fact.item,to:owner.id,start:span.start,end:span.end});break}
    if(options.length>1)break
   }
   if(originalOwner&&!originalOwner.entity&&owner?.entity){
    const a=norm(originalOwner.name).replace(/时间|地点|材料|渠道|条件|要求|说明|对象|范围/gu,''),b=norm(owner.name),overlap=[...a].some((_,i)=>i<a.length-1&&b.includes(a.slice(i,i+2)))
    if(!overlap)owner=originalOwner
   }
  }
  if(!owner?.entity){note('OWNERSHIP',String(i),'FACT_OWNER_MISSING_OR_AMBIGUOUS',fact.quote);continue}
  const neighbours=[...declared.values()].filter(r=>r.entity&&sameSentence(r.span,span,source));if(neighbours.length===1&&neighbours[0].id!==owner.id){note('OWNERSHIP',String(i),'FACT_CONTRADICTS_UNIQUE_SOURCE_SENTENCE_OWNER',fact.quote);continue}
  const eid=evidence(span,['截止','开始','结束','办理时段'].includes(fact.type)?'deadline':fact.type==='材料'?'materials':fact.type==='条件'?'requirement':'description')
  staged.push({type:fact.type,span,owner,eid});owner.entity.evidenceIds=[...new Set([...owner.entity.evidenceIds,eid])];audit.facts.push({type:fact.type,item:owner.id,start:span.start,end:span.end,modelQuote:fact.quote,literal:span.literal,alignmentRule:span.rule,status:'ALIGNED_AND_OWNED'})
 }
 const point=(entry,role,ast,value)=>{const owner=entry.owner.entity,p={tempId:'g2-p'+(result.timePoints.length+1),type:role,rawText:entry.span.literal,normalizedValue:value??null,timezone,isAllDay:ast.isAllDay,precision:ast.precision,needsConfirmation:ast.needsConfirmation||!value,relatedTaskTempIds:entry.owner.kind==='任务'?[owner.tempId]:[],relatedMaterialTempIds:[],evidenceIds:[entry.eid],confidence:.8,selected:!!value&&!ast.needsConfirmation};result.timePoints.push(p);if(entry.owner.kind==='任务')owner.timePointTempIds.push(p.tempId);return p}
 staged.sort((a,b)=>Number(b.type==='开始')-Number(a.type==='开始'))
 const cancelledOwners=new Set(staged.filter(e=>e.type==='取消').map(e=>e.owner.id))
 for(const e of staged){
  const owner=e.owner.entity
  if(cancelledOwners.has(e.owner.id)){if(e.type==='取消'){result.standaloneTasks=result.standaloneTasks.filter(t=>t.tempId!==owner.tempId);result.events=result.events.filter(t=>t.tempId!==owner.tempId);result.ignoredContent.push({text:e.span.literal,reason:'policy'});note('REVISION',e.owner.id,'CANCELLED_ITEM_RETAINED_AS_INFORMATION',e.span.literal)}continue}
  if(e.type==='条件'&&/命名|文件名|标题格式|字数|文件格式|PDF|Word|word|一式|字体|字号|行距/u.test(e.span.literal)&&!/入选|录取|资格|若|如果|符合|对象|仅限/u.test(e.span.literal)){owner.description+='\n材料格式要求：'+e.span.literal;if(e.owner.kind==='任务')owner.completionCriteria.push(e.span.literal);audit.facts.push({rule:'FORMAT_REQUIREMENT_NOT_ELIGIBILITY',item:e.owner.id,start:e.span.start,end:e.span.end});continue}
  if(e.type==='条件'){owner.selected=false;owner.description+='\n适用条件待确认：'+e.span.literal;if(e.owner.kind==='任务')owner.completionCriteria.push('若符合以下条件则适用：'+e.span.literal);continue}
  if(e.type==='取消'||e.type==='变更'){owner.selected=false;if(e.type==='取消'){result.standaloneTasks=result.standaloneTasks.filter(t=>t.tempId!==owner.tempId);result.events=result.events.filter(t=>t.tempId!==owner.tempId);}result.ignoredContent.push({text:e.span.literal,reason:'policy'});result.ambiguities.push({id:'g2-revision-'+e.eid,field:'revision',message:'原文有取消或变更，请核对当前事项：'+e.span.literal,options:['保留当前事项','拒绝当前事项'],evidenceIds:[e.eid]});note('REVISION',e.owner.id,'REVISION_ENDPOINTS_REQUIRE_REVIEW',e.span.literal);continue}
  if(e.type==='地点'){if(e.owner.kind!=='活动'){note('OWNERSHIP',e.owner.id,'LOCATION_HAS_NO_EVENT_FIELD_RETAINED_IN_DESCRIPTION',e.span.literal);owner.description+='\n地点：'+e.span.literal}else owner.location=valueOf(e.span.literal,'地点').slice(0,160);continue}
  if(e.type==='材料'){if(e.owner.kind==='任务'){const m={tempId:'g2-m'+(result.materials.length+1),name:valueOf(e.span.literal,'材料').slice(0,120),required:true,formatRequirements:/字数|文件格式|PDF|Word|word|一式|字体|字号|行距|格式/u.test(e.span.literal)?[e.span.literal]:[],namingRequirements:/命名|文件名|标题格式/u.test(e.span.literal)?[e.span.literal]:[],quantity:null,submissionChannel:null,relatedTaskTempIds:[owner.tempId],evidenceIds:[e.eid],confidence:.8,selected:owner.selected};result.materials.push(m);owner.materialTempIds.push(m.tempId)}else owner.description+='\n准备要求：'+e.span.literal;continue}
  if(e.type==='渠道'){owner.description+='\n提交渠道：'+e.span.literal;const ms=result.materials.filter(m=>m.relatedTaskTempIds.includes(owner.tempId));if(ms.length===1)ms[0].submissionChannel=valueOf(e.span.literal,'渠道').slice(0,200);continue}
  const isWindow=e.type==='办理时段';if(isWindow&&e.owner.kind==='活动'){owner.selected=false;owner.description+='\n办理窗口：'+e.span.literal;note('OWNERSHIP',e.owner.id,'WINDOW_IS_NOT_FIXED_ATTENDANCE',e.span.literal);continue}
  const role=e.type==='截止'?'task_deadline':e.type==='结束'?'event_end':'event_start'
  const ownDates=[...new Set(result.timePoints.filter(p=>(e.owner.kind==='任务'?p.relatedTaskTempIds.includes(owner.tempId):p.tempId===owner.startTimePointTempId)&&p.normalizedValue&&!p.needsConfirmation).map(p=>p.normalizedValue.slice(0,10)))]
  const anchor=e.type==='结束'&&e.owner.kind==='活动'?result.timePoints.find(p=>p.tempId===owner.startTimePointTempId&&!p.needsConfirmation):e.type==='办理时段'&&ownDates.length===1?{normalizedValue:ownDates[0]}:null
  const vaguePeriod=/下半年|上半年|上旬|中旬|下旬|学期|另行通知|待定|待公布/u.test(e.span.literal)
  const ast=parseChineseTimeAst(e.span.literal,{type:role,referenceTime,timezone,...(!vaguePeriod&&anchor?.normalizedValue?{inheritedDate:anchor.normalizedValue.slice(0,10)}:{})})
    // 24:00 is the explicitly stated end of that civil day, not a fabricated
  // 23:59 cutoff. Reuse the existing parser after a canonical clock conversion.
  if(vaguePeriod){ast.normalizedValue=null;ast.rangeEndNormalizedValue=null;ast.needsConfirmation=true;ast.precision='vague';ast.isAllDay=false}
  const compactClock=e.span.literal.replace(/\s/gu,'').replaceAll('：',':'),midnight=/24(?::00|时(?:00分)?)(?![0-9])/u
  if(ast.issues.includes('invalid_clock')&&midnight.test(compactClock)&&!(/24:[1-5][0-9]/u.test(compactClock))){const canonical=compactClock.replace(midnight,'00:00'),parsed=parseChineseTimeAst(canonical,{type:role,referenceTime,timezone}),nextDay=v=>{if(!v)return v;const[y,m,d]=v.slice(0,10).split('-').map(Number);return new Date(Date.UTC(y,m-1,d+1)).toISOString().slice(0,10)+v.slice(10)};if(parsed.normalizedValue&&parsed.precision==='exact'){Object.assign(ast,parsed,{rawText:e.span.literal});if(parsed.rangeEndNormalizedValue)ast.rangeEndNormalizedValue=nextDay(parsed.rangeEndNormalizedValue);else ast.normalizedValue=nextDay(parsed.normalizedValue);audit.facts.find(f=>f.start===e.span.start&&f.end===e.span.end).timeRule='EXPLICIT_24H_CIVIL_DAY_ROLLOVER'}}
  if(/下班前|午休前|上班前/u.test(compactClock)&&!/[0-2]?[0-9]:[0-5][0-9]/u.test(compactClock)){ast.precision='vague';ast.needsConfirmation=true;ast.isAllDay=false;note('TIME',e.owner.id,'OFFICE_CLOCK_NOT_STATED',e.span.literal)}
  const alternative=/(?:任选|备选|可选择|[0-9一二三四五六七八九十]日[^。；]{0,10}或)/u.test(e.span.literal)
  const ctx=sentenceAt(e.span,source),openingAsCutoff=e.type==='截止'&&deadlineRangeRoleIssue(e.span.literal,'task_deadline',ctx.text)
  const serviceEnd=e.type==='截止'&&/(?:服务|开放|接待|营业|功能|系统|平台|窗口)(?:时间)?(?:截止|截至|结束|关闭|暂停)/u.test(compactClock)&&!/(?:报名|申请|提交|申报|缴费|上传)(?:时间)?(?:截止|截至)/u.test(compactClock)
  if(serviceEnd){ast.normalizedValue=null;ast.rangeEndNormalizedValue=null;ast.needsConfirmation=true;result.ignoredContent.push({text:e.span.literal,reason:'other'});note('TIME',e.owner.id,'SERVICE_ENDPOINT_NOT_TASK_DEADLINE',e.span.literal)}
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
 for(const e of staged.filter(e=>e.type==='条件'&&!/命名|文件名|标题格式|字数|文件格式|PDF|Word|word|一式|字体|字号|行距/u.test(e.span.literal)))for(const m of result.materials.filter(m=>m.relatedTaskTempIds.includes(e.owner.entity.tempId)))m.selected=false
 for(const t of result.standaloneTasks){const ps=result.timePoints.filter(p=>t.timePointTempIds.includes(p.tempId)&&/deadline$/u.test(p.type)&&p.normalizedValue),values=new Set(ps.map(p=>p.normalizedValue));if(values.size>1){t.selected=false;ps.forEach(p=>{p.selected=false;p.needsConfirmation=true});note('TIME',t.tempId,'CONFLICTING_KEY_TIME',ps.map(p=>p.rawText).join('；'))}}
 for(const record of declared.values())if(record.entity&&( /所借|个人遗留|遗失|损坏|若|如果|(?:^|[，。；\n])\s*如[^，。；]{1,50}[，,]|入选|录取|已缴费|错过|未领取|未办理|审核后|通过后|有[^，。；]{0,12}(?:需求|意向)|决定放弃/u.test(sentenceAt(record.span,source).text)||record.kind==='任务'&&/相关单位|各学院|各二级院部|二级院部|辅导员|各单位/u.test(sentenceAt(record.span,source).text))){record.entity.selected=false;audit.items.find(r=>r.id===record.id).sourceCondition='UNKNOWN_NOT_MANDATORY'}
 // Source-declared administrative actors and possession/voluntary branches
 // do not establish the current user's applicability. Keep the real obligation.
 for(const record of declared.values())if(record.entity&&record.kind==='任务'){
  const own=norm(record.span.literal),context=norm(sentenceAt(record.span,source).text),actor=/(?:^|[，,：:]|由)(?:请)?(?:各|相关|每个)?(?:学院|院部|教务处|后勤部门|工作人员|项目成员|项目组|团队|项目)(?:应|须|需|要|做好|完成|组织|根据|将|汇总|通知|负责|办理|协助|安排|指派|准备)/u.test(own)||/(?:^|[，,：:]|由)(?:请)?(?:各|相关|每个)?(?:学院|院部|教务处|后勤部门|工作人员|项目成员|项目组|团队|项目)(?:应|须|需|要|做好|完成|组织|根据|将|汇总|通知|负责|办理|协助|安排|指派|准备)/u.test(context),possessed=/物品/u.test(record.entity.actionObject)&&/(?:存放|遗留|遗忘|放在|放置).{0,40}物品/u.test(context),voluntary=new RegExp('(?:可(?:以)?|自愿|有意|希望|欢迎)[^，。；]{0,6}'+record.entity.actionVerb,'u').test(own);
  if(actor||possessed||voluntary){record.entity.selected=false;const reason=actor?'原文办理角色尚未确认适用于当前用户':possessed?'当前用户是否持有原文所述物品尚未确认':'原文提供自愿办理机会，当前参与意愿尚未确认';if(!record.entity.description.includes('适用条件'))record.entity.description+='\n适用条件待确认：'+reason+'。';for(const m of result.materials.filter(m=>m.relatedTaskTempIds.includes(record.entity.tempId)))m.selected=false;audit.items.push({id:record.id,rule:'SOURCE_ROLE_POSSESSION_OR_VOLUNTARY_UNKNOWN',reason,sourceStart:record.span.start,sourceEnd:record.span.end});}
 }
 // A source-wide participant clause can qualify a named activity even when
 // the model extracted only its title. It does not qualify unrelated delivery
 // actions or service outages, and does not assert a personal role is true.
 const participation=/(?:请)?(?:全体|各|所有|相关)?(?:教职工|教师|辅导员|干部|工作人员|项目成员|项目组|团队|考生)[^。；！]{0,35}?(?:参加|参与)/u.exec(norm(source))??/(?:感兴趣|有意|自愿)[^。；！]{0,15}(?:师生|同学|学生|人员|者)[^。；！]{0,15}?(?:报名|参加|参与)/u.exec(norm(source))??/欢迎[^。；！]{0,15}(?:师生|同学|学生|人员|者)[^。；！]{0,8}?(?:参加|参与)/u.exec(norm(source));
 if(participation){const span=alignTwoStepQuote(participation[0],source);for(const record of declared.values())if(record.entity&&((record.kind==='活动'&&!/停电|停水|停网|维护|闭馆|开放|开馆|检修|封闭|施工/u.test(record.name))||(record.kind==='任务'&&/^(?:学习|参加|准备)$/u.test(record.entity.actionVerb)))){record.entity.selected=false;if(!record.entity.description.includes('适用条件'))record.entity.description+='\n适用条件待确认：'+(span?.literal??participation[0]);if(span)record.entity.evidenceIds.push(evidence(span,'requirement'));for(const m of result.materials.filter(m=>m.relatedTaskTempIds.includes(record.entity.tempId)))m.selected=false;audit.items.push({id:record.id,rule:'SOURCE_PARTICIPANT_SCOPE_UNKNOWN',quote:span?.literal??participation[0],start:span?.start??null,end:span?.end??null});}}
 applyScopedApplicability({records:[...declared.values()],source,result,audit,evidence})
 result.sourceSummary.requiresAction=result.standaloneTasks.length>0
 result.sourceSummary.notificationType=result.standaloneTasks.length?'teacher_task':result.events.length?'event_notice':'information_only'
 result.sourceSummary.title=result.standaloneTasks[0]?.title??result.events[0]?.title??'通知资料'
 result.sourceSummary.summary=result.standaloneTasks.length+'项任务，'+result.events.length+'项活动。'+(pending.length?'有'+pending.length+'项原文关联或时间需要核对。':'请查看后接受。')
 if(raw.noAction&&result.standaloneTasks.length)audit.facts.push({rule:'NO_ACTION_SUMMARY_DOES_NOT_ERASE_EXPLICIT_ITEM'})
 result.quality.needsHumanReview=pending.length>0;result.quality.reviewReasons=pending.length?['部分提取内容仍需核对，原文和已定位的事实已保留。']:[]
 const labels={ALIGNMENT:'有一段引用无法在原文中唯一定位',OWNERSHIP:'有一项事实的归属尚不明确',TIME:'有一项时间尚不能确认',POLARITY:'原文包含取消或禁止的事项，已保留说明',REVISION:'有一项取消或变更需要核对当前要求',ITEM_STRUCTURE:'有一项事项尚未整理完整',FACT_STRUCTURE:'有一项事实尚未整理完整'}
 for(const [i,p]of pending.slice(0,20).entries()){const span=p.quote?alignTwoStepQuote(p.quote,source):null;result.ambiguities.push({id:'g2-pending-'+i,field:'source_reference',message:(labels[p.layer]??'有一项内容需要核对')+(p.quote?'：'+p.quote.slice(0,100):'，请查看原文'),options:['查看原文','保留待核对'],evidenceIds:span?[evidence(span,'description')]:[]})}
 return{result,audit,rootFailure:false}
}
export function mergeTwoStepFacts(samples,source){
 const merged={items:[],facts:[],noAction:true},byKey=new Map(),factKeys=new Set(),audit={version:TWO_STEP_VERSION,samples:samples.length,unmatched:[],itemMappings:[]}
 for(const [index,raw]of samples.entries()){if(!validateTwoStep(raw).valid){audit.unmatched.push({sample:index,reason:'INVALID_ROOT'});continue}const mapping=new Map();for(const item of raw.items){const span=alignTwoStepQuote(item.quote,source);if(!span){audit.unmatched.push({sample:index,item:item.id,reason:'UNALIGNED_ITEM'});continue}const nameSpan=alignTwoStepQuote(item.name,span.literal),key=item.kind+':'+norm(item.name)+':'+(nameSpan?span.start+nameSpan.start:span.start)+':'+(nameSpan?span.start+nameSpan.end:span.end);let id=byKey.get(key);if(!id){id='u'+(merged.items.length+1);byKey.set(key,id);merged.items.push({...item,id})}mapping.set(item.id,id);audit.itemMappings.push({sample:index,from:item.id,to:id,start:span.start,end:span.end})}for(const fact of raw.facts){const span=alignTwoStepQuote(fact.quote,source),item=mapping.get(fact.item);if(!span||!item){audit.unmatched.push({sample:index,type:fact.type,reason:'UNALIGNED_OR_UNOWNED_FACT'});continue}const key=[item,fact.type,span.start,span.end].join(':');if(!factKeys.has(key)){factKeys.add(key);merged.facts.push({...fact,item})}}merged.noAction=merged.noAction&&raw.noAction}return{raw:merged,audit}
}



