/** Determine a local action's polarity from its own cited clause.  This only
 * rejects an action when every matching mention is explicitly negated; a
 * different prohibited action or a later affirmative instruction cannot
 * cancel an otherwise valid obligation. */
export function localActionExplicitlyNegated(text:string,verb:string,object:string):boolean {
 if(!verb||!object)return false
 const plain=(s:string)=>s.normalize('NFKC').replace(/\s/gu,'')
 const original=plain(object)
 const normalizedObject=original.replace(/^(?:如符合条件)?(?:无需|无须|不用|不必|不需要|不要求|不再|禁止|不得|不要|请勿)(?:再|重新|另行|额外|主动)*/u,'')
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
  if(/(?:请|务必|须|需要|应当|请大家|请同学)[^。；]{0,30}$/u.test(before))return false
  // “报名成功/报名流程/报名网站” describes a state or a noun phrase,
  // not an instruction whose object is “成功/流程/网站”. A separate
  // reader-directed action in the same source is handled independently.
  if(/^(?:报名|申请|申报)$/u.test(verb)&&/^(?:成功|失败|通知|流程|网站|通道|条件|资格|对象)/u.test(object))return true
  if(verb==='准备'&&/(?:围绕|介绍|讲解|探讨|讨论|内容包括|内容涵盖)/u.test(before))return true
  return verb==='核对'&&!/(?:核对|核实|检查|确认|查看)/u.test(clause)&&/(?:^|[，,])[^，,]{1,30}不负责(?:提供|安排|组织)/u.test(clause.trim())
 })
}

/** A cited past biography is not a present invitation. A separately cited
 * current mention wins; no inference is made merely from a date being past. */
export function localHistoricalEventOnly(text:string,title:string):boolean {
 if(!title)return false
 const mentions=text.split(/[。；;！？\n]/u).filter(c=>c.includes(title))
 return mentions.length>0&&mentions.every(c=>/(?:曾于|曾在|曾经|往年|历届|此前|去年|历史上)/u.test(c)&&!/(?:本次|此次|将于|即将|欢迎参加|请参加)/u.test(c))
}

/** Source-attributed administrative processing is not the reader's schedule.
 * An explicit invitation to participate wins over the organiser's role. */
export function localOrganizerOnlyEvent(text:string,title:string):boolean {
 if(!/^(?:评审|审核|审查|复核|汇总|报送|公布|公示)/u.test(title))return false
 const mentions=text.split(/[。；;！？\n]/u).filter(clause=>clause.includes(title))
 if(!mentions.length)return false
 return mentions.every(clause=>{
  if(/(?:请|邀请|欢迎|建议)[^。；;\n]{0,30}(?:参加|出席|担任|到场)/u.test(clause))return false
  return /(?:由[^，,。；;\n]{1,20}|主办方|组委会|组织方|工作人员|学院|老师|教师)[^。；;\n]{0,40}(?:举行|举办|召开|进行|开展|负责)/u.test(clause)
 })
}
