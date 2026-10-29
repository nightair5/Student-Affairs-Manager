import {parseDirectSourceTime} from '../../cloudflare/direct-source-time.mjs'
import {localSubmissionChannel} from './localNoticeFacts'
import type {EvidenceReference} from '../types'
import type {MaterialSuggestionV2, RecognitionResult, TaskSuggestionV2, TimePointSuggestionV2} from './types'

/** A source-level interpretation of an explicit shared delivery list. It is
 * intentionally independent of numbering style and of any model's item IDs. */
interface Line {text:string; start:number}
interface ListedMaterial {name:string; line:Line; detail:string}
const formNames = {electronic:'电子版',paper:'纸质版'} as const
const formatName = {electronic:'电子',paper:'纸质'} as const
const verb = /提交|递交|报送|上交|发送|上传/u
const alternative = /任选|二选一|两种方式(?:中)?(?:选|任选)|不要求两种|其中一种|(?:纸质|电子)[^。；\n]{0,25}(?:或者|或)[^。；\n]{0,25}(?:纸质|电子)/u
const normal = (value:string) => value.normalize('NFKC').replace(/[\uFE0F\u20E3]/gu,'')
const escapeRegExp = (value:string) => value.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&')

function linesOf(source:string):Line[] {
  // Chinese sentence boundaries also separate multiple sections written on a
  // single line. ASCII periods remain intact in addresses and file names.
  return [...source.matchAll(/[^\r\n。；;]+[。；;]?/gu)].map(m=>({text:m[0],start:m.index!}))
}

function materialName(text:string):string {
  return text.replace(/^[\s\p{Extended_Pictographic}\uFE0F\u20E3]+/gu,'')
    .replace(/^(?:\d{1,2}|[一二三四五六七八九十]+)[.、．:：)）\s]*/u,'')
    .split(/[：:（(]/u)[0].trim().replace(/[，,。；;\s]+$/gu,'')
}

function materialList(lines:Line[], sharedIndex:number):ListedMaterial[] {
  if(/以下|下列/u.test(lines[sharedIndex].text)) {
    const after:ListedMaterial[]=[]
    for(let i=sharedIndex+1;i<Math.min(lines.length,sharedIndex+16);i++){
      const text=normal(lines[i].text).trim()
      if(!/^(?:\d{1,2}|[一二三四五六七八九十]+)(?:[.、．:：)）\s]|(?=\p{Script=Han}))/u.test(text)){
        if(after.length&&/(?:截止|时间|报送方式|提交方式|电子版|纸质版)/u.test(text))break
        continue
      }
      const name=materialName(text)
      if(name.length<2||name.length>35||verb.test(name)||/要求|时间|方式|资格|奖励/u.test(name))continue
      after.push({name,line:lines[i],detail:text.replace(/^(?:\d{1,2}|[一二三四五六七八九十]+)[.、．:：)）\s]*/u,'')})
    }
    if(after.length)return after
  }
  // The list must be introduced as something the recipient must submit. A
  // numbered list of examples, award categories or background is not enough.
  for(let i=sharedIndex-1;i>=0;i--) {
    const intro=normal(lines[i].text).replace(/^[\s\p{Extended_Pictographic}]+/gu,'')
    // A numbered item may itself contain a subordinate “仅需提交”; it is
    // an item requirement, not the introduction to the whole list.
    if(/^(?:\d{1,2}|[一二三四五六七八九十]+)(?:[.、．:：)）\s]|(?=\p{Script=Han}))/u.test(intro))continue
    const hit=/(?:^|[：:])(?:[\p{Script=Han}]{0,12}?)(?:须|需|应|请)(?:要)?(?:提交|递交|报送|上交|提供)(.*)$/u.exec(intro)
    if(!hit) continue
    const inline=hit[1].replace(/^[\s：:，,]+/u,'').split(/[。；;]/u)[0]
    if(inline && /[、，,和]/u.test(inline)) {
      const names=inline.split(/[、，,]|(?:以及|和)/u).map(materialName).filter(n=>n.length>=2&&n.length<=35)
      if(names.length>=2) return [...new Set(names)].map(name=>({name,line:lines[i],detail:''}))
    }
    if(inline && !/^(?:以下|如下|下列|材料|文件|资料)[：:]?$/u.test(inline)) continue
    const result:ListedMaterial[]=[]
    for(let j=i+1;j<sharedIndex;j++) {
      const text=normal(lines[j].text).trim()
      if(!/^(?:\d{1,2}|[一二三四五六七八九十]+)(?:[.、．:：)）\s]|(?=\p{Script=Han}))/u.test(text)) continue
      const name=materialName(text)
      if(name.length<2||name.length>35||verb.test(name)||/要求|时间|方式|资格|奖励/u.test(name)) continue
      result.push({name,line:lines[j],detail:text.replace(/^(?:\d{1,2}|[一二三四五六七八九十]+)[.、．:：)）\s]*/u,'')})
    }
    if(result.length) return result
  }
  return []
}

function shortTopic(source:string):string {
  const first=source.split(/\r?\n/u).find(x=>x.trim())?.trim()??''
  const topic=first.replace(/^[【[《\s]+|[】\]》\s]+$/gu,'').replace(/^关于(?:开展|举办)?/u,'')
    .replace(/(?:作品征集|材料征集|报名通知|征集通知|通知|公告)$/u,'').trim()
  return topic.length>=3&&topic.length<=32&&!/[。；;]/u.test(topic)?topic:''
}

function distinct<T>(rows:T[]):T[] {return [...new Set(rows)]}

/** Apply only when the source explicitly says that the same named materials
 * must be delivered in both forms. Alternative choices remain untouched. */
export function composeSharedSubmissions(input:RecognitionResult,source:string):RecognitionResult {
  if(input.evidence.some(e=>e.id.startsWith('shared-submission:'))) return input
  const lines=linesOf(source)
  const sharedIndex=lines.findIndex(line=>{
    const s=normal(line.text)
    return /(?:以上|以下|上述|所有|全部|这些|下列|上述所有).{0,12}(?:材料|文件|资料|作品)/u.test(s)
      && /(?:均须|均需|均应|都须|都需|全部须|同时|分别)/u.test(s)
      && /(?:电子版|电子材料|电子文件)/u.test(s) && /(?:纸质版|纸质材料|纸质文件)/u.test(s)
      && verb.test(s) && !alternative.test(s)
  })
  if(sharedIndex<0)return input
  const listed=materialList(lines,sharedIndex)
  if(!listed.length)return input
  const shared=lines[sharedIndex]
  const r=structuredClone(input),sourceId=r.evidence[0]?.sourceId??'source'
  const evidence=(line:Line,field:EvidenceReference['field']):string=>{
    const id=`shared-submission:${line.start}:${field}`
    if(!r.evidence.some(e=>e.id===id))r.evidence.push({id,sourceId,quote:line.text,quotedText:line.text,textStart:line.start,textEnd:line.start+line.text.length,field,extractionMethod:'parser',confidence:1})
    return id
  }
  const sharedId=evidence(shared,'description')
  const topic=shortTopic(source)
  const headline=source.split(/\r?\n/u).find(line=>line.trim())??''
  const headlineStart=source.indexOf(headline)
  const headlineKey=(value:string)=>normal(value).replace(/[\p{P}\p{S}\s]/gu,'').replace(/^\d{4}年?/u,'')
  const topicCore=normal(topic).replace(/^\d{4}年?/u,'').replace(/[\p{P}\p{S}\s]/gu,'')
  const commonObject=/报名材料|参赛材料|申请材料|申报材料|参赛作品|作品|材料/u.exec(shared.text+'\n'+source)?.[0]??'材料'
  const priorTasks=[...r.standaloneTasks,...r.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])]
  // Keep other independent tasks and their references. Replace only previous
  // interpretations of this shared delivery or its incomplete headings.
  const isSameDelivery=(t:TaskSuggestionV2)=>{
    const title=t.title+' '+t.actionObject
    // A model can label a noun inside an announcement headline as an action
    // (“学习笔记” → “学习”). A headline-only extraction is redundant once
    // the explicitly requested deliveries have been reconstructed.
    const headlineOnly=t.evidenceIds.length>0&&t.evidenceIds.every(id=>{
      const e=r.evidence.find(ref=>ref.id===id),quote=e?.quotedText||e?.quote
      const at=typeof e?.textStart==='number'&&quote&&source.slice(e.textStart,e.textStart+quote.length)===quote?e.textStart:quote&&source.indexOf(quote)===source.lastIndexOf(quote)?source.indexOf(quote):-1
      return Boolean(quote&&at>=headlineStart&&at+quote.length<=headlineStart+headline.length)
    })
    if(headlineOnly&&headlineKey(t.title)===headlineKey(headline)&&/(?:征集|征稿|通知|公告)$/u.test(headlineKey(t.title)))return true
    // A generic invitation to take part is not a second registration step
    // when the actual submission is already represented by these deliveries.
    const invitationOnly=/^(?:报名|参加)$/u.test(t.title.trim())&&/^(?:欢迎|诚邀).{0,18}(?:报名|参加)/u.test(t.actionObject.trim())
    const ownDeadline=r.timePoints.some(p=>p.relatedTaskTempIds.includes(t.tempId)&&p.normalizedValue)
    const ownChannel=/(?:报名|注册)(?:系统|平台|网址|入口|链接)|(?:登录|通过)[^。；\n]{0,20}(?:报名|注册)/u.test(t.description)
    if(invitationOnly&&!ownDeadline&&!ownChannel&&!t.materialTempIds.length)return true
    if(/^(?:提交|递交|报送|上交|发送|上传)(?:电子版|纸质版)(?:和|与|及|、)(?:电子版|纸质版)$/u.test(normal(t.title).replace(/\s/gu,'')))return true
    const compactTitle=normal(title).replace(/[\p{P}\p{S}\s]/gu,'')
    const scopedObject=/^(?:电子|纸质)(?:版)?(?:材料|文件|资料|作品)?$/u.test(normal(t.actionObject).replace(/\s/gu,''))
      || listed.some(item=>title.includes(item.name)) || topicCore.length>=3&&compactTitle.includes(topicCore)
    if(/(?:电子|纸质)/u.test(title)&&/提交|递交|报送|上传|发送/u.test(title)&&scopedObject)return true
    if(/^(?:截止时间|提交|材料|文件|资料)$/u.test(t.actionObject.trim())||/学生须提交/u.test(t.actionObject))return true
    if(/^(?:提交|递交|报送|上交|发送|上传)$/u.test(t.actionVerb)&&listed.every(item=>title.includes(item.name)))return true
    return false
  }
  const replaced=new Set(r.standaloneTasks.filter(isSameDelivery).map(t=>t.tempId))
  for(const milestone of r.milestones){
    const nested=[...milestone.tasks,...milestone.workPackages.flatMap(w=>w.tasks)]
    for(const t of nested)if(isSameDelivery(t))replaced.add(t.tempId)
    milestone.tasks=milestone.tasks.filter(t=>!replaced.has(t.tempId))
    for(const work of milestone.workPackages)work.tasks=work.tasks.filter(t=>!replaced.has(t.tempId))
  }
  r.standaloneTasks=r.standaloneTasks.filter(t=>!replaced.has(t.tempId))
  r.materials=r.materials.flatMap(m=>{const owners=m.relatedTaskTempIds.filter(id=>!replaced.has(id));return owners.length?[{...m,relatedTaskTempIds:owners}]:[]})
  r.timePoints=r.timePoints.flatMap(p=>{const owners=p.relatedTaskTempIds.filter(id=>!replaced.has(id));const eventOwned=r.events.some(e=>e.startTimePointTempId===p.tempId||e.endTimePointTempId===p.tempId);return owners.length||eventOwned?[{...p,relatedTaskTempIds:owners}]:[]})
  const formatLines=lines.filter(x=>/Word|PDF|DOCX|扫描件|复印件|格式|命名|注明/iu.test(x.text))
  const commonRequirements=lines.filter(x=>/(?:作品|材料|笔记|报告|申请).{0,12}(?:须为|必须|不得|不包括|不超过|至少|原创)/u.test(x.text)&&!/可包括|例如|比如/u.test(x.text))
  const qualification=lines.find(line=>/(?:符合.{0,20}条件|仅限.{0,20}(?:学生|同学|人员)|有意参赛|自愿报名)/u.test(line.text))
  for(const role of ['electronic','paper'] as const) {
    const form=formNames[role],formWord=formatName[role]
    const id=`shared-delivery:${shared.start}:${role}`
    const roleLines=lines.filter(line=>line.text.includes(formWord))
    const cancelled=roleLines.some(line=>{
      const text=normal(line.text)
      if(/取消.{0,8}资格/u.test(text))return false
      return new RegExp('(?:'+formWord+'(?:版|材料|文件)?(?:的)?(?:提交|递交|报送|上交|发送|上传)?(?:已|现|将)?(?:取消|作废|停止)|(?:取消|禁止|停止|不再|无需)(?:提交|递交|报送|上交|发送|上传)?'+formWord+')','u').test(text)
    })
    if(cancelled)continue
    const deadlineLines=roleLines.filter(line=>/截止|截至|之前|以前|\d\s*前/u.test(normal(line.text))&&!/(?:另行通知|另行公布|待通知)/u.test(line.text))
    const parsed=deadlineLines.flatMap(line=>{const p=parseDirectSourceTime(line.text,{type:'submission_deadline',referenceTime:r.createdAt,timezone:'Asia/Shanghai'});return p.normalizedValue&&!p.needsConfirmation?[{line,p}]:[]})
    const dates=distinct(parsed.map(x=>x.p.normalizedValue))
    const selectedDate=dates.length===1?parsed.find(x=>x.p.normalizedValue===dates[0]):undefined
    const unknownLine=roleLines.find(line=>/截止|时间/u.test(line.text)&&/(?:另行通知|另行公布|待通知)/u.test(line.text))
    const channels=distinct(roleLines.map(line=>localSubmissionChannel(line.text)).filter((x):x is string=>Boolean(x)))
    const channel=channels.length===1?channels[0]:null
    const roleEvidence=roleLines.filter(line=>verb.test(line.text)||/截止|时间|通知/u.test(line.text)).slice(0,4).map(line=>evidence(line,'description'))
    const old=priorTasks.find(t=>t.title.includes(formWord)&&isSameDelivery(t))
    const task:TaskSuggestionV2={tempId:id,parentTempId:null,hierarchyType:'task',title:`提交${topic?topic+' ':''}${form}材料`,actionVerb:'提交',actionObject:commonObject,
      description:distinct([shared.text,...roleLines.filter(line=>/另行通知|另行公布|提交方式|命名|注明/u.test(line.text)).map(line=>line.text),...commonRequirements.map(line=>line.text),...(qualification?['适用条件待确认：'+qualification.text]:[])]).join('\n'),
      completionCriteria:[],estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:[],materialTempIds:[],timePointTempIds:[],evidenceIds:distinct([sharedId,...roleEvidence,...(qualification?[evidence(qualification,'requirement')]:[])]),confidence:1,inferenceLevel:'explicit',userConfirmationRequired:Boolean(qualification)||old?.selected===false,selected:!qualification&&old?.selected!==false}
    if(unknownLine&&!task.description.includes(unknownLine.text))task.description+='\n'+unknownLine.text
    for(const [index,item] of listed.entries()) {
      const mid=`${id}:material:${index+1}`,eid=evidence(item.line,'materials')
      const requirements:string[]=[]
      if(item.detail!==item.name&&item.detail.includes(item.name))requirements.push(item.detail)
      for(const line of formatLines) {
        if(!line.text.includes(item.name))continue
        const match=new RegExp(escapeRegExp(item.name)+'(?:和[^，,。；;（）()]{1,25})?[（(]([^（）()]{1,60})[）)]','iu').exec(line.text)
        if(match&&/Word|PDF|DOCX|扫描/iu.test(match[1])&&(role==='electronic'||!/Word|PDF|DOCX/iu.test(match[1])))requirements.push(match[1])
      }
      // A shared sentence can describe both forms; keep only the naming
      // clause that explicitly belongs to this form.
      const naming=distinct(roleLines.flatMap(line=>line.text.split(/[，,]/u).map(s=>s.trim()).filter(s=>s.includes(formWord)&&/命名|注明/u.test(s))))
      const m:MaterialSuggestionV2={tempId:mid,name:item.name,required:true,formatRequirements:distinct(requirements),namingRequirements:distinct(naming),quantity:null,submissionChannel:channel,relatedTaskTempIds:[id],evidenceIds:[eid,sharedId],confidence:1,selected:true}
      r.materials.push(m);task.materialTempIds.push(mid)
    }
    if(selectedDate) {
      const pid=`${id}:deadline`,eid=evidence(selectedDate.line,'deadline')
      const p:TimePointSuggestionV2={tempId:pid,type:'submission_deadline',rawText:selectedDate.line.text,normalizedValue:selectedDate.p.normalizedValue,timezone:'Asia/Shanghai',isAllDay:selectedDate.p.isAllDay,precision:selectedDate.p.precision,needsConfirmation:false,relatedTaskTempIds:[id],relatedMaterialTempIds:[],evidenceIds:[eid],confidence:1,selected:true}
      r.timePoints.push(p);task.timePointTempIds.push(pid)
    } else if(unknownLine) {
      const pid=`${id}:deadline`,eid=evidence(unknownLine,'deadline')
      const p:TimePointSuggestionV2={tempId:pid,type:'submission_deadline',rawText:unknownLine.text,normalizedValue:null,timezone:'Asia/Shanghai',isAllDay:false,precision:'vague',needsConfirmation:true,relatedTaskTempIds:[id],relatedMaterialTempIds:[],evidenceIds:[eid],confidence:1,selected:true}
      r.timePoints.push(p);task.timePointTempIds.push(pid)
    }
    r.standaloneTasks.push(task)
  }
  // An explicit direction to join a group is actionable; a bare contact or a
  // statement that a group exists is not.
  const join=lines.find(line=>/请(?:参赛|报名|相关|有意)?(?:同学|学生|人员)?加入(?:参赛)?(?:群聊|群组|群)/u.test(line.text))
  if(join&&!r.standaloneTasks.some(t=>/加入/u.test(t.title)&&/群/u.test(t.title))) {
    const match=/(?:请(?:参赛|报名|相关|有意)?(?:同学|学生|人员)?)(加入(?:参赛)?(?:群聊|群组|群))/u.exec(join.text)
    if(match){const object=match[1].replace(/^加入/u,''),eid=evidence(join,'description');r.standaloneTasks.push({tempId:`shared-delivery:${shared.start}:join`,parentTempId:null,hierarchyType:'task',title:'加入'+object+'查看后续通知',actionVerb:'加入',actionObject:object,description:join.text,completionCriteria:[],estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:[],materialTempIds:[],timePointTempIds:[],evidenceIds:[eid],confidence:1,inferenceLevel:'explicit',userConfirmationRequired:false,selected:true})}
  }
  return r
}
