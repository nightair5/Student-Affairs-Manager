// A prohibition or cancellation applies to the cited action/subject, not to
// every item whose evidence happens to contain the same sentence.
const compact=value=>typeof value==='string'?value.normalize('NFKC').replace(/\s/gu,''):''
const negativePrefix=/(?:禁止|请勿|不得|不再|不要|不可|不能|不允许|不需要|无需|无须|不必|不用|停止|暂停)(?:继续|再次|再|另行|进行)?$/u
const revision=/改为|改到|改在|改至|改成|调整为|调整至|调整到|调整在|更正为|延期至|顺延至|推迟至|变更为/u
const cancellation=/(?:取消|作废|废止)/gu
const subjectText=value=>compact(value).replace(/["“”‘’《》「」『』—–]/gu,'')

export function itemPolarity(item,context){
 const source=typeof context==='string'?context.normalize('NFKC').replace(/[^\S\r\n]+/gu,'').replace(/["“”‘’《》「」『』—–]/gu,''):''
 const action=subjectText(item.action),object=subjectText(item.object),title=subjectText(item.title)
 // Parenthetical display labels like "original arrangement" distinguish two
 // records, but are not part of the event name in the notice itself.
 const titleSubject=title
  .replace(/\((?:原定|原安排|原场次|旧安排|旧场次|新安排|新场次|改期|改至|改到|改在|延期|已取消|取消)[^()]*\)$/u,'')
  .replace(/\((?:原|旧)(?:\d{4}年)?\d{1,2}月\d{1,2}日[^()]*\)$/u,'')
  .replace(/^(?:原定|原先|原本)(?:(?:\d{4}年)?\d{1,2}月\d{1,2}[日号]?(?:\d{1,2}:\d{2})?)?/u,'')
 const undatedTitle=titleSubject.replace(/^(?:(?:本|这|下|上)周|周[一二三四五六日天]|星期[一二三四五六日天]|今天|明天|后天)(?:的)?/u,'')
 const subjects=[...new Set([title,titleSubject,undatedTitle,object,action&&object?action+object:''].filter(value=>value.length>=2))]
 // An amended time belongs to the replacement, even when the citation also
 // includes the old cancelled sentence. Do not revive the old timed item.
 const revised=source.search(revision)
 const newTime=revised>=0&&Array.isArray(item.times)&&item.times.some(time=>{
  const raw=subjectText(time?.raw)
  return raw.length>=2&&source.slice(revised).includes(raw)
 })
 const clauses=[...source.matchAll(/[^，,。；;！？!?\n]+/gu)]
 // A source-backed old occurrence can be superseded without the word 取消.
 // Its times must belong exclusively before this item's explicit revision.
 const oldTimes=Array.isArray(item.times)?item.times.map(time=>subjectText(time?.raw)).filter(value=>value.length>=2):[]
 if(item.kind==='event'&&item.status==='cancelled'&&revised>=0&&!newTime&&oldTimes.length
   &&/原定|原先|原本/u.test(source.slice(0,revised))
   &&subjects.some(subject=>source.slice(0,revised).includes(subject))
   &&oldTimes.every(value=>source.slice(0,revised).includes(value)))return 'cancelled'
 const obsolete=position=>newTime&&position<revised
 const ownForm=compact(item.deliveryForm).match(/纸质|电子/u)?.[0]??''
 const citedObject=object&&ownForm&&Array.isArray(item.evidence)&&item.evidence.some(value=>compact(value).includes(object)&&compact(value).includes(ownForm))
 for(const segment of clauses){
  const clause=segment[0],offset=segment.index
  const clauseForms=[...clause.matchAll(/电子|纸质/gu)].map(match=>match[0])
  if(ownForm&&clauseForms.length&&!clauseForms.includes(ownForm))continue
  // A cancellation may name the delivery form and action while the object
  // appears in a separate citation owned by this same item.
  const cancelledDelivery=clause.match(/(?:取消|停止|不再|无需|不得|禁止)[^，,。；;]{0,12}(?:提交|上交|上传|递交)/u)
  if(item.status==='cancelled'&&citedObject&&clauseForms.includes(ownForm)&&cancelledDelivery&&!obsolete(offset+cancelledDelivery.index))return 'cancelled'
  if(action&&object&&clause.includes(object)){
   for(let at=clause.indexOf(action);at>=0;at=clause.indexOf(action,at+action.length)){
    const before=clause.slice(Math.max(0,at-12),at)
    if(negativePrefix.test(before)){
     // A negated audience clause such as “未入选者无需提交” describes the
     // opposite subgroup, not the item explicitly owned by “入选者”.
     const condition=compact(item.condition).replace(/^(?:仅限|仅|只有|面向)/u,'')
     const scope=clause.slice(0,at)
     const opposite=condition.length>=2&&!/^(?:未|不|非|无)/u.test(condition)&&['未','不','非','无'].some(prefix=>scope.includes(prefix+condition))
     // In an explicit choice, “online signing needs no paper collection”
     // removes the obligation only for the OTHER selected branch.
     const choice=/二选一|任选其一|任选一种|任选一项/u.test(source)
     const branchSubject=scope.replace(negativePrefix,'').replace(/^[^：:]{1,12}[：:]/u,'')
     const positiveParts=source.split(/[，,。；;\n]/u)
     const otherBranch=choice&&branchSubject.length>=2
       &&positiveParts.some(part=>part.includes(branchSubject)&&/(?:可|可以)(?:选择|采用|通过|使用)/u.test(part)&&!part.includes(object))
       &&positiveParts.some(part=>part.includes(action)&&part.includes(object)
         &&!negativePrefix.test(part.slice(0,part.indexOf(action))))
       &&!subjects.some(subject=>branchSubject.includes(subject))
     if(!opposite&&!otherBranch&&!obsolete(offset+at))return 'cancelled'
    }
   }
  }
  for(const match of clause.matchAll(cancellation)){
   const at=match.index,after=clause.slice(at+match[0].length)
   if(obsolete(offset+at))continue
   // A qualification or an unrelated historical outcome is not the event.
   if(/^(?:其|相关|本次)?(?:申请|参评|报名|获奖|评选)?资格/u.test(after))continue
   if(item.kind==='event'&&item.status==='cancelled'){
    const deictic=clause.slice(0,at).match(/(?:现|现将|该|本次)(讲座|报告会|活动|会议|培训|比赛)(?:因[^，,。；;]{0,18})?$/u)
    const preceding=source.slice(0,offset)
    if(deictic&&subjects.some(subject=>subject.includes(deictic[1])&&preceding.includes(subject)))return 'cancelled'
    // A cancellation may refer back to the named occurrence as "tonight's
    // lecture" rather than repeat its display title. Bind only a cancelled
    // model record with its own earlier title AND time, never a later/new
    // occurrence or a qualification cancellation.
    const previousOccurrence=/^(?:本次|该场|此次|今晚|今夜|今天|当日|当天)(?:的)?(?:讲座|报告会|活动|会议|培训|工作坊|研讨会)/u.test(after)
    if(previousOccurrence&&!newTime&&oldTimes.length&&subjects.some(subject=>preceding.includes(subject))&&oldTimes.every(value=>preceding.includes(value)))return 'cancelled'
   }
   for(const subject of subjects){
    let start=clause.indexOf(subject)
    while(start>=0){
     const end=start+subject.length
     const before=at>=end?clause.slice(end,at):'',between=at<start?clause.slice(at+match[0].length,start):''
     const statedEvent=item.kind==='event'&&at>=end&&before.length<=80&&/(?:举办|举行|召开|开始|进行)(?:已|已经|暂时|现|被)?$/u.test(before)
     if((at>=end&&before.length<=8&&!revision.test(before))||statedEvent||(at<start&&between.length<=8&&!revision.test(between)))return 'cancelled'
     start=clause.indexOf(subject,start+subject.length)
    }
   }
  }
 }
 return item.status==='cancelled'?'uncertain':'active'
}
