// Index existing model citations back to an unambiguous literal source span.
// This is program evidence, not a changed model answer or a new business fact.
export const LITERAL_EVIDENCE_PROJECTION_VERSION='literal-source-citation-projection-1.0.0'
function indexed(text){
  const formatting=new Set()
  for(const m of text.matchAll(/\*\*(?=\S)([\s\S]*?\S)\*\*/gu)){
    for(const i of[m.index,m.index+1,m.index+m[0].length-2,m.index+m[0].length-1])formatting.add(i)
  }
  let value='';const positions=[]
  for(let i=0;i<text.length;i++){
    if(formatting.has(i))continue
    if(/\s/u.test(text[i])){
      let end=i+1;while(end<text.length&&/\s/u.test(text[end]))end++
      // English word boundaries are semantic; never equate "now here" with
      // "nowhere". Chinese layout breaks and date/unit breaks are reversible.
      if(/[A-Za-z]/u.test(text[i-1]??'')&&/[A-Za-z]/u.test(text[end]??'')){value+=' ';positions.push(i)}
      i=end-1;continue
    }
    value+=text[i];positions.push(i)
  }
  return{value,positions}
}
export function projectLiteralSourceEvidence(input,source){
  const result=structuredClone(input),audit={version:LITERAL_EVIDENCE_PROJECTION_VERSION,role:'PROGRAM_LITERAL_SPAN_INDEX_NOT_MODEL_OUTPUT',inferredFacts:0,decisions:[]}
  if(!result||!Array.isArray(result.evidence)||typeof source!=='string')return{result,audit}
  const sourceIndex=indexed(source)
  for(const e of result.evidence){
    const before=e.quotedText||e.quote
    if(typeof before!=='string'||!before||source.includes(before))continue
    if(e.quote&&e.quotedText&&indexed(e.quote).value!==indexed(e.quotedText).value)continue
    const needle=indexed(before).value;if(!needle)continue
    const at=sourceIndex.value.indexOf(needle)
    if(at<0||sourceIndex.value.indexOf(needle,at+1)>=0)continue
    const start=sourceIndex.positions[at],end=sourceIndex.positions[at+needle.length-1]+1,literal=source.slice(start,end)
    if(literal.length>500||indexed(literal).value!==needle)continue
    e.quote=literal;e.quotedText=literal
    audit.decisions.push({evidenceId:e.id,before,after:literal,start,end,rule:'UNIQUE_ORDERED_LITERAL_LAYOUT_EQUIVALENCE'})
  }
  return{result,audit}
}
