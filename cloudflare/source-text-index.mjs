import {resolveLiteralSourceSpan,resolveLiteralSourceSpans} from './recognition-literal-evidence.mjs'

/** Parser layout and its reversible UTF-16 source coordinates. */
export function normalizeSourceWithOffsets(source){
 let text='';const starts=[],ends=[]
 for(let i=0;i<source.length;){
  const start=i;let value=source[i++]
  if(value==='\r'){if(source[i]==='\n')i++;value='\n'}
  else if(/[\t\u00a0 ]/u.test(value)){
   while(i<source.length&&/[\t\u00a0 ]/u.test(source[i]))i++
   value=' '
  }
  text+=value;for(let j=0;j<value.length;j++){starts.push(start);ends.push(i)}
 }
 const leading=text.length-text.trimStart().length,trailing=text.trimEnd().length
 return {text:text.slice(leading,trailing),starts:starts.slice(leading,trailing),ends:ends.slice(leading,trailing)}
}

/** A hint may disambiguate repeated text only inside an already owned scope. */
export function locateSourceQuote(quote,source,{start,end,within}={}){
 if(typeof quote!=='string'||!quote.trim()||typeof source!=='string')return null
 const left=within?.start??0,right=within?.end??source.length
 if(!Number.isInteger(left)||!Number.isInteger(right)||left<0||right>source.length||right<=left)return null
 if(Number.isInteger(start)&&start>=left&&start+quote.length<=right&&source.slice(start,start+quote.length)===quote)
  return {literal:quote,start,end:start+quote.length,rule:'SOURCE_OFFSET'}
 const region=source.slice(left,right),at=region.indexOf(quote)
 if(at>=0&&region.indexOf(quote,at+1)<0)return {literal:quote,start:left+at,end:left+at+quote.length,rule:'EXACT_UNIQUE_SOURCE_SPAN'}
 const needle=normalizeSourceWithOffsets(quote).text,index=normalizeSourceWithOffsets(region)
 const offset=index.text.indexOf(needle)
 if(needle&&offset>=0&&index.text.indexOf(needle,offset+1)<0){
  const from=left+index.starts[offset],to=left+index.ends[offset+needle.length-1]
  return {literal:source.slice(from,to),start:from,end:to,rule:'REVERSIBLE_LAYOUT_SOURCE_SPAN'}
 }
 const span=resolveLiteralSourceSpan(quote,region)
 if(span)return {...span,start:left+span.start,end:left+span.end,rule:'REVERSIBLE_TYPOGRAPHY_SOURCE_SPAN'}
 // Do not resolve an ambiguous repeated quote from a guessed nearest match.
 void end
 return null
}

/** Resolve a repeated field within a uniquely cited parent. Never guess the
 * first occurrence; duplicate copies outside the owner remain unrelated. */
export function locateOwnedSourceQuote(quote,source,ownerQuotes=[]){
 const unique=locateSourceQuote(quote,source)
 if(unique)return unique
 const scopes=ownerQuotes.flatMap(value=>{const span=locateSourceQuote(value,source);return span?[span]:[]})
 const matches=resolveLiteralSourceSpans(quote,source).filter(span=>scopes.some(scope=>scope.start<=span.start&&scope.end>=span.end))
 return matches.length===1?{...matches[0],rule:'UNIQUE_WITHIN_OWNED_CITATION'}:null
}

/** Rewrite citations, never business facts, to the authoritative source text. */
export function alignRecognitionEvidence(input,source){
 const result=structuredClone(input),decisions=[]
 for(const e of result.evidence??[]){
  const quote=e.quotedText||e.quote,span=locateSourceQuote(quote,source,{start:e.textStart,end:e.textEnd})
  if(!span)continue
  if(quote!==span.literal||e.textStart!==span.start||e.textEnd!==span.end)decisions.push({id:e.id,rule:span.rule,start:span.start,end:span.end})
  e.quote=span.literal;e.quotedText=span.literal;e.textStart=span.start;e.textEnd=span.end
 }
 return {result,decisions}
}
