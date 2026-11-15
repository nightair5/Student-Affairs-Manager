/** Determine a local action's polarity from its own cited clause.  This only
 * rejects an action when every matching mention is explicitly negated; a
 * different prohibited action or a later affirmative instruction cannot
 * cancel an otherwise valid obligation. */
export function localActionExplicitlyNegated(text:string,verb:string,object:string):boolean {
 if(!verb||!object)return false
 const plain=(s:string)=>s.normalize('NFKC').replace(/\s/gu,'')
 const original=plain(object)
 // A local parser can mistake an entire negated clause for the object of
 // the same verb (e.g. “已登记的人无需重新报名”). Resolve that malformed
 // action from its own cited wording; do not cancel a different positive
 // instruction elsewhere in the notice.
 const embedded=original.lastIndexOf(verb),prefix=embedded>=0?original.slice(0,embedded):''
 if(embedded>=0&&plain(text).includes(original)&&/(?:无需|无须|不必|不用|不需要|不再)(?:再次|再|重新|另行|额外)?$/u.test(prefix))return true
 const normalizedObject=original.replace(/^(?:如符合条件)?(?:无需|无须|不用|不必|不需要|不要求|不再|禁止|不得|不要|请勿)(?:再次|再|重新|另行|额外|主动)*/u,'')
 const target=normalizedObject.startsWith(verb)?normalizedObject.slice(verb.length):normalizedObject
 const mentions:boolean[]=[]
 for(const raw of text.split(/[，,；;。！？\n]/u)){
  const clause=plain(raw)
  let at=clause.indexOf(verb)
  while(at>=0){
   const before=clause.slice(0,at),after=clause.slice(at+verb.length)
   const relevant=target?after.slice(0,80).includes(target)||before.slice(-40).includes(target):clause.includes(original)
   if(relevant){
    const negations=[...before.matchAll(/无需|无须|不必|不用|不需要|不要求|不允许|不得|禁止|请勿|不要|不能|不可|不再/gu)]
    const negation=negations.at(-1)
    const between=negation?before.slice(negation.index!+negation[0].length):''
    const reset=/(?:仍需|仍须|仍要|必须|务必|请|需要|要求|可以|允许|应当|应予|但|而)/u.test(between)
    mentions.push(Boolean(negation&&between.length<=30&&!reset))
   }
   at=clause.indexOf(verb,at+verb.length)
  }
 }
 return mentions.length>0&&mentions.every(Boolean)
}

/** Explanatory descriptions of a topic and statements about what an organiser
 * does not provide are not student instructions. Never suppress a separate
 * explicit imperative for the same object. */
export function localBackgroundNotUserAction(text:string,verb:string,object:string):boolean {
 if(!object)return false
 const clauses=text.split(/[。；;！？\n]/u).filter(c=>c.includes(object))
 if(!clauses.length)return false
 return clauses.every(clause=>{
  const at=clause.indexOf(object),before=clause.slice(0,at)
  // An explanation can mention an obligation while explicitly denying that
  // it follows ("不代表需要提交..."). Scope the denial to the same comma
  // clause; a later "请提交..." remains a separate positive directive.
  const actionAt=clause.indexOf(verb+object)
  const own=actionAt>=0?clause.slice(Math.max(clause.lastIndexOf('，',actionAt),clause.lastIndexOf(',',actionAt))+1):clause
  const ownAction=own.indexOf(verb+object)
  if(ownAction>=0&&/(?:不代表|不表示|不意味着)[^，,。；;]{0,40}$/u.test(own.slice(0,ownAction)))return true
  // A relational statement about attending A and B is not itself a new
  // imperative to attend the entire comparison as one malformed object.
  if(/不代表|不表示|不意味着/u.test(object)&&ownAction>=0&&!/请|须|务必|应当/u.test(own.slice(0,ownAction)))return true
  // An already-completed registration can modify the audience of another
  // instruction (“已报名同学携带…”); it is not an instruction to register.
  if(/^(?:报名|登记|申请)$/u.test(verb)&&/^(?:同学|学生|人员|成员|志愿者)(?:携带|准备|参加|填写|提交|领取)/u.test(object)&&/(?:已|曾|未)(?:经)?(?:报名|登记|申请)\s*$/u.test(before))return true
  if(/(?:请|务必|须|需要|应当|请大家|请同学)[^。；]{0,30}$/u.test(before))return false
  if(/^(?:工作|类别|流程|要求|安排)$/u.test(object)&&actionAt>=0
    &&/(?:的|不是|不属于)[^，,。；;]{0,10}$/u.test(clause.slice(0,actionAt)))return true
  // In a nominal date label, the parser can make the suffix itself an
  // action object ("领取" + "日"). That is neither a deliverable nor an
  // instruction. A genuine imperative with a concrete object is retained.
  if(/^(?:日|日期|时间|时段|阶段|流程)$/u.test(object)&&clause.includes(verb+object)
    &&/(?:为|是|设为)[^，,。；;]{0,30}$/u.test(clause.slice(0,clause.indexOf(verb+object))))return true
  // “报名成功/报名流程/报名网站” describes a state or a noun phrase,
  // not an instruction whose object is “成功/流程/网站”. A separate
  // reader-directed action in the same source is handled independently.
  if(/^(?:报名|申请|申报)$/u.test(verb)&&/^(?:成功|失败|通知|流程|网站|通道|条件|资格|对象)/u.test(object))return true
  if(verb==='准备'&&/(?:围绕|介绍|讲解|探讨|讨论|内容包括|内容涵盖)/u.test(before))return true
  return verb==='核对'&&!/(?:核对|核实|检查|确认|查看)/u.test(clause)&&/(?:^|[，,])[^，,]{1,30}不负责(?:提供|安排|组织)/u.test(clause.trim())
 })
}

/** Exclude explanatory comparisons from attendance/eligibility inference.
 * Keep other comma clauses, including a separately stated invitation. */
export function localParticipationContext(text:string):string {
 if(!/不代表|不表示|不意味着/u.test(text))return text
 return text.split(/[。；;！？\n]/u).map(sentence=>sentence.split(/[，,]/u).flatMap(clause=>{
    const at=clause.search(/不代表|不表示|不意味着/u)
    if(at<0)return [clause]
    const later=/(?:但|仍然|仍)请[^。；;]+/u.exec(clause.slice(at))
    return later?[later[0]]:[]
  }).join('，')).join('；')
}

/** A cited past biography is not a present invitation. A separately cited
 * current mention wins; no inference is made merely from a date being past. */
export function localHistoricalEventOnly(text:string,title:string):boolean {
 if(!title)return false
 const mentions=text.split(/[。；;！？\n]/u).filter(c=>c.includes(title))
 return mentions.length>0&&mentions.every(c=>/(?:曾于|曾在|曾经|往年|历届|此前|去年|历史上)/u.test(c)&&!/(?:本次|此次|将于|即将|欢迎参加|请参加)/u.test(c))
}

/** A following local pronoun can cancel the named event without repeating
 * its title. Require a single literal mention and an adjacent cancellation;
 * registration cancellation and a different event's status are not inherited. */
export function localEventCancelledByReference(text:string,title:string):boolean {
 if(!title)return false
 const mentions=text.split(/[。；;！？\n]/u).filter(clause=>clause.includes(title))
 return mentions.length===1&&new RegExp('^[，,]\\s*(?:后者|该场(?:活动)?|本场(?:活动)?|该活动)(?:已|现|临时|予以)?(?:取消|不再举行)(?:[，,。；;\\s]|$)','u')
  .test(mentions[0].slice(mentions[0].indexOf(title)+title.length).replace(/^(?:照常|正常|继续)?(?:举行|举办|开展|进行)/u,''))
}

/** Source-attributed administrative processing is not the reader's schedule.
 * An explicit invitation to participate wins over the organiser's role. */
export function localOrganizerOnlyEvent(text:string,title:string):boolean {
 if(!/(?:评审|审核|审查|复核|汇总|报送|公布|公示)(?:会|工作|阶段|流程)?$/u.test(title)&&!/^(?:评审|审核|审查|复核|汇总|报送|公布|公示)/u.test(title))return false
 const mentions=text.split(/[。；;！？\n]/u).filter(clause=>clause.includes(title))
 if(!mentions.length)return false
 return mentions.every(clause=>{
  if(/(?:请|邀请|欢迎|建议)[^。；;\n]{0,30}(?:参加|出席|担任|到场)/u.test(clause))return false
  return organizerProcessingClauses(clause).some(process=>process.text.includes(title))
 })
}

/** An explicit non-reader subject + administrative predicate, not a bare
 * process keyword. Invitations and role-specific reader instructions remain
 * personal/conditional actions even when the same notice describes a review. */
export function organizerProcessingClauses(source:string):Array<{text:string;start:number;actor:string}> {
 const process=/(?:审核|评审|审查|复核|汇总|报送|上报|受理|发证|公布|公示)/u
 return [...source.matchAll(/[^。！？；;\n]+/gu)].flatMap(sentence=>{
  const text=sentence[0].trim(),start=sentence.index!+sentence[0].indexOf(text)
  if(!process.test(text))return []
  const first=text.split(/[，,]/u)[0]
  if(/(?:请|须|需|必须|邀请|欢迎|建议)[^，,。；;\n]{0,35}(?:参加|出席|到场|担任)/u.test(text)||/^(?:请|如|若|仅限)/u.test(first))return []
  const match=/^(?:由)?([\p{Script=Han}]{2,18}?)(?=(?:将|会(?=于|在|审核|评审|汇总)|负责|统一|于|在|本周|下周|周[一二三四五六日天]|星期[一二三四五六日天]|\d{1,2}月))/u.exec(first)
  const actor=match?.[1]
  if(!actor||/(?:学生|同学|本人|自己|你|申请人|报名者|入选者|志愿者|评委|代表)$/u.test(actor))return []
  if(!/(?:方|会|处|部|中心|办公室|学院|学校|老师|教师|单位|团队|机构)$/u.test(actor)&&!/^由/u.test(first))return []
  if(!process.test(first.slice(match![0].length)))return []
  // A new reader directive following a comma is outside the actor's scope.
  const boundary=text.search(/[，,]\s*(?=(?:请|同学|学生|申请人|报名者|入选者|如|若|仅限))/u)
  return [{text:boundary>=0?text.slice(0,boundary):text,start,actor}]
 })
}
