// A prohibition or cancellation applies to the cited action/subject, not to
// every item whose evidence happens to contain the same sentence.
const compact=value=>typeof value==='string'?value.normalize('NFKC').replace(/\s/gu,''):''
const negativePrefix=/(?:禁止|请勿|不得|不再|不要|不可|不能|不允许|不需要|无需|无须|不必|不用|停止|暂停)(?:继续|再次|再|另行|进行)?$/u
const revision=/改为|改到|调整为|更正为|延期至|改至|变更为/u
const cancellation=/(?:取消|作废|废止)/gu

export function itemPolarity(item,context){
 const source=typeof context==='string'?context.normalize('NFKC').replace(/[^\S\r\n]+/gu,''):''
 const action=compact(item.action),object=compact(item.object),title=compact(item.title)
 // Parenthetical display labels like "original arrangement" distinguish two
 // records, but are not part of the event name in the notice itself.
 const titleSubject=title.replace(/\((?:原定|原安排|原场次|旧安排|旧场次|新安排|新场次|改期|延期)[^()]*\)$/u,'')
 const subjects=[...new Set([title,titleSubject,object,action&&object?action+object:''].filter(value=>value.length>=2))]
 // An amended time belongs to the replacement, even when the citation also
 // includes the old cancelled sentence. Do not revive the old timed item.
 const revised=source.search(revision)
 const newTime=revised>=0&&Array.isArray(item.times)&&item.times.some(time=>{
  const raw=compact(time?.raw)
  return raw.length>=2&&source.slice(revised).includes(raw)
 })
 const clauses=source.split(/[，,。；;！？!?\n]/u).filter(Boolean)
 const ownForm=compact(item.deliveryForm).match(/纸质|电子/u)?.[0]??''
 const citedObject=object&&ownForm&&Array.isArray(item.evidence)&&item.evidence.some(value=>compact(value).includes(object)&&compact(value).includes(ownForm))
 for(const clause of clauses){
  const clauseForms=[...clause.matchAll(/电子|纸质/gu)].map(match=>match[0])
  if(ownForm&&clauseForms.length&&!clauseForms.includes(ownForm))continue
  // A cancellation may name the delivery form and action while the object
  // appears in a separate citation owned by this same item.
  if(item.status==='cancelled'&&citedObject&&clauseForms.includes(ownForm)&&/(?:取消|停止|不再|无需|不得|禁止)[^，,。；;]{0,12}(?:提交|上交|上传|递交)/u.test(clause))return 'cancelled'
  if(action&&object&&clause.includes(object)){
   for(let at=clause.indexOf(action);at>=0;at=clause.indexOf(action,at+action.length)){
    const before=clause.slice(Math.max(0,at-12),at)
    if(negativePrefix.test(before))return newTime?'active':'cancelled'
   }
  }
  for(const match of clause.matchAll(cancellation)){
   const at=match.index,after=clause.slice(at+match[0].length)
   // A qualification or an unrelated historical outcome is not the event.
   if(/^(?:其|相关|本次)?(?:申请|参评|报名|获奖|评选)?资格/u.test(after))continue
   for(const subject of subjects){
    let start=clause.indexOf(subject)
    while(start>=0){
     const end=start+subject.length
     const before=at>=end?clause.slice(end,at):'',between=at<start?clause.slice(at+match[0].length,start):''
     const statedEvent=item.kind==='event'&&at>=end&&before.length<=80&&/(?:举办|举行|召开|开始|进行)(?:已|已经|暂时|现|被)?$/u.test(before)
     if((at>=end&&before.length<=8&&!revision.test(before))||statedEvent||(at<start&&between.length<=8&&!revision.test(between)))return newTime?'active':'cancelled'
     start=clause.indexOf(subject,start+subject.length)
    }
   }
  }
 }
 return item.status==='cancelled'?'uncertain':'active'
}
