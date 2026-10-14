export const SELECTOR_V8='recognition-selector-8.0.0'
/** Compare matched obligations, never the list of expected IDs generated for unmatched slots. */
export function comparePairV8(a,b){
  if(!a||!b||a.completeStatus==='UNKNOWN'||b.completeStatus==='UNKNOWN')return {status:'UNKNOWN',reason:'REFERENCE_OR_MEASUREMENT_UNRESOLVED'}
  const matchedA=new Set(a.matchedObligations),matchedB=new Set(b.matchedObligations)
  const lost=[...matchedA].filter(id=>!matchedB.has(id))
  const newRisks=b.risks.filter(risk=>!a.risks.some(old=>JSON.stringify(old)===JSON.stringify(risk)))
  return {status:newRisks.length||lost.length?'RISK_REGRESSION':b.completeStatus&&!a.completeStatus?'IMPROVED':a.completeStatus&&!b.completeStatus?'REGRESSED':'TIE',lostObligations:lost,newRisks}
}
