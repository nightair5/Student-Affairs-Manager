// Index existing model citations back to an unambiguous literal source span.
// This is program evidence, not a changed model answer or a new business fact.
export const LITERAL_EVIDENCE_PROJECTION_VERSION='literal-source-citation-projection-1.2.0'
function citationLayout(text,source){
  // A doubly escaped layout break is a wire representation issue only when
  // the source does not itself contain literal backslash layout syntax. Do
  // not JSON-parse citations or decode numbers, punctuation or Unicode escapes.
  return /\\[nrt]/u.test(source)?text:text.replace(/\\r\\n|\\n|\\r|\\t/gu,token=>token==='\\t'?'\t':'\n')
}
function indexed(text){
  const formatting=new Set()
  for(const m of text.matchAll(/\*\*(?=\S)([\s\S]*?\S)\*\*/gu)){
    for(const i of[m.index,m.index+1,m.index+m[0].length-2,m.index+m[0].length-1])formatting.add(i)
  }
  const units=[]
  for(let i=0;i<text.length;i++){
    if(formatting.has(i))continue
    let char=text[i],end=i+1
    if(char==='&'){
      const entity=/^&(?:amp|lt|gt|quot|apos|nbsp|#\d{1,7}|#x[0-9a-fA-F]{1,6});/u.exec(text.slice(i))?.[0]
      if(entity){
        const named={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '}
        const code=entity.startsWith('&#')?Number.parseInt(entity.slice(entity[2]==='x'?3:2,-1),entity[2]==='x'?16:10):null
        if(Object.hasOwn(named,entity)){char=named[entity];end=i+entity.length}
        else if(code!==null&&code>0&&code<=0x10ffff&&!(code>=0xd800&&code<=0xdfff)){char=String.fromCodePoint(code);end=i+entity.length}
      }
    }
    // Width and punctuation are reversible typography only. No case folding,
    // word replacement, punctuation deletion or arbitrary Unicode NFKC.
    char=[...char].map(c=>{const n=c.codePointAt(0);return n>=0xff01&&n<=0xff5e?String.fromCodePoint(n-0xfee0):({'。':'.','“':'"','”':'"','‘':"'",'’':"'"}[c]??c)}).join('')
    units.push({char,start:i,end});i=end-1
  }
  let value='';const positions=[],ends=[]
  for(let i=0;i<units.length;i++){
    const u=units[i]
    if(/\s/u.test(u.char)){
      let end=i+1;while(end<units.length&&/\s/u.test(units[end].char))end++
      // English word boundaries are semantic; never equate "now here" with
      // "nowhere". Chinese layout breaks and date/unit breaks are reversible.
      if(/[A-Za-z]/u.test(units[i-1]?.char??'')&&/[A-Za-z]/u.test(units[end]?.char??'')){value+=' ';positions.push(u.start);ends.push(units[end-1].end)}
      i=end-1;continue
    }
    value+=u.char;for(let j=0;j<u.char.length;j++){positions.push(u.start);ends.push(u.end)}
  }
  return{value,positions,ends}
}
// Reuse the same typography rules for a field inside its own cited span.
// The caller receives original source bytes, never a rewritten quotation.
export function resolveLiteralSourceSpan(text,source){
  if(typeof text!=='string'||!text||typeof source!=='string')return null
  const needle=indexed(text).value,index=indexed(source);if(!needle)return null
  const at=index.value.indexOf(needle);if(at<0||index.value.indexOf(needle,at+1)>=0)return null
  const start=index.positions[at],end=index.ends[at+needle.length-1],literal=source.slice(start,end)
  return literal.length<=500&&indexed(literal).value===needle?{literal,start,end}:null
}
export function projectLiteralSourceEvidence(input,source){
  const result=structuredClone(input),audit={version:LITERAL_EVIDENCE_PROJECTION_VERSION,role:'PROGRAM_LITERAL_SPAN_INDEX_NOT_MODEL_OUTPUT',inferredFacts:0,decisions:[]}
  if(!result||!Array.isArray(result.evidence)||typeof source!=='string')return{result,audit}
  const sourceIndex=indexed(source)
  for(const e of result.evidence){
    const before=e.quotedText||e.quote
    if(typeof before!=='string'||!before||source.includes(before))continue
    if(e.quote&&e.quotedText&&indexed(citationLayout(e.quote,source)).value!==indexed(citationLayout(e.quotedText,source)).value)continue
    const layout=citationLayout(before,source),needle=indexed(layout).value;if(!needle)continue
    const at=sourceIndex.value.indexOf(needle)
    if(at<0||sourceIndex.value.indexOf(needle,at+1)>=0)continue
    const start=sourceIndex.positions[at],end=sourceIndex.ends[at+needle.length-1],literal=source.slice(start,end)
    if(literal.length>500||indexed(literal).value!==needle)continue
    e.quote=literal;e.quotedText=literal
    audit.decisions.push({evidenceId:e.id,before,after:literal,start,end,rule:layout===before?'UNIQUE_ORDERED_LITERAL_LAYOUT_EQUIVALENCE':'UNIQUE_ORDERED_LITERAL_LAYOUT_ESCAPE_EQUIVALENCE'})
  }
  return{result,audit}
}
