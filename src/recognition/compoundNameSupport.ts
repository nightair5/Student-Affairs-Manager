export const COMPOUND_NAME_SUPPORT_VERSION='source-compound-name-support-1.6.1'
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&')
/** Closed grammatical equivalence, not a bag of words across source clauses. */
export function supportedCoordinatedObject(value:string,action:string,quotes:string[]):boolean {
  const parts=value.split('和')
  if(parts.length!==2||parts.some(p=>!p.trim()))return false
  const verb='(?:激活|登录|填写|提交|上传|领取|准备|核对)'
  const predicate=new RegExp(`${verb}${escape(parts[0])}和${verb}${escape(parts[1])}(?:$|[，。；])`,'u')
  return predicate.test(action)&&quotes.some(q=>q.includes(action)&&predicate.test(q))
}
/** "活动" may be a generic noun after a literal named activity. It cannot
 * replace a missing identity, bind another owner, or manufacture a second event. */
export function supportedEventDescriptor(value:string,quotes:string[]):boolean {
  // Omitting the linking particle does not change a quoted topic or event
  // type. The complete named topic and the same type must occur together.
  const named=/^((?:“[^“”\n]{1,100}”|《[^《》\n]{1,100}》))(主题(?:讲座|报告|研讨会))$/u.exec(value)
  if(named&&quotes.some(q=>new RegExp(escape(named[1])+'\\s*的\\s*'+escape(named[2]),'u').test(q)))return true
  if(!value.endsWith('活动'))return false
  const name=value.slice(0,-2)
  if(!name||!/(?:学校|工作坊|讲座|培训|研讨会)$/u.test(name))return false
  return quotes.some(q=>new RegExp(`(?:举办|举行|开展|组织|开办)(?:线上|线下|本次|一次|年度)?${escape(name)}(?:[，。；]|$|于|活动)`,'u').test(q)
    || new RegExp(`${escape(name)}(?:活动)?(?:将|于[^，。；]{1,30})?(?:开始|举行)(?:[，。；]|$)`,'u').test(q))
}

/** An entity followed by an explicit operation is a closed display name.
 * Stitch only uniquely located, contiguous cited spans (including a URL split
 * at its colon), never unrelated words or different owners. */
export function supportedEventOperation(value:string,quotes:string[],sourceText:string,allowTimedOperationNames=false):boolean {
  const service=/^(.+?)暂停服务$/u.exec(value)
  if(service){
    const pattern=new RegExp(`(?:^|[、，。；\\s])${escape(service[1])}服务(?:将)?停止运行(?:[。；！!]|$)`,'gu')
    if(quotes.some(q=>q&&sourceText.includes(q)&&sourceText.indexOf(q)===sourceText.lastIndexOf(q)
      &&[...q.matchAll(pattern)].some(m=>!/若|如果|假如|取消|不再|不会|不得|不|未/u.test(q.slice(0,m.index).split(/[。；\n]/u).at(-1)??'')))
    )return true
  }
  const title=/^(.+?)(暂停服务|升级维护|停机维护|升级检修|正式开馆|停机|维护)$/u.exec(value)
  if(!title)return false
  const [,entity,operation]=title
  const spans=[...new Set(quotes)].flatMap(quote=>{
    const start=sourceText.indexOf(quote)
    return quote&&start>=0&&sourceText.indexOf(quote,start+1)<0?[{start,end:start+quote.length}]:[]
  }).sort((a,b)=>a.start-b.start)
  const runs:Array<{start:number;end:number}>=[]
  for(const span of spans){const last=runs.at(-1);if(last&&span.start<=last.end)last.end=Math.max(last.end,span.end);else runs.push({...span})}
  const verb=new RegExp(`对${escape(entity)}(?:（[^）\\n]*）|\\([^）)\\n]*\\))?进行${escape(operation)}(?:[，。；]|$)`,'gu')
  let found=false
  for(const run of runs){
    const text=sourceText.slice(run.start,run.end)
    for(const m of text.matchAll(verb)){
      const prefix=text.slice(0,m.index).split(/[，。；\n]/u).at(-1)??''
      if(/若|如果|假如|取消|不再|不会|不|勿|不得|未计划/u.test(prefix))return false
      found=true
    }
    const timed=new RegExp(`${escape(entity)}((?:本学期|将|在|于|进行|\\d|年|月|日|周|星期|本|次|晚|上|午|下|早|凌晨|时|点|分|秒|到|至|[一二三四五六七八九十零〇]|[（()）:：—–\\-\\s]){0,64})${escape(operation)}(?:[，。；]|$)`,'gu')
    for(const m of allowTimedOperationNames?text.matchAll(timed):[]){
      const prefix=text.slice(0,m.index).split(/[，。；\n]/u).at(-1)??''
      if(/若|如果|假如|取消|不|未|勿/u.test(prefix))return false
      const sentenceLead=text.slice(0,m.index).split(/[。；\n]/u).at(-1)??''
      if(/(?:若|如果|假如)/u.test(sentenceLead))return false
      found=true
    }
  }
  return found
}

/** Validate an existing attendance action, never create one. A mandatory
 * attendance statement for the same literal object is not a prohibition on
 * attending. Conditional, cancelled and other-object statements stay blocked. */
export function supportedAttendanceAction(action:string,object:string,quotes:string[]):boolean {
  if(!['参加','参会','出席'].includes(action)||!object)return false
  return quotes.some(q=>q.split(/[。；\n]/u).some(clause=>{
    if(!clause.includes(object)||/若|如果|假如|取消|无需|不必|不得参加|禁止参加|不得参会|禁止参会|不得出席/u.test(clause))return false
    const tail=clause.slice(clause.indexOf(object)+object.length)
    return /^(?:[^。；\n]{0,100})(?:不得缺席|必须出席|须出席|务必参加|必须参加)(?:[，,。；\s]|$)/u.test(tail)
  }))
}

/** A labelled range or a date-qualified collective service name can be a
 * faithful title without being one contiguous quotation. Every field must be
 * in this event's own uniquely located citation. The date qualifier must also
 * be in an existing owned endpoint; no foreign date/entity is borrowed. */
export function supportedLabelledEventName(value:string,quotes:string[],source:string,ownedTimes:string[]):string|null {
  const own=quotes.filter(q=>q&&source.includes(q)&&source.indexOf(q)===source.lastIndexOf(q))
  const labelled=/^(.+?)(暂停开放)$/u.exec(value)
  if(labelled&&own.some(q=>new RegExp('^'+escape(labelled[2])+'范围[：:]\\s*'+escape(labelled[1])+'(?:（[^）]*）)?[。.]?$','u').test(q.trim())))return 'EXPLICIT_OPERATION_RANGE_LABEL'
  // A uniquely cited value may omit only its immediately adjacent field label.
  // Retain the full parenthetical scope. No other clause supplies the role.
  if(labelled&&own.some(q=>q.trim().replace(/[。.]$/u,'')===labelled[1]&&new RegExp('^\\s*(?:\\d+[.、]\\s*)?'+escape(labelled[2])+'范围[：:]\\s*$','u').test(source.slice(0,source.indexOf(q)).split(/[。；\n]/u).at(-1)??'')))return 'EXPLICIT_ADJACENT_OPERATION_RANGE_LABEL'
  const collective=/^(.+?)在线服务暂停（((?:\d{1,2}月\d{1,2}日))停电时段）$/u.exec(value)
  if(!collective)return null
  const [,facility,date]=collective
  if(!ownedTimes.length||!ownedTimes.every(t=>t.startsWith(date)))return null
  const body=new RegExp(escape(facility)+'[^，。；\n]*[、及和]其他在线服务将暂时无法正常使用[。.]?$','u')
  return own.some(q=>ownedTimes.every(t=>q.includes(t))&&q.includes('停电时段内')&&body.test(q)
    &&!/若|如果|假如|取消|预计|可能|不会|不再/u.test(q))?'EXPLICIT_COLLECTIVE_SERVICE_AND_OWN_DATE':null
}
