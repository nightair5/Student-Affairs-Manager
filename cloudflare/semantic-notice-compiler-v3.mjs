import {normalizeRecognitionResult} from './recognition.mjs'
import {locateSourceQuote,locateOwnedSourceQuote} from './source-text-index.mjs'
import {parseDirectSourceTime} from './direct-source-time.mjs'
import {deadlineRangeRoleIssue} from './deadline-range-role.mjs'
import {SEMANTIC_NOTICE_VERSION} from './semantic-notice-contract-v3-2-0.mjs'
import {SOURCE_DAY_PATTERN,channelOwnedWindow,combineExplicitWindowEntries,contextualEventDay,mergeHeadingWindowIntoDelivery,modelOwnedSharedDay,ownedAgendaTime,sameBuildingLocation,sourceChannelClosingDeadline,sourceConditionClauses,sourceEvidenceCondition,sourceEventDuration,sourceOpenEndedWindow,sourceSummaryDeliveryWindow,sourceSummaryOptionalMaterial,systemAvailabilityAsInformation} from './semantic-source-context.mjs'
import {declaredTaskChoices,combineSupportedChoices,expandSupportedSingleChoices,sharedDocumentScope,sourceBackedChoicePairs,sourceBackedEventChoices,sourceCandidateTime,sourceFormContext,sourceSupportedDependency} from './semantic-relations.mjs'
import {itemPolarity} from './semantic-item-polarity.mjs'
import {applySemanticActorRelations} from './semantic-actor-relations.mjs'
import {applyEventIncidentalNotices} from './semantic-event-notices.mjs'
import {applySemanticGoalRelations} from './semantic-goal-relations.mjs'
import {timeRoleContext,parseWindowWithDailyHours,sourceTimeModality} from './semantic-time-context.mjs'
import {sourceOptionalMaterialClause,sourceParagraphContext,sourceSectionLocation,sourceMaterialInlineFormats} from './semantic-source-context.mjs'

const object = value => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const text = (value, max=160) => typeof value === 'string' ? value.trim().slice(0,max) : ''
const list = (value, count=20, max=160) => Array.isArray(value) ? [...new Set(value.map(v=>text(v,max)).filter(Boolean))].slice(0,count) : []
const compact = value => typeof value==='string'?value.normalize('NFKC').replace(/\s/gu,''):''
export const SEMANTIC_COMPILER_VERSION='semantic-notice-compiler-1.0.25'
export const SEMANTIC_GOAL_COMPILER_VERSION='semantic-notice-compiler-1.0.26'
// Full-width ASCII maps one UTF-16 unit to one unit; source offsets remain valid.
const foldWidth = value => value.replace(/[！-～]/gu,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0))
const hasLiteral = (source,value) => Boolean(value && compact(source).includes(compact(value)))
const sourceDay = SOURCE_DAY_PATTERN

// Compare only to recover an original clause, never to certify a paraphrase
// as a literal quote or to assert its (possibly changed) action as a fact.
function clauseSimilarity(a,b) {
  const left=compact(a).replace(/[，。；;、：:！？]/gu,'').slice(0,240)
  const right=compact(b).replace(/[，。；;、：:！？]/gu,'').slice(0,240)
  if(!left||!right)return 0
  let previous=new Uint16Array(right.length+1)
  for(const char of left){
    const next=new Uint16Array(right.length+1)
    for(let i=1;i<=right.length;i++)next[i]=char===right[i-1]?previous[i-1]+1:Math.max(previous[i],next[i-1])
    previous=next
  }
  return 2*previous[right.length]/(left.length+right.length)
}

// A broken model quote can be recovered only when the model's action and
// object both occur in exactly one source clause. Never pick a nearest match.
function sourceTaskClause(source,item) {
  const action=compact(text(item.action,20)),target=compact(text(item.object,80))
  if(!action||target.length<2)return null
  const candidates=[...source.matchAll(/[^。！？；;\n]+/gu)].filter(m=>{
    const clause=compact(m[0])
    const actionAt=clause.indexOf(action),before=clause.slice(Math.max(0,actionAt-8),actionAt)
    const background=/(?:介绍|讲解|指导|展示|分享|讨论|学习|培训)(?:如何|怎样|有关|关于)?$/u.test(before)
    return actionAt>=0&&clause.includes(target)&&itemPolarity(item,m[0])!=='cancelled'&&!background&&!/(?:无需|无须|不必|不用|不需要|请勿|禁止|不得|不再)$/u.test(before)
  })
  if(candidates.length===1){
    const match=candidates[0],literal=match[0].trim(),start=match.index+match[0].indexOf(literal)
    return {literal,start,end:start+literal.length,inferredAction:false}
  }
  if(candidates.length>1)return null
  const quotes=list(item.evidence,12,500)
  const plausible=[...source.matchAll(/[^。！？；;\n]+/gu)].filter(match=>{
    const clause=compact(match[0]),targetAt=clause.indexOf(target)
    return targetAt>=0&&clause.indexOf(target,targetAt+target.length)<0&&itemPolarity(item,match[0])!=='cancelled'
      &&quotes.some(quote=>clauseSimilarity(quote,match[0])>=0.75)
  })
  if(plausible.length!==1)return null
  const match=plausible[0],literal=match[0].trim(),start=match.index+match[0].indexOf(literal)
  return {literal,start,end:start+literal.length,inferredAction:true}
}

// An event needs its literal name plus an independently stated time or place
// in the same unique source clause before a missing quote can be recovered.
function sourceEventClause(source,item) {
  const title=compact(text(item.title,160))
  const signals=[text(item.location,160),...(Array.isArray(item.times)?item.times.flatMap(t=>object(t)?[text(t.raw,160)]:[]):[])].map(compact).filter(s=>s.length>=2)
  if(title.length<2||!signals.length)return null
  const candidates=[...source.matchAll(/[^。！？；;\n]+/gu)].filter(m=>{
    const clause=compact(m[0])
    return clause.includes(title)&&signals.some(s=>clause.includes(s))&&itemPolarity(item,m[0])!=='cancelled'
  })
  if(candidates.length!==1)return null
  const match=candidates[0],literal=match[0].trim(),start=match.index+match[0].indexOf(literal)
  return {literal,start,end:start+literal.length}
}

// Remove only formatting differences and an equivalent introduction; do not
// merge alternatives with mandatory requirements, or different facts.
function requirementKey(value) {
  return compact(value).replace(/^(?:材料)?要求[：:]?/u,'')
    .replace(/^任选(?:一项|一种方式)(?:提交)?[：:]?/u,'任选:')
    .replace(/[，,。；;：:、\s]/gu,'')
}
function normalizeCountNumbers(value) {
  const digits={零:0,〇:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9},units={十:10,百:100,千:1000}
  return compact(value).replace(/[零〇一二两三四五六七八九十百千]{1,6}(?=页|份|人|天|小时|分钟|字|张|门|项|种|个|次|元|件|套|本|名|位)/gu,word=>{
    if(!/[十百千]/u.test(word))return [...word].map(char=>digits[char]).join('')
    let sum=0,current=0
    for(const char of word){if(char in units){sum+=(current||1)*units[char];current=0}else current=digits[char]}
    return String(sum+current)
  })
}

// A requirement that is explicitly limited to a condition is not an
// unconditional prerequisite for every user of the task. Keep the literal
// clause with the material when its only source occurrence is unambiguous.
function conditionalMaterialClause(source,name,refs){
  const target=compact(name)
  if(target.length<2||!refs.some(ref=>compact(ref).includes(target)))return ''
  const clauses=[...source.matchAll(/[^。；;！!？?\n]+/gu)].filter(match=>compact(match[0]).includes(target))
  if(clauses.length!==1)return ''
  const value=clauses[0][0].trim(),normalized=compact(value),at=normalized.indexOf(target)
  if(at<0||normalized.indexOf(target,at+target.length)>=0)return ''
  const fragments=value.split(/[，,]/u).map(part=>part.trim()).filter(Boolean),index=fragments.findIndex(part=>compact(part).includes(target))
  if(index<0)return ''
  const current=fragments[index],prefix=compact(current).split(target)[0]
  const suffix=compact(current).slice(compact(current).indexOf(target)+target.length)
  // An explicit “if available, optionally attach” qualifier describes this
  // material rather than making it mandatory for every applicant.
  if(/^(?:如有|若有)(?:可|可以|可另|可再)(?:附|提供|提交|上传)|^(?:可选|非必需|无需提供)/u.test(suffix))return current
  const condition=/^(?:如果|若|如(?!何|下)|仅当|只有|除非|在.{0,16}情况下|.{2,24}(?:时|情况下)(?:另|才|方|还|就)?(?:须|需|应|请|必须|提供|携带|提交|带)|本人办理(?:时)?(?:须|需|应|请|必须|提供|携带|提交|带))/u,obligation=/(?:须|需|应|请|必须|提供|携带|提交|带)/u
  if(condition.test(prefix)&&obligation.test(prefix))return current
  const previous=index>0?fragments[index-1]:''
  if(/^(?:如果|若|如(?!何|下)|仅当|只有|除非).{1,30}$/u.test(compact(previous))&&!/(?:无法|不予|将|不得|取消|不再|不能|无需|请先|须先)/u.test(previous)&&obligation.test(prefix))return previous+'，'+current
  return ''
}

/** A material's obligation can differ across delivery owners. Derive a
 * branch-specific status only from that owner's unique, literal citation. */
function materialUseForOwner(source,record,name){
 const target=compact(name),form=compact(text(record.item.deliveryForm,80))
 if(target.length<2)return null
 const clauses=record.ownText.split(/[。；;\n]/u).map(value=>value.trim()).filter(value=>{
  const normalized=compact(value)
  const kind=form?deliveryKind(form):''
  return normalized.includes(target)&&(!form||normalized.includes(form))&&(!kind||deliveryKind(value)===kind)&&Boolean(locateSourceQuote(value,source))
 })
 if(clauses.length!==1)return null
 const clause=clauses[0],normalized=compact(clause)
 if(/(?:如有|若有|可选|自愿|非必交)/u.test(normalized)&&/(?:可|附|提供|提交|上传)/u.test(normalized))return {required:false,requirement:clause}
 if(/(?:如果|若|仅当|只有|除非).{0,30}(?:须|必须|需要).{0,16}(?:提交|提供|携带|附|上传)/u.test(normalized))return {required:false,requirement:clause}
 if(/(?:须|必须|需要|应).{0,16}(?:提交|提供|携带|附|上传)/u.test(normalized)&&!/(?:无需|不必|不需要|不得|禁止)/u.test(normalized))return {required:true,requirement:''}
 return null
}
// A model-owned material can be required for a specific delivery even when
// the source says “please submit” rather than using the word “mandatory”.
// Only infer this when that material is part of the action's cited object.
function directlyCitedMaterialUse(source,record,name){
 const target=compact(name),object=compact(text(record.item.object,160)),action=compact(text(record.item.action,80))
 if(!target||!object.includes(target)||!action||/^(?:查看|浏览|阅读|了解)$/u.test(action))return null
 const citations=list(record.item.evidence,12,500).filter(quote=>compact(quote).includes(object)&&locateSourceQuote(quote,source))
 return citations.length===1?{required:true,requirement:''}:null
}
// Assignment evidence may hold the only source citation for a combined
// action. Both parts of a joined title/action still need literal support in
// that bounded citation; an unrelated actor citation cannot create a task.
function citedActionPartsSupported(value,quote){
 const scope=compact(quote),parts=text(value,160).split(/(?:并且|然后|以及|并|再)/u).map(compact).filter(Boolean)
 return parts.length>0&&parts.every(part=>{
  if(scope.includes(part))return true
  const chars=[...part]
  for(let i=2;i<=chars.length-2;i++)if(scope.includes(chars.slice(0,i).join(''))&&scope.includes(chars.slice(i).join('')))return true
  return false
 })
}
function numberedUnits(value) {
  const normalized=normalizeCountNumbers(value),units=[]
  for(const match of normalized.matchAll(/(\d+(?:\.\d+)?)(?:个)?(小时|分钟|元|页|份|人|名|位|天|字|张|门|项|种|个|次|件|套|本)/gu)){
    const prefix=normalized.slice(Math.max(0,match.index-8),match.index)
    const choice=['项','种','个'].includes(match[2])&&/(?:任选|可选|选择|选取|选用|挑选)(?:其中)?$/u.test(prefix)
    units.push(match[1]+':'+(choice?'选择':(['名','位'].includes(match[2])?'人':match[2])))
  }
  return units
}
function requirementCovered(existing,additional) {
  const first=requirementKey(existing),second=requirementKey(additional)
  if(first===second)return true
  if(second.length<6)return false
  // Compare each actual clause separately: an unrelated negation in another
  // clause must not force an identical requirement to be shown twice.
  const clauses=existing.split(/[，,。；;\n]/u).map(requirementKey).filter(Boolean)
  if(clauses.some(clause=>{
    if(clause===second)return true
    if(!clause.endsWith(second))return false
    const prefix=clause.slice(0,-second.length)
    return prefix.length<=12&&!/(?:不|无|未|禁止|不得|无需|取消|非|仅|只|任选|可选|若|如果|除非|至少|不少于|不超过|最多|以上|以下|以内)/u.test(prefix)
  }))return true
  const at=first.indexOf(second)
  // A contained phrase is not equivalent if the extra text qualifies,
  // reverses or restricts it. Retain both rather than dropping that distinction.
  if(at<0)return false
  const extra=first.slice(0,at)+first.slice(at+second.length)
  return !/(?:不|无|未|禁止|不得|无需|取消|非|仅|只|任选|可选|或者|或|若|如果|除非|至少|不少于|不超过|最多|以上|以下|以内|之前|之后|截至|截止)/u.test(extra)
}
function uniqueRequirements(values) {
  const result=[]
  for(const value of list(values,100,800)){
    if(result.some(existing=>requirementCovered(existing,value)))continue
    // A longer, equivalent statement encountered later replaces its contained
    // duplicate; a negation or other extra facts must never be removed.
    for(let i=result.length-1;i>=0;i--)if(requirementCovered(value,result[i]))result.splice(i,1)
    result.push(value)
  }
  return result
}

// A task's own explicitly cited delivery form can carry an unresolved source
// deadline. Keep the literal wording with that task, never turn it into a date.
function citedUnknownDeadline(item,ownText) {
  const form=text(item.deliveryForm,80)
  if(!form)return []
  return ownText.split(/[。；;，,\n]/u).map(part=>part.trim()).filter(part=>
    part.startsWith(form)&&/(?:截止|期限|日期|时间)/u.test(part)&&/(?:另行|后续|之后|日后).{0,16}(?:通知|公布|确定)/u.test(part),
  )
}

// Preserve a literal channel or a uniquely source-backed address when a model
// has wrapped that address in a nonliteral descriptive label.
function sourceChannel(source,value) {
  if(!value)return ''
  const span=locateSourceQuote(value,source)
  if(span){
    const before=source.slice(Math.max(0,span.start-14),span.start),after=source.slice(span.end,span.end+8)
    // A notice explaining where an entry will be announced is not itself the
    // destination where a completed form is submitted.
    if(/(?:入口|链接|地址)\s*以\s*$/u.test(before)&&/^\s*为准/u.test(after))return ''
  }
  if(hasLiteral(source,value))return value
  const comparable=s=>compact(s).replace(/[，,；;：:、（()）\[\]【】]/gu,'').replace(/或者/gu,'或')
  if(comparable(value)&&comparable(source).includes(comparable(value)))return value
  // A model may omit a purely positional word before a QR code while keeping
  // both alternative actions. Accept only one uniquely matched, affirmative
  // source phrase; no QR image, link or access is inferred from this text.
  if(/二维码/u.test(value)&&/(?:或|或者)/u.test(value)){
    const deictic=s=>comparable(s).replace(/(?:以下|下方|上述|所附)(?=二维码)/gu,'')
    const target=deictic(value),original=deictic(source),at=original.indexOf(target)
    if(target&&at>=0&&original.indexOf(target,at+1)<0&&!/(?:无需|无须|不必|不要|不得|禁止|不能|请勿)(?:再|去|继续)?$/u.test(original.slice(Math.max(0,at-12),at)))return value
  }
  const addresses=[...value.matchAll(/https?:\/\/[^\s，。；、）)\]】]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}(?:\/[^\s，。；、）)\]】]*)?/gu)].map(m=>m[0])
  const supported=[...new Set(addresses.filter(address=>source.includes(address)))]
  return supported.length===1?supported[0]:''
}

// Reject only a clear contradiction: a field is explicitly scoped to the
// opposite delivery form in its own source clause. Missing or shared scope is
// not treated as proof of a mismatch; the rest of the item remains intact.
function deliveryKind(value,{explicitOnly=false}={}) {
  const paper=(explicitOnly?/(?:纸质版|纸版|打印版|纸质(?:提交|材料|交付))/u:/(?:纸质|纸版|打印版|打印件)/u).test(value)
  const electronic=(explicitOnly?/(?:电子版|电子(?:提交|材料|交付|邮件|文件)|(?:线上|网上|在线)(?:提交|交付))/u:/(?:电子|线上|网上|在线)/u).test(value)
  return paper===electronic?'':paper?'paper':'electronic'
}
function sourceBackedDeliveryScope(record){
  const form=text(record.item.deliveryForm,80),title=text(record.item.title,160),formKind=deliveryKind(form),titleKind=deliveryKind(title)
  const ownKinds=new Set(record.ownText.split('\n').map(value=>deliveryKind(value)).filter(Boolean))
  if(formKind)return ownKinds.size===1&&!ownKinds.has(formKind)?'':form
  return titleKind&&ownKinds.size===1&&ownKinds.has(titleKind)?title:form
}
function conflictingDeliveryScope(source,field,expectedForm,{explicitOnly=false}={}) {
  const expected=deliveryKind(expectedForm||'',{explicitOnly})
  if(!expected||!field)return false
  const span=locateSourceQuote(field,source)
  if(!span)return false
  const before=source.slice(0,span.start),after=source.slice(span.end)
  const left=Math.max(...['。','；',';','，',',','！','？','\n'].map(mark=>before.lastIndexOf(mark)))+1
  const right=after.search(/[。；;，,！？\n]/u)
  const clause=source.slice(left,span.end)+(right<0?after:after.slice(0,right))
  const actual=deliveryKind(clause,{explicitOnly})
  return Boolean(actual&&actual!==expected)
}

// Only a source-cited, explicit all-cancelled conclusion can cancel several
// model-labelled revisions of the same event. Separate event names are never
// grouped by this helper.
function allRevisionsCancelled(source,raw) {
  if(raw.kind!=='information'||!raw.items.length||raw.items.some(item=>item?.kind!=='event'||item.status!=='cancelled'))return new Set()
  const subject=item=>compact(item.title).replace(/\([^()]*\)$/u,'')
  const names=[...new Set(raw.items.map(subject))]
  if(names.length!==1||names[0].length<3||!compact(source).includes(names[0]))return new Set()
  const clauses=[...source.matchAll(/[^。；;\n]+/gu)].filter(match=>/(?:全部|全都|均)(?:被|已|予以)?取消/u.test(match[0])&&!/(?:取消资格|部分取消|取消报名|取消奖励)/u.test(match[0]))
  const owned=clauses.filter(match=>{
    const at=match[0].search(/(?:全部|全都|均)(?:被|已|予以)?取消/u)
    const lead=compact(match[0].slice(0,at))
    return Array.from({length:names[0].length-2},(_,i)=>names[0].slice(i)).some(value=>value.length>=3&&new RegExp('(?:^|[:：])'+value.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&')+'[^。；;]{0,16}$','u').test(lead))
      &&raw.items.some(item=>list(item.evidence,12,500).some(quote=>{const span=locateSourceQuote(quote,source);return span&&span.start<=match.index+at&&span.end>match.index+at}))
  })
  return owned.length===1?new Set(raw.items.map(item=>item.key)):new Set()
}

// A source line can explicitly assign rooms to different sessions while using
// one shared building. Only compose when the item's title selects one role and
// the model's proposed location equals those two source fragments.
function sourceLocation(source,value,title,ownText) {
  if(!value)return ''
  for(const line of ownText.split(/\r?\n/u)){
    const choices=[...line.matchAll(/(?:^|[、，,；;])\s*(?:【[^】]+】)?([^、，,；;（）()]+?)\s*[（(]([^（）()]+)[）)]/gu)].map(m=>({place:m[1].trim().replace(/^(?:活动)?地点\s*[:：]\s*/u,''),role:m[2].trim()}))
    const matches=choices.filter(c=>c.role&&compact(title).includes(compact(c.role)))
    if(choices.length<2||!matches.length)continue
    if(matches.length!==1)return ''
    const base=choices[0].place.match(/^(.{2,30}?(?:中心|大楼|大厦|校区|园区|图书馆|体育馆|教学楼))(?=.)/u)?.[1]
    const place=matches[0].place
    if(compact(value)===compact(place)&&hasLiteral(source,value))return value
    if(base&&source.includes(base)&&source.includes(place)&&compact(value)===compact(base+place))
      return hasLiteral(source,value)?value:base+' · '+place
    // A literal room still belongs to the role written next to it, not to a
    // different event merely because both rooms occur in the same source.
    return ''
  }
  return hasLiteral(source,value)?value:sameBuildingLocation(source,value,ownText)
}

/** The model owns action/object and relations. This adapter creates ids and
 * validates source-backed time values without re-parsing the display title. */
export function compileSemanticNotice(raw,{source,referenceTime,timezone='Asia/Shanghai',model='deepseek-v4-flash',promptVersion='recognition-semantic-notice-3.0.5'}={}) {
  const goalContract=promptVersion==='recognition-semantic-notice-3.11.0'
  const compilerVersion=goalContract?SEMANTIC_GOAL_COMPILER_VERSION:SEMANTIC_COMPILER_VERSION
  if (!object(raw) || !Array.isArray(raw.items) || !Array.isArray(raw.materials) || typeof raw.topic !== 'string' || !['action','event','information','mixed'].includes(raw.kind) || raw.items.length>20 || raw.materials.length>60) {
    return {result:null,audit:{compilerVersion,rootFailure:true,losses:[{layer:'SCHEMA',reason:'INVALID_SEMANTIC_ROOT'}]}}
  }
  const result=normalizeRecognitionResult({schemaVersion:'2.0',sourceSummary:{title:text(raw.topic,160)||'通知',sourceType:'text',notificationType:'uncertain',summary:'',requiresAction:false},projectMatch:{decision:'standalone_task'},standaloneTasks:[],events:[],materials:[],timePoints:[],evidence:[]},source,referenceTime,model,promptVersion,true,timezone)
  const refinedContract=goalContract||['recognition-semantic-notice-3.9.0','recognition-semantic-notice-3.10.0','recognition-semantic-notice-3.11.0'].includes(promptVersion)
  const unifiedContract=refinedContract||promptVersion==='recognition-semantic-notice-3.8.0'
  const audit={version:promptVersion,compilerVersion,rootFailure:false,items:[],facts:[],losses:[]}
  const availableWindows=[]
  const withWindowInformation={...raw,items:raw.items.map(item=>{
    const converted=systemAvailabilityAsInformation(source,item)
    if(converted)availableWindows.push(item.key)
    return converted??item
  })}
  const headingWindows=mergeHeadingWindowIntoDelivery(withWindowInformation,source)
  const expanded=expandSupportedSingleChoices(headingWindows.raw,source)
  raw=expanded.raw
  for(const item of availableWindows)audit.facts.push({role:'system_window_information',item})
  for(const change of headingWindows.changes)audit.facts.push({role:'heading_window_owner',...change})
  for(const change of expanded.changes)audit.facts.push({role:'choice_expanded',...change})
  for(const [index,material] of sourceSummaryOptionalMaterial(source,raw).entries()){
    const key=`source-optional-${index+1}`
    if(raw.materials.some(existing=>existing?.key===key)||raw.materials.length>=60)continue
    raw.materials.push({key,name:material.name,required:false,formats:[],quantity:null,naming:[],requirements:[material.quote],channel:null,owners:[material.owner],evidence:[material.quote],sourceRecovered:true})
    audit.facts.push({role:'source_backed_optional_material',material:key,owner:material.owner})
  }
  const note=(layer,id,reason)=>audit.losses.push({layer,id,reason})
  const evidence=(quote,field,id,start) => {
    const q=text(quote,500);if(!q)return null
    const span=locateSourceQuote(q,source,{start})
    if(!span){note('ALIGNMENT',id,'EVIDENCE_NOT_UNIQUELY_LOCATED');return null}
    const prior=result.evidence.find(e=>e.textStart===span.start&&e.textEnd===span.end&&e.field===field)
    if(prior)return prior.id
    const eid='sem-e'+(result.evidence.length+1)
    result.evidence.push({id:eid,sourceId:'pending-source',quote:span.literal,quotedText:span.literal,textStart:span.start,textEnd:span.end,field,extractionMethod:'ai',confidence:.8})
    return eid
  }
  const supportedRequirements=(values,id)=>{
    const input=Array.isArray(values)?values:[]
    if(input.length>100)note('REQUIREMENT',id,'REQUIREMENT_INPUT_OVERFLOW')
    if(input.some(value=>typeof value==='string'&&value.trim().length>800))note('REQUIREMENT',id,'REQUIREMENT_TEXT_TRUNCATED')
    const normalizedSource=compact(source),sourceNumbers=new Set(normalizeCountNumbers(source).match(/\d+(?:\.\d+)?/gu)??[]),sourceUnits=new Set(numberedUnits(source))
    return uniqueRequirements(input).filter(value=>{
      // Numerical claims must at least occur in the source; this does not by
      // itself prove that they belong to this item or have the right polarity.
      const numbers=normalizeCountNumbers(value).match(/\d+(?:\.\d+)?/gu)??[]
      const choiceTail=compact(value).replace(/^.*?(?:任选|选择|选取)(?:其中)?(?:一|1)(?:项|种|个)[：:]?/u,'')
      const singleChoice=/(?:任选(?:其一|一种|一项)|二选一|两种方式任选其一)/u.test(normalizedSource)&&/(?:任选|选择|选取)(?:其中)?(?:一|1)(?:项|种|个)/u.test(value)&&choiceTail.length>=6&&normalizedSource.includes(choiceTail)
      if(numbers.some(number=>!sourceNumbers.has(number)&&!(number==='1'&&singleChoice))){note('REQUIREMENT',id,'REQUIREMENT_NUMBER_NOT_IN_SOURCE');return false}
      if(numberedUnits(value).some(unit=>!sourceUnits.has(unit)&&!(unit==='1:选择'&&singleChoice))){note('REQUIREMENT',id,'REQUIREMENT_NUMBER_UNIT_NOT_IN_SOURCE');return false}
    if([SEMANTIC_NOTICE_VERSION,'recognition-semantic-notice-3.1.0','recognition-semantic-notice-3.3.0','recognition-semantic-notice-3.4.0','recognition-semantic-notice-3.5.0','recognition-semantic-notice-3.6.0','recognition-semantic-notice-3.7.0','recognition-semantic-notice-3.8.0','recognition-semantic-notice-3.9.0','recognition-semantic-notice-3.10.0','recognition-semantic-notice-3.11.0'].includes(promptVersion)&&!/(?:不得|禁止|不能|不可|不允许|无需|无须|不必|不需要|请勿|不再)/u.test(value)){
        const phrase=compact(value).replace(/^(?:请务必|必须|务必|需要|应当|请|须|需|应|要求)/u,'')
        const positions=[]
        if(phrase.length>=2)for(let at=normalizedSource.indexOf(phrase);at>=0;at=normalizedSource.indexOf(phrase,at+1))positions.push(at)
        if(positions.length&&positions.every(at=>/(?:不得|禁止|不能|不可|不允许|无需|无须|不必|不需要|请勿|不再)(?:再|另行)?$/u.test(normalizedSource.slice(Math.max(0,at-12),at)))){
          note('REQUIREMENT',id,'REQUIREMENT_POLARITY_CONFLICT');return false
        }
      }
      return true
    })
  }
  const applyTaskRequirements=(entity,baseLines,requirements,id)=>{
    entity.completionCriteria=requirements.slice(0,12)
    if(requirements.length>12)note('REQUIREMENT',id,'REQUIREMENT_OVERFLOW_IN_DESCRIPTION')
    const description=[...baseLines,...requirements.map(value=>'要求：'+value)].filter(Boolean).join('\n')
    if(description.length>800)note('DESCRIPTION',id,'REQUIREMENTS_TRUNCATED')
    entity.description=description.slice(0,800)
  }
  const keys=new Map(),pending=[],cancelledRevisions=allRevisionsCancelled(source,raw)
  const activeTaskKeys=new Set(raw.items.filter(item=>object(item)&&item.kind==='task'&&item.status!=='cancelled'&&text(item.key,40)).map(item=>item.key))
  for(const [index,item] of raw.items.entries()) {
    if(!object(item)||!['task','event'].includes(item.kind)||!text(item.key,40)||keys.has(item.key)||!text(item.title,item.kind==='task'?80:160)){note('ITEM_STRUCTURE',String(index),'INVALID_OR_DUPLICATE_ITEM');continue}
    if(item.status!==undefined&&!['active','cancelled'].includes(item.status)){note('ITEM_STRUCTURE',item.key,'UNKNOWN_STATUS');continue}
    const limits=item.kind==='task'?[['title',80],['action',20],['object',80],['description',500],['condition',160],['channel',160],['location',160]]:[['title',160],['content',1000],['condition',160],['location',160]]
    if(limits.some(([field,max])=>typeof item[field]==='string'&&item[field].trim().length>max))note('CAPACITY',item.key,'ITEM_FIELD_TRUNCATED')
    if(Array.isArray(item.evidence)&&(item.evidence.length>12||item.evidence.some(value=>typeof value==='string'&&value.trim().length>500)))note('CAPACITY',item.key,'ITEM_EVIDENCE_TRUNCATED')
    if(Array.isArray(item.times)&&item.times.length>20)note('CAPACITY',item.key,'ITEM_TIMES_TRUNCATED')
    const tempId='sem-i'+(index+1),refs=list(item.evidence,12,500),ids=refs.flatMap(q=>{const e=evidence(q,item.kind==='event'?'event':'description',item.key);return e?[e]:[]})
    let recoveredEvidence=false,inferredAction=false,assignmentEvidenceRecovered=false,assignmentRecoveredTarget=''
    if(!ids.length&&refinedContract&&item.kind==='task'&&object(item.assignment)){
      const assignment=item.assignment,quote=text(assignment.evidence,500),actor=text(assignment.actor,120),actorQuote=text(assignment.actorEvidence,500)||quote
      const span=quote&&actor&&compact(actorQuote).includes(compact(actor))?locateSourceQuote(quote,source):null
      const actorSpan=span?locateSourceQuote(actorQuote,source):null
      const ownMaterial=span?raw.materials.find(material=>object(material)&&text(material.name,80)&&compact(span.literal).includes(compact(material.name))&&compact(item.title).includes(compact(material.name))&&(list(item.materials,20,40).includes(material.key)||list(material.owners,20,40).includes(item.key))):null
      const supported=span&&actorSpan&&citedActionPartsSupported(item.title,span.literal)&&citedActionPartsSupported(item.action,span.literal)&&(citedActionPartsSupported(item.object,span.literal)||ownMaterial)
      if(supported){const id=evidence(span.literal,'description',item.key,span.start);if(id){ids.push(id);refs.push(span.literal);recoveredEvidence=true;assignmentEvidenceRecovered=true;assignmentRecoveredTarget=citedActionPartsSupported(item.object,span.literal)?'':text(ownMaterial?.name,80);note('ALIGNMENT',item.key,'RECOVERED_FROM_ASSIGNMENT_EVIDENCE')}}
    }
    if(!ids.length){
      const span=item.kind==='task'?sourceTaskClause(source,item):sourceEventClause(source,item)
      if(span){const id=evidence(span.literal,item.kind==='event'?'event':'description',item.key,span.start);if(id){ids.push(id);recoveredEvidence=true;inferredAction=Boolean(span.inferredAction);note('ALIGNMENT',item.key,inferredAction?'RECOVERED_ORIGINAL_CLAUSE_ACTION_UNVERIFIED':item.kind==='task'?'RECOVERED_FROM_UNIQUE_ACTION_OBJECT_CLAUSE':'RECOVERED_FROM_UNIQUE_EVENT_CLAUSE')}}
    }
    if(!ids.length){note('ITEM_STRUCTURE',item.key,'ITEM_UNGROUNDED');continue}
    const ownText=ids.map(id=>result.evidence.find(e=>e.id===id)?.quote??'').join('\n')
    const context=sourceParagraphContext(source,ids.map(id=>result.evidence.find(e=>e.id===id)).filter(Boolean))
    const polarity=cancelledRevisions.has(item.key)?'cancelled':itemPolarity(item,context||ownText)
    if(polarity==='cancelled'){note('POLARITY',item.key,'CANCELLED_ITEM');audit.items.push({key:item.key,status:'CANCELLED'});continue}
    if(polarity==='uncertain')note('POLARITY',item.key,'CANCELLATION_SCOPE_UNCERTAIN')
    const sourceBackedConditions=list(item.requirements,20,800).filter(value=>/^(?:仅限|面向|只有|限于|(?:完成|已经|已完成|入选)[^，,。；;]{0,35}(?:学生|同学|小组|队伍|人员|者))/u.test(value)&&locateSourceQuote(value,source))
    const proposedCondition=text(item.condition,160)||sourceBackedConditions[0]||sourceEvidenceCondition(source,refs,item)?.literal||''
    const conditionParts=proposedCondition?sourceConditionClauses(source,proposedCondition,refs):{supported:[],missing:[]}
    if(proposedCondition&&!conditionParts.supported.length){const cited=sourceEvidenceCondition(source,refs,item);if(cited)conditionParts.supported.push(cited)}
    const groundedCondition=conditionParts.supported.map(span=>span.literal).join('；')
    const interestOnly=/^(?:两场|各场|所有活动)?(?:均)?(?:面向|欢迎)?(?:所有)?(?:有意向|感兴趣|自愿|愿意参加)(?:的)?(?:同学|学生|人员|者)?(?:参加|参与)?$/u.test(groundedCondition)
    const hasEligibility=!interestOnly&&/(?:面向|仅限|符合条件|符合资格|不符合|必须具备|须具备|已完成|完成.{0,12}(?:培训|课程|考核))/u.test(groundedCondition)
    const voluntary=groundedCondition&&!hasEligibility&&/有意向|感兴趣|自愿|欢迎|如(?:想|有意)|愿意|希望参加/u.test(groundedCondition)?groundedCondition:''
    const approvedBefore=conditionParts.supported.length===1&&/^[^，,。；;]{1,24}(?:审核|审批|确认|批复)(?:通过|完成)$/u.test(groundedCondition)&&/^后/u.test(source.slice(conditionParts.supported[0].end))
    const prerequisite=groundedCondition&&((list(item.dependsOn,20,40).some(key=>activeTaskKeys.has(key))&&/^(?:完成|填写|提交|办理|通过|取得|先).+后$/u.test(groundedCondition))||/^[^，,。；;]{1,24}(?:批复|审批|批准|审核|确认|同意|反馈|公布|发布)后$/u.test(groundedCondition)||approvedBefore)?groundedCondition+(approvedBefore?'后':''):''
    const firstCondition=groundedCondition.split(/[；;，,]/u)[0]
    const namedNeed=/^(?:需要|需)[^，,。；;]{1,30}的[^，,。；;]{1,8}$/u.test(firstCondition)&&conditionParts.supported.some(span=>span.literal===firstCondition&&/^(?:[，,]\s*)?(?:可|可以|方可|须|需|请|于|应)/u.test(source.slice(span.end)))
    const citedChoice=/^[^，,。；;\n]{2,24}的$/u.test(firstCondition)&&!/(?:同学|学生|人员|团队|成员|队伍|者)的$/u.test(firstCondition)&&conditionParts.supported.some(span=>span.literal===firstCondition&&/^[，,]\s*(?:才|另|再|还)?(?:须|需|应|请|必须)/u.test(source.slice(span.end)))
    const needExpression=/^(?:如需|如有需要|有需要|有需求)/u.test(firstCondition)||/^(?:需要|需)[^，,。；;]{1,30}(?:同学|学生|小组|队伍|人员|者)$/u.test(firstCondition)||namedNeed||citedChoice
    const personalNeed=groundedCondition&&!hasEligibility&&!voluntary&&!prerequisite&&needExpression?groundedCondition:''
    const condition=voluntary||prerequisite||personalNeed?'':groundedCondition
    const requirements=supportedRequirements([...(Array.isArray(item.requirements)?item.requirements:[]),...(item.kind==='task'?citedUnknownDeadline(item,ownText):[])],item.key)
    if(conditionParts.missing.length)note('CONDITION',item.key,groundedCondition?'CONDITION_PARTIALLY_SOURCE_GROUNDED':'CONDITION_NOT_SOURCE_GROUNDED')
    for(const span of conditionParts.supported){const id=evidence(span.literal,'description',item.key,span.start);if(id)ids.push(id)}
    let entity,baseLines=[]
    if(item.kind==='task') {
      const action=text(item.action,20),target=assignmentRecoveredTarget||text(item.object,80)
      if(!action||!target){note('ITEM_STRUCTURE',item.key,'ACTION_OR_OBJECT_UNAVAILABLE');continue}
      const channel=text(item.channel,160),channelInSource=sourceChannel(source,channel)
      const deliveryForm=text(item.deliveryForm,80),supportedForm=deliveryForm&&hasLiteral(source,deliveryForm)?deliveryForm:''
      const wrongChannelScope=conflictingDeliveryScope(source,channelInSource,supportedForm||item.title)
      const supportedChannel=wrongChannelScope?'':channelInSource
      const location=text(item.location,160),supportedLocation=sourceLocation(ownText,location,item.title,ownText)
      if(channel&&!supportedChannel)note('CHANNEL',item.key,wrongChannelScope?'CHANNEL_OTHER_DELIVERY_SCOPE':'CHANNEL_NOT_SOURCE_GROUNDED')
      if(deliveryForm&&!supportedForm)note('DELIVERY',item.key,'DELIVERY_FORM_NOT_SOURCE_GROUNDED')
      if(location&&!supportedLocation)note('LOCATION',item.key,'TASK_LOCATION_NOT_OWNER_GROUNDED')
      baseLines=[inferredAction?'':text(item.description,500),inferredAction?'原文行动：'+ownText:'',supportedForm?'交付形式：'+supportedForm:'',supportedChannel?'提交渠道：'+supportedChannel:'',supportedLocation&&compact(supportedLocation)!==compact(supportedChannel)?'地点：'+supportedLocation:'',condition?'适用条件待确认：'+condition:'',personalNeed?'按需办理：'+personalNeed:'',prerequisite?'前置事项：'+prerequisite:'',voluntary?'参加说明：'+voluntary:''].filter(Boolean)
      const title=inferredAction?'处理'+target:recoveredEvidence&&!assignmentEvidenceRecovered?(target.startsWith(action)?target:action+target):text(item.title,80)
      entity={tempId,parentTempId:null,hierarchyType:'task',title,actionVerb:inferredAction?'处理':action,actionObject:target,description:'',completionCriteria:[],estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:[],materialTempIds:[],timePointTempIds:[],evidenceIds:[...new Set(ids)],confidence:.8,inferenceLevel:recoveredEvidence?'strong_inference':'explicit',userConfirmationRequired:Boolean(condition||personalNeed)||recoveredEvidence||polarity==='uncertain',selected:!condition&&!personalNeed&&!recoveredEvidence&&polarity!=='uncertain'}
      applyTaskRequirements(entity,baseLines,requirements,item.key)
      result.standaloneTasks.push(entity)
    } else {
      const location=text(item.location,160),supportedLocation=sourceLocation(source,location,item.title,ownText)||(unifiedContract?sourceSectionLocation(source,location,ownText):'')
      if(location&&!supportedLocation)note('LOCATION',item.key,'LOCATION_NOT_SOURCE_GROUNDED')
      const speakers=Array.isArray(item.speakers)?item.speakers.filter(object).slice(0,8).flatMap(person=>{const name=text(person.name,80),identity=text(person.identity,120),role=text(person.role,30)||'主讲人';if(!name||!hasLiteral(source,name)){if(name)note('PERSON',item.key,'PERSON_NOT_SOURCE_GROUNDED');return []}return [role+'：'+name+(identity&&hasLiteral(source,identity)?'（'+identity+'）':'')] }):[]
      const notices=list(item.notices,10,300)
      if(Array.isArray(item.notices)&&(item.notices.length>10||item.notices.some(value=>typeof value==='string'&&value.trim().length>300)))note('CAPACITY',item.key,'EVENT_NOTICES_TRUNCATED')
      if(Array.isArray(item.speakers)&&item.speakers.length>8)note('CAPACITY',item.key,'EVENT_SPEAKERS_TRUNCATED')
      const voluntaryShown=voluntary&&notices.some(n=>compact(n).includes(compact(voluntary))||compact(voluntary).includes(compact(n)))
      const duration=sourceEventDuration(source,item)
      const durationLine=duration?(duration.kind==='reservation'?'原文预留：':'原文时长：')+duration.literal:''
      const durationAmount=duration?.literal.match(/([0-9０-９一二两三四五六七八九十半]+)(?:个)?(小时|分钟)/u)
      const distinctNotices=notices.filter(n=>{
        if(!duration||!durationAmount)return true
        const only=compact(n).match(/^(?:(?:本次)?(?:会议|活动|讲座|培训|分享|课程))?(?:时长|持续|历时|用时|耗时)[：:]?(?:大约|约)?([0-9０-９一二两三四五六七八九十半]+)(?:个)?(小时|分钟)(?:左右)?[。.]?$/u)
        return !only||only[1]!==durationAmount[1]||only[2]!==durationAmount[2]
      })
      const lines=[...speakers,text(item.content,1000)?'活动内容：'+text(item.content,1000):'',...distinctNotices.map(n=>'参加须知：'+n),...requirements.map(n=>'准备要求：'+n),durationLine,condition?'适用条件待确认：'+condition:'',voluntary&&!voluntaryShown?'参加须知：'+voluntary:''].filter(Boolean)
      if([...new Set(lines)].join('\n').length>2400)note('CAPACITY',item.key,'EVENT_DESCRIPTION_TRUNCATED')
      entity={tempId,title:text(item.title,160),description:[...new Set(lines)].join('\n').slice(0,2400),startTimePointTempId:null,endTimePointTempId:null,location:supportedLocation||null,relatedTaskTempIds:[],evidenceIds:[...new Set(ids)],confidence:.8,inferenceLevel:recoveredEvidence?'strong_inference':'explicit',selected:!condition&&!recoveredEvidence&&polarity!=='uncertain'}
      result.events.push(entity)
    }
    if(polarity==='uncertain')entity.sourceStatus='uncertain'
    keys.set(item.key,{item,entity,kind:item.kind,condition});pending.push({item,entity,kind:item.kind,recoveredEvidence,ownText,requirements,baseLines,interestOnly})
    audit.items.push({key:item.key,tempId,kind:item.kind,status:'RETAINED'})
  }

  for(const {item,entity,kind,recoveredEvidence,ownText,requirements} of pending) {
    if(kind==='task')entity.dependencyTempIds=list(item.dependsOn,20,40).flatMap(key=>{const dependency=keys.get(key);if(dependency?.kind!=='task'){note('RELATION',item.key,'DEPENDENCY_NOT_FOUND');return []}if(refinedContract&&!sourceSupportedDependency(source,dependency.item,item)){note('RELATION',item.key,'DEPENDENCY_NOT_SOURCE_GROUNDED');return []}return [dependency.entity.tempId]})
    const sharedDay=kind==='event'?modelOwnedSharedDay(source,item,{allowSectionHeading:unifiedContract}):null
    const timeEntries=kind==='task'?combineExplicitWindowEntries(source,item).map(entry=>sourceOpenEndedWindow(source,item,entry)??entry):(Array.isArray(item.times)?item.times.slice(0,20):[])
    const channelWindow=kind==='task'?(channelOwnedWindow(source,item,pending,raw.summary)??sourceSummaryDeliveryWindow(source,item,pending,raw.summary,raw.topic)):null
    if(channelWindow&&timeEntries.length<20&&!timeEntries.some(entry=>entry?.role==='window')){timeEntries.push(channelWindow);audit.facts.push({role:channelWindow.sourceRecovered?'document_window_link':'channel_window_link',item:item.key,raw:channelWindow.raw})}
    const actionParts=(goalContract||promptVersion==='recognition-semantic-notice-3.10.0')&&kind==='task'?text(item.action,80).split(/(?:并且|然后|以及|并|再)/u).map(value=>compact(value)).filter(Boolean):[]
    const actionOwners=entry=>actionParts.flatMap((part,index)=>[...part].length>=2&&compact(entry?.raw??'').includes([...part].slice(0,2).join(''))?[index]:[])
    const windowOwners=new Set(timeEntries.filter(entry=>entry?.role==='window'&&typeof entry.raw==='string'&&locateSourceQuote(entry.raw,source)).flatMap(actionOwners))
    const distinctActionDeadline=entry=>entry?.role==='deadline'&&actionParts.length>1&&actionOwners(entry).length===1&&windowOwners.size===1&&!windowOwners.has(actionOwners(entry)[0])
    for(const entry of timeEntries) {
      if(!object(entry)||!['deadline','start','end','window'].includes(entry.role))continue
      const rawTime=text(entry.raw,160)
      // A single instant copied into both roles is not evidence of an end.
      // Preserve a genuine range even when the model cites it for both roles.
      const copiedStart=kind==='event'&&entry.role==='end'&&rawTime&&timeEntries.some(other=>other?.role==='start'&&compact(other.raw)===compact(rawTime))
      const explicitRange=/(?:至|到|~|～|—|–|-)\s*(?:次日|翌日)?\s*(?:凌晨|早上|上午|中午|下午|傍晚|晚上|夜间)?\s*(?:\d{4}\s*年\s*)?(?:\d{1,2}\s*月\s*)?\d{1,2}\s*(?:日|号|[:：点时])/u.test(rawTime)
      if(copiedStart&&!explicitRange){note('TIME',item.key,'EVENT_END_COPIED_FROM_START');continue}
      const owned=kind==='event'&&rawTime?ownedAgendaTime(source,item,raw.items,rawTime):null
      const span=rawTime&&(locateOwnedSourceQuote(rawTime,source,list(item.evidence,12,500))||owned?.time)
      if(!span){note('TIME',item.key,'TIME_TEXT_NOT_UNIQUELY_LOCATED');continue}
      // A dependent action must not inherit the predecessor's own deadline
      // unless its own source quotation also supports that date.
      const citesTime=owner=>list(owner?.evidence,12,500).some(quote=>{const cited=locateSourceQuote(quote,source);return cited&&cited.start<=span.start&&cited.end>=span.end})
      const predecessorOnly=kind==='task'&&entry.role==='deadline'&&!citesTime(item)&&list(item.dependsOn,20,40).some(key=>{
        const predecessor=keys.get(key)
        if(predecessor?.kind!=='task'||!citesTime(predecessor.item))return false
        const ownChannel=sourceChannel(source,text(item.channel,160)),parentChannel=sourceChannel(source,text(predecessor.item.channel,160))
        const attached=list(item.evidence,12,500).some(quote=>locateSourceQuote(quote,source)&&/(?:另|再|还|一并|同时)?(?:需|须|应|请)?(?:另|再)?附(?:上|带)?/u.test(quote)&&compact(quote).includes(compact(item.object))&&!/(?:另行(?:提交|通知)|另有截止|单独截止|另定时间)/u.test(quote))
        // A source-grounded attachment to the same submission is part of the
        // parent's delivery; a later independent step is not.
        return !(attached&&ownChannel&&parentChannel&&compact(ownChannel)===compact(parentChannel))
      })
      if(predecessorOnly){note('TIME',item.key,'PREDECESSOR_DEADLINE_NOT_SHARED');continue}
      if(recoveredEvidence&&!ownText.includes(span.literal)){note('TIME',item.key,'RECOVERED_ITEM_TIME_SCOPE_UNCERTAIN');continue}
      if(kind==='task'&&conflictingDeliveryScope(source,span.literal,text(item.deliveryForm,80)||item.title)){note('TIME',item.key,'TIME_OTHER_DELIVERY_SCOPE');continue}
      if(kind==='event'&&entry.role==='end'&&!sourceDay.test(foldWidth(span.literal))&&!/\d{1,2}\s*[:：点时]/u.test(span.literal)&&/(?:持续|历时|用时|时长|耗时|进行)\s*[：:]?\s*(?:约)?\s*[0-9０-９一二两三四五六七八九十半]+(?:个)?(?:小时|分钟)/u.test(span.literal)){
        // A duration cited as an end is not itself a calendar date. The
        // independently sourced duration remains in the event description.
        audit.facts.push({item:item.key,role:'duration',raw:span.literal,sourceStart:span.start,sourceEnd:span.end})
        continue
      }
      if(kind==='event'&&entry.role==='end'&&/(?:(?:结束|散场)(?:时间)?(?:将|暂|会)?(?:另行|后续|待|尚未|未定)|(?:尚未|未|待)[^，。；;]{0,12}(?:结束|散场)(?:时间)?)/u.test(span.literal)){
        const id=evidence(span.literal,'deadline',item.key,span.start)
        if(id)entity.evidenceIds=[...new Set([...entity.evidenceIds,id])].slice(0,20)
        if(!entity.description.includes(span.literal))entity.description+=(entity.description?'\n':'')+'时间说明：'+span.literal
        audit.facts.push({item:item.key,role:'event_end',raw:span.literal,value:null,sourceStart:span.start,sourceEnd:span.end})
        continue
      }
      // The model may separately cite a shared day and a precise start clock.
      // Keep one precise start rather than treating the date as a competing start.
      if(sharedDay&&entry.role==='start'&&span.start===sharedDay.start&&span.end===sharedDay.end)continue
      let parseText=span.literal,dateEvidenceId=null,nextDayStart=null
      if(kind==='event'&&entry.role==='end'&&/^(?:次日|翌日|第二天|隔日|隔天)/u.test(foldWidth(span.literal))){
        const start=result.timePoints.find(point=>point.tempId===entity.startTimePointTempId)
        const startSpan=start&&locateSourceQuote(start.rawText,source)
        const sameClause=startSpan&&startSpan.end<=span.start&&!/[。；;\n！？]/u.test(source.slice(startSpan.end,span.start))
        const sameCitation=sameClause&&list(item.evidence,12,500).some(quote=>locateSourceQuote(quote,source)&&compact(quote).includes(compact(start.rawText))&&compact(quote).includes(compact(span.literal)))
        if(sameCitation&&start.normalizedValue?.includes('T')&&!start.needsConfirmation){
          const date=new Date(start.normalizedValue.slice(0,10)+'T00:00:00Z')
          if(!Number.isNaN(date.getTime())){
            date.setUTCDate(date.getUTCDate()+1)
            const [year,month,day]=date.toISOString().slice(0,10).split('-')
            parseText=`${year}年${Number(month)}月${Number(day)}日`+span.literal.replace(/^(?:次日|翌日|第二天|隔日|隔天)/u,'')
            nextDayStart=start
            audit.facts.push({item:item.key,role:'event_end_next_day',start:start.rawText,raw:span.literal})
          }
        }
      }
      if(!sourceDay.test(foldWidth(span.literal))&&!nextDayStart){
        // A bare clock must not silently inherit today's date. Only recover a
        // single explicit day from the same uninterrupted source clause.
        const prefix=source.slice(Math.max(0,span.start-60),span.start),boundary=Math.max(prefix.lastIndexOf('。'),prefix.lastIndexOf('；'),prefix.lastIndexOf(';'),prefix.lastIndexOf('\n'))+1
        const localPrefix=prefix.slice(boundary),foldedPrefix=foldWidth(localPrefix),matches=[...foldedPrefix.matchAll(new RegExp(sourceDay.source,'gu'))]
        const day=matches.length===1?matches[0]:matches.length===2&&/\d/u.test(matches[0][0])
          &&/^[（(]\s*(?:本周|下周|周|星期)[一二三四五六日天]\s*[）)]\s*$/u.test(foldedPrefix.slice(matches[0].index+matches[0][0].length))?matches[0]:null
        const anchored=kind==='event'?(contextualEventDay(source,span,item)||owned?.day||sharedDay):day?{start:span.start-localPrefix.length+day.index,end:span.start-localPrefix.length+day.index+day[0].length}:null
        if(!anchored){
          // Keep a source-backed clock as text when the day is unknown. It is
          // not a calendar timestamp and must never inherit the reference day.
          const clock=foldWidth(span.literal).trim()
          const clockOnly=/^(?:(?:凌晨|清晨|早上|上午|中午|下午|傍晚|晚上|夜间|夜里)\s*)?(?:\d{1,2}\s*[:：]\s*\d{2}|[\d一二两三四五六七八九十]{1,3}\s*[点时](?:\s*[\d一二两三四五六七八九十]{1,3}\s*分?|\s*半)?)$/u.test(clock)
          if(kind==='event'&&entry.role==='start'&&clockOnly&&!/(?:备选|候选|任选|或者|或)/u.test(ownText)){
            const id=evidence(span.literal,'event',item.key,span.start)
            if(id){const line='时间说明：'+span.literal+'（日期待定）';if(!entity.description.split('\n').includes(line))entity.description+=(entity.description?'\n':'')+line;entity.evidenceIds=[...new Set([...entity.evidenceIds,id])].slice(0,20)}
          }
          // Preserve an unanchored relative expression without assigning a date.
          if(!/[\d０-９]/u.test(span.literal)&&/(?:前|后|期间|开始时|结束时)/u.test(span.literal)){
            const line='时间说明：'+span.literal
            if(!entity.description.split('\n').includes(line))entity.description+=(entity.description?'\n':'')+line
          }
          const nearby=source.slice(Math.max(0,span.start-24),span.start)
          note('TIME',item.key,/(?:次日|翌日|第二天|隔日|隔天|次周|翌周)\s*$/u.test(nearby)?'TIME_DAY_OWNER_UNCERTAIN':'TIME_DAY_NOT_DETERMINED');continue
        }
        const dateStart=anchored.start,dateEnd=anchored.end
        const dateLiteral=source.slice(dateStart,dateEnd)
        const between=source.slice(dateEnd,span.start)
        if(/(?:次日|翌日|第二天|隔日|隔天|次周|翌周|改为|改至|调整至|更正为)/u.test(between+span.literal)){
          const relative=between.match(/(?:次日|翌日|第二天|隔日|隔天|次周|翌周)[^，,；;。]{0,10}$/u)?.[0]??''
          entity.description+=(entity.description?'\n':'')+'时间说明：'+relative+span.literal
          note('TIME',item.key,'TIME_DAY_OWNER_UNCERTAIN');continue
        }
        dateEvidenceId=evidence(dateLiteral,'deadline',item.key,dateStart)
        if(!dateEvidenceId){note('TIME',item.key,'TIME_CONTEXT_NOT_LOCATED');continue}
        // Compose only the two bound fragments. Including the intervening
        // source would allow a previous activity's clock to be parsed here.
        const decoration=source.slice(dateEnd,span.start).match(/^\s*[（(]\s*(?:周|星期)[一二三四五六日天]\s*[）)]/u)?.[0]??''
        parseText=dateLiteral+decoration+' '+span.literal
      }
      const eid=evidence(span.literal,'deadline',item.key,span.start),role=entry.role==='deadline'?'task_deadline':entry.role==='end'?'event_end':'event_start'
      if(!eid)continue
      if(distinctActionDeadline(entry)){
        const line='截止说明（仅限该行动）：'+span.literal
        if(!entity.description.includes(line)&&entity.description.length+line.length+1<=800)entity.description=[entity.description,line].filter(Boolean).join('\n')
        else if(!entity.description.includes(line))note('CAPACITY',item.key,'ITEM_FIELD_TRUNCATED')
        entity.evidenceIds=[...new Set([...entity.evidenceIds,eid])].slice(0,20)
        note('TIME',item.key,'COMBINED_ACTION_TIME_OWNER_UNRESOLVED')
        continue
      }
      if(entry.sourceRecovered){const ref=result.evidence.find(value=>value.id===eid);if(ref)ref.extractionMethod='parser'}
      const before=source.slice(Math.max(0,span.start-80),span.start),after=source.slice(span.end,Math.min(source.length,span.end+80))
      const clause=timeRoleContext(source,span)
      const previous=/(?:原定|原截止|原时间)/u.test(before)&&/(?:取消|作废|废止)/u.test(after)&&/(?:改为|改至|调整为|调整至|延期至|更正为)/u.test(after)
      const normalizedClause=foldWidth(clause),normalizedTime=foldWidth(span.literal)
      const candidateScope=/(?:备选|候选|可选).{0,12}(?:时段|时间|日期)|(?:时段|时间|日期).{0,12}(?:备选|候选)/u
      const sameClauseWindows=timeEntries.filter(time=>time?.role==='window'&&typeof time.raw==='string'&&compact(normalizedClause).includes(compact(time.raw)))
      const explicitlyUnchosen=sameClauseWindows.length>=2&&/(?:或者|或|任选|择一)/u.test(normalizedClause)&&/(?:可能|拟于|尚未确定|未确定|未定|待定|候选|备选|任选)/u.test(normalizedClause)
      const sourceCandidate=entry.role==='window'&&(explicitlyUnchosen||candidateScope.test(normalizedClause)&&(requirements.some(requirement=>candidateScope.test(requirement)&&compact(requirement).includes(compact(span.literal)))||sameClauseWindows.length>=2))
      const alternative=/任选|备选|可选择|或者|或/u.test(normalizedTime)||sourceCandidate
      const cutoffClause=normalizedClause.replace(/提前/gu,'').replace(/[（(](?:周|星期)[一二三四五六日天][）)]/gu,'').replace(/\s/gu,'')
      const explicitCutoff=/(?:截止|截至|最迟|不晚于|之前|以前|(?:日|号|分|时|点|\d)前)/u.test(cutoffClause)
        ||/(?:申请|报名|提交|报送)[^。；;]{0,20}(?:时间|期限)/u.test(cutoffClause)&&/逾期(?:将)?(?:不再受理|不予受理|不受理)/u.test(cutoffClause)&&!/办理窗口|开放时间/u.test(cutoffClause)
        ||/^即日起(?:至|到)/u.test(compact(normalizedTime))&&/逾期[^，,。；;]{0,12}(?:不再受理|不予受理|不受理)/u.test(cutoffClause)
      const closingCutoff=kind==='task'&&entry.role==='deadline'&&sourceChannelClosingDeadline(source,item,span)
      const unsafeDeadline=entry.role==='deadline'&&(kind!=='task'||alternative||!explicitCutoff&&!closingCutoff||deadlineRangeRoleIssue(normalizedTime,role,normalizedClause))
      let parsed=parseDirectSourceTime(parseText,{type:role,referenceTime,timezone})
      if(entry.role==='window'&&!alternative){
        parsed=parseWindowWithDailyHours(span.literal,{referenceTime,timezone})??parsed
        const parts=/^(.+?)(?:开放|开启|开始)\s*[，,；;]\s*(.+?)(?:关闭|结束|停止)$/u.exec(foldWidth(span.literal).trim())
        if(parts&&sourceDay.test(parts[1])&&sourceDay.test(parts[2])){
          const start=parseDirectSourceTime(parts[1],{type:'event_start',referenceTime,timezone})
          const end=parseDirectSourceTime(parts[2],{type:'event_end',referenceTime,timezone})
          if(start.normalizedValue?.includes('T')&&end.normalizedValue?.includes('T')&&!start.needsConfirmation&&!end.needsConfirmation&&end.normalizedValue>start.normalizedValue)
            parsed={...start,rangeEndNormalizedValue:end.normalizedValue}
        }
      }
      const candidate=entry.role==='end'?(parsed.rangeEndNormalizedValue??parsed.normalizedValue):parsed.normalizedValue
      const modality=sourceTimeModality(span.literal,clause)
      const value=previous||alternative||unsafeDeadline||entity.sourceStatus==='uncertain'||modality!=='confirmed'||parsed.needsConfirmation?null:candidate
      if(modality!=='confirmed'){
        const line=(modality==='tentative'?'暂定时间：':'建议完成时间：')+span.literal
        if(!entity.description.split('\n').includes(line))entity.description+=(entity.description?'\n':'')+line
      }
      if(!value)note('TIME',item.key,previous?'OBSOLETE_TIME':alternative?'TIME_ALTERNATIVES_UNRESOLVED':unsafeDeadline?'UNSAFE_DEADLINE_ROLE':modality==='tentative'?'TIME_TENTATIVE_NOT_CONFIRMED':modality==='suggested'?'TIME_SUGGESTION_NOT_DEADLINE':'TIME_UNRESOLVED')
      const point={tempId:'sem-p'+(result.timePoints.length+1),type:role,rawText:span.literal,normalizedValue:value,timezone,isAllDay:value?parsed.isAllDay:false,precision:value?parsed.precision:'vague',needsConfirmation:!value,relatedTaskTempIds:kind==='task'?[entity.tempId]:[],relatedMaterialTempIds:[],evidenceIds:[...new Set([eid,dateEvidenceId,...(nextDayStart?.evidenceIds??[])].filter(Boolean))].slice(0,20),confidence:.8,selected:Boolean(value)}
      if(entry.role==='window'&&alternative){
        // A proposed survey slot is not an opening time or an appointment.
        // Keep its literal meaning in the already saved description instead.
        const line=(kind==='task'?'备选时间：':'参加须知：备选时间 ')+span.literal
        if(!compact(entity.description).includes(compact(span.literal)))entity.description+=(entity.description?'\n':'')+line
        entity.evidenceIds=[...new Set([...entity.evidenceIds,eid])].slice(0,20)
        audit.facts.push({item:item.key,role:'alternative',raw:span.literal,sourceStart:span.start,sourceEnd:span.end})
        continue
      }
      if(entry.role==='window'){
        // A service window belongs to the task, but is neither a deadline nor
        // a personal plan. Store its actual source-backed endpoints.
        if(kind==='task'){
          const endOnly=!parsed.rangeEndNormalizedValue&&/^(?:自?即日起|从现在起|自(?:通知|发布)之日起|直至|截至|至|到)\s*(?:至|到|—|-)?/u.test(foldWidth(span.literal).trim())
          if(endOnly)point.type='event_end'
          point.tempId='sem-window-'+(endOnly?'end':'start')+'-'+(result.timePoints.length+1)
          result.timePoints.push(point);entity.timePointTempIds.push(point.tempId)
          if(parsed.rangeEndNormalizedValue&&!previous&&!alternative&&modality==='confirmed'&&entity.sourceStatus!=='uncertain'&&!parsed.needsConfirmation){
            const end={...point,tempId:'sem-window-end-'+(result.timePoints.length+1),type:'event_end',normalizedValue:parsed.rangeEndNormalizedValue}
            result.timePoints.push(end);entity.timePointTempIds.push(end.tempId)
          }
          entity.evidenceIds=[...new Set([...entity.evidenceIds,eid])].slice(0,20)
          entity.description+=(entity.description?'\n':'')+'办理时段：'+span.literal
        } else entity.description+=(entity.description?'\n':'')+'参加须知：办理时段 '+span.literal
        audit.facts.push({item:item.key,role:'window',raw:span.literal,value,sourceStart:span.start,sourceEnd:span.end})
        continue
      }
      if(kind==='task'&&(entry.role==='start'||entry.role==='end')){
        // A task's source-side processing time is not a personal plan or an
        // event. Keep the wording without claiming a deadline or appointment.
        entity.description+=(entity.description?'\n':'')+(entry.role==='start'?'办理开始：':'办理结束：')+span.literal
        continue
      }
      if(kind==='event'&&role==='task_deadline'){note('TIME',item.key,'EVENT_DEADLINE_HAS_NO_TASK');continue}
      const prior=result.timePoints.find(p=>p.type===role&&(kind==='task'?p.relatedTaskTempIds.includes(entity.tempId):[entity.startTimePointTempId,entity.endTimePointTempId].includes(p.tempId)))
      // A source-cited date and an independently cited clock for the same
      // event are complementary when they resolve to the very same day. Keep
      // the more precise fact and both citations; do not relax actual conflicts.
      const sameDayRefinement=unifiedContract&&kind==='event'&&role==='event_start'&&prior?.selected&&point.selected
        &&typeof prior.normalizedValue==='string'&&typeof point.normalizedValue==='string'
        &&prior.normalizedValue.slice(0,10)===point.normalizedValue.slice(0,10)
        &&((prior.precision==='date_only'&&point.precision==='exact')||(prior.precision==='exact'&&point.precision==='date_only'))
      if(sameDayRefinement){
        const evidenceIds=[...new Set([...prior.evidenceIds,...point.evidenceIds])].slice(0,20)
        if(point.precision==='exact')Object.assign(prior,point,{tempId:prior.tempId,evidenceIds})
        else prior.evidenceIds=evidenceIds
        entity.evidenceIds=[...new Set([...entity.evidenceIds,...evidenceIds])].slice(0,20)
        audit.facts.push({item:item.key,role:'same_day_refinement',raw:span.literal,value:prior.normalizedValue,sourceStart:span.start,sourceEnd:span.end})
        continue
      }
      if(prior&&prior.normalizedValue!==point.normalizedValue){prior.normalizedValue=null;prior.precision='vague';prior.needsConfirmation=true;prior.selected=false;point.normalizedValue=null;point.precision='vague';point.needsConfirmation=true;point.selected=false;note('TIME',item.key,'CONFLICTING_TIME_VALUES')}
      result.timePoints.push(point);entity.evidenceIds=[...new Set([...entity.evidenceIds,eid])].slice(0,20)
      if(kind==='task')entity.timePointTempIds.push(point.tempId)
      else if(role==='event_start')entity.startTimePointTempId??=point.tempId
      else entity.endTimePointTempId??=point.tempId
      audit.facts.push({item:item.key,role,raw:span.literal,value,sourceStart:span.start,sourceEnd:span.end})
    }
  }

  for(const [index,material] of raw.materials.entries()) {
    if(!object(material)||!text(material.key,40)||!text(material.name,160)){note('MATERIAL',String(index),'INVALID_MATERIAL');continue}
    const owners=[...new Set([...list(material.owners,20,40),...pending.filter(x=>list(x.item.materials,20,40).includes(material.key)).map(x=>x.item.key)])].flatMap(key=>keys.get(key)?.kind==='task'?[keys.get(key).entity]:[])
    if(!owners.length){note('MATERIAL',material.key,'MATERIAL_OWNER_MISSING');continue}
    const refs=list(material.evidence,12,500),ids=refs.flatMap(q=>{const e=evidence(q,'materials',material.key);return e?[e]:[]})
    if(!ids.length){note('MATERIAL',material.key,'MATERIAL_EVIDENCE_MISSING');continue}
    if(material.sourceRecovered)for(const id of ids){const ref=result.evidence.find(value=>value.id===id);if(ref)ref.extractionMethod='parser'}
    const channel=text(material.channel,160),channelInSource=sourceChannel(source,channel)
    // A shared material must not carry one delivery's exclusive channel into
    // a different owner. That owner's own separately grounded channel remains.
    const ownerRecords=pending.filter(record=>owners.includes(record.entity))
    const ownerScope=record=>refinedContract?sourceBackedDeliveryScope(record):(text(record.item.deliveryForm,80)||record.item.title)
    const kinds=new Set(ownerRecords.map(record=>deliveryKind(ownerScope(record))).filter(Boolean))
    const mixedDelivery=kinds.has('paper')&&kinds.has('electronic')&&ownerRecords.every(record=>deliveryKind(ownerScope(record)))
    const inlineFormats=unifiedContract?sourceMaterialInlineFormats(source,material.name,refs):[]
    const formats=[...new Set([...list(material.formats,20,160),...inlineFormats])].slice(0,20),naming=list(material.naming,20,160),requirements=supportedRequirements(material.requirements,material.key)
    const scopedOwnerFacts=refinedContract&&ownerRecords.length>1&&[...formats,...naming].some(value=>{
      const supportedOwners=ownerRecords.filter(owner=>hasLiteral(owner.ownText,value))
      return supportedOwners.length>0&&supportedOwners.length<ownerRecords.length
    })
    // Reserve room for each remaining source material. If distinct delivery
    // variants exceed the wire contract, retain one conservative shared
    // material and report partial rather than emitting an invalid result.
    const available=60-result.materials.length-(raw.materials.length-index-1)
    const conditional=conditionalMaterialClause(source,text(material.name,160),refs)
    const optional=sourceOptionalMaterialClause(source,material.name,refs)
    const ownerUses=ownerRecords.map(record=>materialUseForOwner(source,record,text(material.name,160))??(refinedContract&&typeof material.required!=='boolean'&&!optional&&!conditional?directlyCitedMaterialUse(source,record,text(material.name,160)):null))
    const differentUses=ownerRecords.length>1&&ownerUses.every(Boolean)&&new Set(ownerUses.map(value=>value.required)).size>1
    const splitDelivery=(mixedDelivery||differentUses||scopedOwnerFacts)&&ownerRecords.length<=available
    if((mixedDelivery||differentUses||scopedOwnerFacts)&&!splitDelivery)note('MATERIAL',material.key,'SHARED_DELIVERY_CAPACITY')
    const wrongChannelScope=Boolean(channelInSource&&ownerRecords.some(record=>conflictingDeliveryScope(source,channelInSource,ownerScope(record))))
    const supportedChannel=wrongChannelScope?null:channelInSource||null
    if(inlineFormats.length)audit.facts.push({role:'material_inline_format',material:material.key,formats:inlineFormats})
    if(Array.isArray(material.formats)&&material.formats.length>20)note('MATERIAL',material.key,'FORMAT_INPUT_OVERFLOW')
    if(Array.isArray(material.naming)&&material.naming.length>20)note('MATERIAL',material.key,'NAMING_INPUT_OVERFLOW')
    if([...(Array.isArray(material.formats)?material.formats:[]),...(Array.isArray(material.naming)?material.naming:[])].some(value=>typeof value==='string'&&value.trim().length>160))note('CAPACITY',material.key,'MATERIAL_FIELD_TRUNCATED')
    if(channel&&!supportedChannel)note('CHANNEL',material.key,wrongChannelScope?'CHANNEL_OTHER_DELIVERY_SCOPE':'CHANNEL_NOT_SOURCE_GROUNDED')
    const quantity=Number.isFinite(material.quantity)&&material.quantity>0?material.quantity:null
    const materialEvidence=refs.join('\n')
    const groundedMaterialRequirements=requirements.filter(requirement=>hasLiteral(materialEvidence,requirement)&&hasLiteral(source,requirement))
    const sameTaskCondition=Boolean(conditional)&&ownerRecords.every(record=>{
      const action=compact(record.item.action),object=compact(record.item.object),name=compact(material.name)
      return action&&object&&name&&object.includes(name)&&compact(conditional).includes(action)&&compact(conditional).includes(object)
    })
    const allOwnedRequirements=uniqueRequirements([...(conditional?[conditional]:[]),...(optional?[optional]:[]),...groundedMaterialRequirements.filter(value=>!conditional||!compact(conditional).endsWith(compact(value)))])
    if(allOwnedRequirements.length>20||conditional.length>800)note('MATERIAL',material.key,'MATERIAL_REQUIREMENT_OVERFLOW')
    const ownedRequirements=allOwnedRequirements.slice(0,20)
    if(conditional)audit.facts.push({role:'conditional_material',material:material.key,sourceText:conditional})
    const scoped=(value,record,kind)=>{
      if(!mixedDelivery&&!scopedOwnerFacts)return true
      const form=ownerScope(record)
      if(mixedDelivery&&conflictingDeliveryScope(source,value,form))return false
      const ownerKind=deliveryKind(form),explicitKind=deliveryKind(value,{explicitOnly:true})
      if(mixedDelivery&&explicitKind&&ownerKind!==explicitKind)return false
      if(mixedDelivery&&/^(?:这|该|上述|两(?:个|份)|这些|两种)(?:份)?(?:文件|材料|文档)/u.test(value)){
        const span=locateSourceQuote(value,source)
        if(span){
          const before=source.slice(0,span.start),boundary=Math.max(before.lastIndexOf('。'),before.lastIndexOf('\n'))+1
          const prior=deliveryKind(source.slice(boundary,span.start),{explicitOnly:true})
          if(prior&&prior!==ownerKind)return false
        }
      }
      // When a format or naming requirement is cited by one delivery only,
      // do not make it an obligation of a different delivery form.
      const onlyOwners=ownerRecords.filter(owner=>hasLiteral(owner.ownText,value))
      const formatFact=kind!=='requirement'||formats.some(format=>compact(value).includes(compact(format)))
      return !formatFact||!onlyOwners.length||onlyOwners.includes(record)
    }
    const materialOwners=splitDelivery?[...ownerRecords].sort((a,b)=>Number(deliveryKind(ownerScope(a))!=='paper')-Number(deliveryKind(ownerScope(b))!=='paper')):ownerRecords
    for(const [ownerIndex,record] of materialOwners.entries()){
      const owner=record.entity,form=ownerScope(record)
      const ownerChannel=sourceChannel(source,text(record.item.channel,160))
      const ownMaterialChannel=splitDelivery?(ownerChannel&&!conflictingDeliveryScope(source,ownerChannel,form)?ownerChannel:channelInSource&&!conflictingDeliveryScope(source,channelInSource,form)?channelInSource:null):supportedChannel
      const sharedScope=(value,kind)=>(mixedDelivery||scopedOwnerFacts)&&!splitDelivery?ownerRecords.every(other=>scoped(value,other,kind)):scoped(value,record,kind)
      const ownerUse=ownerUses[ownerRecords.indexOf(record)]
      // Workspace v8 has a boolean only. For this contract a missing model
      // value cannot silently become a definite obligation: use the non-blocking
      // boolean together with an explicit, persisted unknown-status marker.
      const sharedUse=refinedContract&&ownerUses.length>1&&ownerUses.every(use=>use&&use.required===ownerUses[0].required)?ownerUses[0]:null
      const inferredUse=splitDelivery||ownerRecords.length===1?ownerUse:sharedUse
      const unknownRequired=unifiedContract&&typeof material.required!=='boolean'&&!inferredUse&&!optional&&!conditional
      const required=unknownRequired?false:splitDelivery&&ownerUse?ownerUse.required:!optional&&(typeof material.required==='boolean'?material.required:inferredUse?.required??true)&&(!conditional||sameTaskCondition)
      const useRequirements=ownerUse?.requirement?[ownerUse.requirement]:[]
      const scopedRequirements=uniqueRequirements([...(unknownRequired?['是否必交待确认']:[]),...ownedRequirements.filter(value=>sharedScope(value,'requirement')),...useRequirements])
      if(unknownRequired)note('MATERIAL',material.key,'MATERIAL_REQUIRED_UNRESOLVED')
      if(scopedRequirements.length>20)note('MATERIAL',material.key,'MATERIAL_REQUIREMENT_OVERFLOW')
      const m={tempId:'sem-m'+(index+1)+(splitDelivery?'-delivery-'+(ownerIndex+1):''),name:text(material.name,160),required,formatRequirements:formats.filter(value=>sharedScope(value,'format')),namingRequirements:naming.filter(value=>sharedScope(value,'naming')),requirements:scopedRequirements.slice(0,20),quantity,submissionChannel:ownMaterialChannel,relatedTaskTempIds:splitDelivery?[owner.tempId]:owners.map(t=>t.tempId),evidenceIds:[...new Set(ids)],confidence:.8,selected:true}
      if(splitDelivery||ownerIndex===0)result.materials.push(m)
      owner.materialTempIds.push(m.tempId);owner.evidenceIds=[...new Set([...owner.evidenceIds,...ids])].slice(0,20)
      // Merge task-level and material-level requirements once, preserving the
      // stronger full wording and any distinct negation or quantity qualifier.
      if(record){
        const previousLines=new Set(record.requirements.map(value=>'要求：'+value))
        record.baseLines=owner.description.split('\n').filter(line=>line&&!previousLines.has(line))
        const ownedMaterialCount=raw.materials.filter(value=>object(value)&&(list(record.item.materials,20,40).includes(value.key)||list(value.owners,20,40).includes(record.item.key))).length
        // A requirement already attached to one of several materials should
        // not be repeated as an unqualified requirement for the whole task.
        const taskRequirements=requirements.filter(value=>scoped(value,record,'requirement')&&!(ownedMaterialCount>1&&m.requirements.some(saved=>compact(saved)===compact(value))))
        record.requirements=uniqueRequirements([...record.requirements,...taskRequirements])
        applyTaskRequirements(owner,record.baseLines,record.requirements,material.key)
      }
    }
  }
  // Explicit document-level requirements attach only to the task keys named
  // by the model, and the saved wording is always an actual source span.
  // A local alignment failure never clears an otherwise valid task.
  const shared=Array.isArray(raw.sharedRequirements)?raw.sharedRequirements:[]
  if(shared.length>40)note('REQUIREMENT','shared','SHARED_REQUIREMENT_INPUT_OVERFLOW')
  for(const [index,entry] of shared.slice(0,40).entries()){
    if(!object(entry)){note('REQUIREMENT',String(index),'INVALID_SHARED_REQUIREMENT');continue}
    if(Array.isArray(entry.owners)&&entry.owners.length>20)note('REQUIREMENT',String(index),'SHARED_REQUIREMENT_OWNER_OVERFLOW')
    if(Array.isArray(entry.evidence)&&entry.evidence.length>12)note('REQUIREMENT',String(index),'SHARED_REQUIREMENT_EVIDENCE_OVERFLOW')
    if(Array.isArray(entry.evidence)&&entry.evidence.some(value=>typeof value==='string'&&value.trim().length>500))note('REQUIREMENT',String(index),'SHARED_REQUIREMENT_EVIDENCE_TRUNCATED')
    const ownerKeys=list(entry.owners,20,40),quotes=list(entry.evidence,12,500)
    if(!ownerKeys.length||!quotes.length){note('REQUIREMENT',String(index),'SHARED_REQUIREMENT_OWNER_OR_EVIDENCE_MISSING');continue}
    const ids=quotes.flatMap(quote=>{const id=evidence(quote,'description','shared-'+index);return id?[id]:[]})
    if(!ids.length){note('REQUIREMENT',String(index),'SHARED_REQUIREMENT_UNGROUNDED');continue}
    const spans=ids.map(id=>result.evidence.find(item=>item.id===id)).filter(Boolean)
    for(const ownerKey of ownerKeys){
      const record=pending.find(item=>item.item.key===ownerKey&&item.kind==='task')
      if(!record){note('REQUIREMENT',ownerKey,'SHARED_REQUIREMENT_OWNER_MISSING');continue}
      const accepted=spans.filter(span=>!conflictingDeliveryScope(source,span.quote,text(record.item.deliveryForm,80)||record.item.title,{explicitOnly:true}))
      if(accepted.length!==spans.length)note('REQUIREMENT',ownerKey,'SHARED_REQUIREMENT_OTHER_DELIVERY_SCOPE')
      if(!accepted.length)continue
      const oldLines=new Set(record.requirements.map(value=>'要求：'+value))
      record.baseLines=record.entity.description.split('\n').filter(line=>line&&!oldLines.has(line))
      record.requirements=uniqueRequirements([...record.requirements,...accepted.map(span=>span.quote)])
      applyTaskRequirements(record.entity,record.baseLines,record.requirements,ownerKey)
      const refs=[...new Set([...record.entity.evidenceIds,...accepted.map(span=>span.id)])]
      if(refs.length>20)note('REQUIREMENT',ownerKey,'SHARED_REQUIREMENT_EVIDENCE_OVERFLOW')
      record.entity.evidenceIds=refs.slice(0,20)
    }
  }
  // Reuse a document-wide qualification only for model-linked task owners;
  // retain its original words and do not infer that the user qualifies.
  const scope=sharedDocumentScope(source,raw)
  if(scope){
    const related=new Set(shared.filter(entry=>object(entry)&&list(entry.owners,20,40).length>1&&list(entry.evidence,12,500).some(q=>locateSourceQuote(q,source))).flatMap(entry=>list(entry.owners,20,40)))
    for(const record of pending.filter(r=>r.kind==='task'&&related.has(r.item.key))){
      const line='适用条件待确认：'+scope.literal
      if(record.entity.description.includes(scope.literal))continue
      if(record.entity.description.length+line.length+1>800||record.entity.evidenceIds.length>=20){note('CONDITION',record.item.key,'SHARED_CONDITION_OVERFLOW');continue}
      const id=evidence(scope.literal,'description',record.item.key,scope.start)
      if(!id)continue
      record.entity.description+=(record.entity.description?'\n':'')+line
      record.entity.evidenceIds=[...new Set([...record.entity.evidenceIds,id])]
      record.entity.userConfirmationRequired=true;record.entity.selected=false
      audit.facts.push({role:'shared_condition',owner:record.entity.tempId,sourceEvidenceId:id})
    }
  }
  const candidate=sourceCandidateTime(source,raw,pending)
  if(candidate){
    const line='备选时间：'+candidate.literal,task=candidate.record.entity
    if(!task.description.includes(candidate.literal)&&task.description.length+line.length+1<=800&&task.evidenceIds.length<20){
      const id=evidence(candidate.literal,'description',candidate.record.item.key,candidate.start)
      if(id){task.description+=(task.description?'\n':'')+line;task.evidenceIds=[...new Set([...task.evidenceIds,id])];audit.facts.push({role:'candidate_times',owner:task.tempId,sourceEvidenceId:id})}
    }
  }
  for(const record of pending){
    const context=sourceFormContext(source,raw,record,pending),task=record.entity
    if(context&&!compact(task.title).includes(compact(context))&&task.title.length+context.length+2<=80){
      task.title+=`（${context}）`
      audit.facts.push({role:'form_context',owner:task.tempId,context})
    }
  }
  for(const pair of sourceBackedChoicePairs(source,raw,pending)){
    const ids=pair.records.map(record=>record.entity.tempId)
    const eid=evidence(pair.quote,'description','choice',pair.start)
    if(!eid||result.conflicts.some(conflict=>conflict.id.startsWith('sem-choice-')&&ids.every(id=>conflict.entityTempIds.includes(id))))continue
    result.conflicts.push({id:'sem-choice-'+eid,type:'other',message:pair.quote,entityTempIds:ids,evidenceIds:[eid],requiresDecision:false})
    for(const record of pair.records){
      const citations=Array.isArray(record.item.evidence)?record.item.evidence:[]
      const action=typeof record.item.action==='string'?record.item.action.trim():'',object=typeof record.item.object==='string'?record.item.object.trim():''
      const preferred=Boolean(action&&object)&&citations.some(quote=>typeof quote==='string'&&/^(?:请)?优先/u.test(quote.trim())&&locateSourceQuote(quote,source)&&quote.includes(action)&&quote.includes(object))
      if(preferred&&!record.entity.completionCriteria.includes('优先使用此方式')){
        const description=[record.entity.description,'要求：优先使用此方式'].filter(Boolean).join('\n')
        if(record.entity.completionCriteria.length<12&&description.length<=800){record.entity.completionCriteria.push('优先使用此方式');record.entity.description=description}
        else note('RELATION',record.item.key,'CHOICE_PREFERENCE_OVERFLOW')
      }
    }
    audit.facts.push({role:'choice_branches',sourceEvidenceId:eid,owners:ids})
  }
  for(const choice of sourceBackedEventChoices(source,pending)){
    const ids=choice.records.map(record=>record.entity.tempId)
    const eid=evidence(choice.quote,'description','event-choice',choice.start)
    if(!eid)continue
    for(const record of choice.records)record.entity.sourceStatus='alternative'
    result.conflicts.push({id:'sem-event-choice-'+eid,type:'other',message:choice.quote,entityTempIds:ids,evidenceIds:[eid],requiresDecision:false})
    audit.facts.push({role:'event_choice_alternatives',sourceEvidenceId:eid,owners:ids})
  }
  if(['recognition-semantic-notice-3.7.0','recognition-semantic-notice-3.8.0','recognition-semantic-notice-3.9.0','recognition-semantic-notice-3.10.0','recognition-semantic-notice-3.11.0'].includes(promptVersion))for(const choice of declaredTaskChoices(source,pending)){
    const owners=choice.records.map(record=>record.entity.tempId)
    if(result.conflicts.some(conflict=>conflict.id.startsWith('sem-choice-')&&owners.some(id=>conflict.entityTempIds.includes(id))))continue
    const eid=evidence(choice.quote,'description','choice',choice.start)
    if(!eid)continue
    result.conflicts.push({id:'sem-choice-'+eid,type:'other',message:choice.quote,entityTempIds:owners,evidenceIds:[eid],requiresDecision:false})
    audit.facts.push({role:'declared_choice_branches',owners,sourceEvidenceId:eid})
  }
  combineSupportedChoices(result,audit)
  if(['recognition-semantic-notice-3.3.0','recognition-semantic-notice-3.4.0','recognition-semantic-notice-3.5.0','recognition-semantic-notice-3.6.0','recognition-semantic-notice-3.7.0','recognition-semantic-notice-3.8.0','recognition-semantic-notice-3.9.0','recognition-semantic-notice-3.10.0','recognition-semantic-notice-3.11.0'].includes(promptVersion))applySemanticActorRelations({result,pending,source,evidence,note,audit,timezone,includeContextFacts:['recognition-semantic-notice-3.5.0','recognition-semantic-notice-3.6.0','recognition-semantic-notice-3.7.0','recognition-semantic-notice-3.8.0','recognition-semantic-notice-3.9.0','recognition-semantic-notice-3.10.0','recognition-semantic-notice-3.11.0'].includes(promptVersion),documentContext:unifiedContract?raw.contextFacts:[],respectPersonalNeed:refinedContract,respectVoluntary:goalContract})
  if(goalContract)applySemanticGoalRelations({raw,result,pending,source,evidence,note,audit})
  if(['recognition-semantic-notice-3.6.0','recognition-semantic-notice-3.7.0','recognition-semantic-notice-3.8.0','recognition-semantic-notice-3.9.0','recognition-semantic-notice-3.10.0'].includes(promptVersion))applyEventIncidentalNotices({result,pending,source,evidence,note,audit})
  result.sourceSummary.title=text(raw.topic,160)||result.standaloneTasks[0]?.title||result.events[0]?.title||'通知'
  const onlyCancellation=audit.items.length>0&&audit.items.every(item=>item.status==='CANCELLED')
  result.sourceSummary.requiresAction=!onlyCancellation&&(raw.kind==='action'||raw.kind==='mixed'||result.standaloneTasks.length>0)
  result.sourceSummary.notificationType=result.standaloneTasks.length?'teacher_task':result.events.length?'event_notice':raw.kind==='information'||onlyCancellation?'information_only':'uncertain'
  result.sourceSummary.summary=text(raw.summary,500)||[result.standaloneTasks.length+'项任务',result.events.length+'项活动'].join('，')
  const partial=raw.partial===true||list(raw.unresolved,10).length>0||audit.losses.some(loss=>loss.reason!=='CANCELLED_ITEM')||raw.kind!=='information'&&!onlyCancellation&&!result.standaloneTasks.length&&!result.events.length
  if(partial){result.quality.needsHumanReview=true;result.quality.reviewReasons=['部分内容尚未完整整理，请查看原通知。'];result.ambiguities.push({id:'sem-partial',field:'source_reference',message:'部分内容尚未完整整理，原文已保留。',options:['查看原文'],evidenceIds:[]})}
  return {result,audit,rootFailure:false}
}
