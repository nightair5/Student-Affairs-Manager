import {resolveLiteralSourceSpan} from './recognition-literal-evidence.mjs'
// Inspired by LangExtract resolver.py (Apache-2.0): coverage + density gates.
// This implementation is independent; stricter gates protect dates and polarity.
export const ALIGNMENT_POLICY={coverage:.9,density:.8,minCharacters:12,uniqueMargin:.08}
const clean=s=>String(s).normalize('NFKC').replace(/\s|[，,。；;：:！？!?“”‘’《》「」（）()、]/gu,'')
const critical=s=>JSON.stringify({numbers:[...String(s).normalize('NFKC').matchAll(/[0-9]+(?:[.:][0-9]+)*/gu)].map(m=>m[0]),negatives:[...String(s).matchAll(/不再|不得|禁止|取消|作废|无需|无须|不必|请勿|未|不/gu)].map(m=>m[0])})
function lcsSpan(query,text){
 const a=[...query],b=[...text],rows=Array.from({length:a.length+1},()=>new Uint16Array(b.length+1))
 for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)rows[i][j]=a[i-1]===b[j-1]?rows[i-1][j-1]+1:Math.max(rows[i-1][j],rows[i][j-1])
 let i=a.length,j=b.length,first=b.length,last=-1
 while(i&&j){if(a[i-1]===b[j-1]){first=j-1;if(last<0)last=j-1;i--;j--}else if(rows[i-1][j]>=rows[i][j-1])i--;else j--}
 return {matches:rows[a.length][b.length],first,last}
}
export function alignSourceQuote(quote,source){
 if(typeof quote!=='string'||!quote.trim()||quote.length>500)return null
 let at=source.indexOf(quote)
 if(at>=0)return source.indexOf(quote,at+1)<0?{literal:quote,start:at,end:at+quote.length,rule:'EXACT_UNIQUE_SOURCE_SPAN'}:null
 const span=resolveLiteralSourceSpan(quote,source)
 if(span)return {...span,rule:'UNIQUE_REVERSIBLE_TYPOGRAPHY_SPAN'}
 const q=clean(quote);if(q.length<ALIGNMENT_POLICY.minCharacters)return null
 const candidates=[]
 for(const match of source.matchAll(/[^。；;！？!?]+[。；;！？!?]?/gu)){
  if(match[0].length>650)continue
  const positions=[],chars=[]
  for(let k=0;k<match[0].length;k++){const c=clean(match[0][k]);for(const char of c){chars.push(char);positions.push(k)}}
  const found=lcsSpan(q,chars.join(''));if(found.last<0)continue
  const coverage=found.matches/q.length,density=found.matches/(found.last-found.first+1)
  if(coverage<ALIGNMENT_POLICY.coverage||density<ALIGNMENT_POLICY.density)continue
  const start=match.index+positions[found.first],end=match.index+positions[found.last]+1,literal=source.slice(start,end)
  if(literal.length>500||critical(quote)!==critical(literal))continue
  const compact=clean(literal),whole=clean(source),first=whole.indexOf(compact);if(first>=0&&whole.indexOf(compact,first+1)>=0)continue
  let competing=false;for(const region of [chars.slice(0,found.first).join(''),chars.slice(found.last+1).join('')]){const second=lcsSpan(q,region);if(second.last>=0&&second.matches/q.length>=ALIGNMENT_POLICY.coverage&&second.matches/(second.last-second.first+1)>=ALIGNMENT_POLICY.density)competing=true}if(competing)continue
  candidates.push({literal,start,end,rule:'UNIQUE_HIGH_COVERAGE_SOURCE_LCS_SPAN',coverage,density,score:coverage*density})
 }
 candidates.sort((a,b)=>b.score-a.score)
 if(!candidates.length||candidates[1]&&candidates[0].score-candidates[1].score<ALIGNMENT_POLICY.uniqueMargin)return null
 return candidates[0]
}
export function sourceScopes(span,source){
 const before=source.slice(0,span.start),tail=source.slice(span.end)
 const left=Math.max(...['。','；',';','！','？','!','?'].map(x=>before.lastIndexOf(x)))+1
 const stop=tail.search(/[。；;！？!?]/u),end=stop<0?source.length:span.end+stop+1
 const paragraphStart=before.includes('\n\n')?before.lastIndexOf('\n\n')+2:0,paragraphEndAt=source.indexOf('\n\n',span.end)
 const headings=[...source.matchAll(/^(?:[一二三四五六七八九十]+[、．.]|[（(][一二三四五六七八九十0-9]+[）)]|[0-9]+[、．.])[^\n]*$/gmu)]
 const previous=headings.filter(h=>h.index<=span.start).at(-1),next=headings.find(h=>h.index>span.start)
 return [{level:'SENTENCE',start:left,end,text:source.slice(left,end)},{level:'PARAGRAPH',start:Math.max(paragraphStart,previous?.index??0),end:Math.min(paragraphEndAt<0?source.length:paragraphEndAt,next?.index??source.length),text:source.slice(Math.max(paragraphStart,previous?.index??0),Math.min(paragraphEndAt<0?source.length:paragraphEndAt,next?.index??source.length))},{level:'NUMBERED_SECTION',start:previous?.index??0,end:next?.index??source.length,text:source.slice(previous?.index??0,next?.index??source.length)}]
}
