export const PUBLIC_SCORER='public-source-fact-adjudication-1.0.0'
/** Reuse structured decode/first display. Source-based provisional adjudication
 * is explicit per fact and per layer; there is no automatic generous score or
 * invented independent human truth. Missing decisions remain in the denominator. */
export function scorePublicNotice(reference,adjudication){
  const stages={}
  for(const stage of ['modelFirstFacts','displayBeforeHuman','humanFinal']){
    const rows=adjudication?.[stage]??[],required=reference.assertions.map(a=>a.id)
    const evidenceValid=row=>['CORRECT','INCORRECT','UNKNOWN'].includes(row.verdict)&&typeof row.reason==='string'&&row.reason.trim().length>0&&typeof row.outputPointer==='string'&&row.outputPointer.trim().length>0
    const matched=required.map(id=>{const candidates=rows.filter(r=>r.factId===id);return candidates.length===1&&evidenceValid(candidates[0])?candidates[0]:{factId:id,verdict:'UNKNOWN',reason:'MISSING_OR_INVALID_ADJUDICATION'}})
    const wrong=matched.filter(r=>r.verdict==='INCORRECT'),unknown=matched.filter(r=>r.verdict==='UNKNOWN')
    const extra=rows.filter(r=>!required.includes(r.factId))
    // The frozen final assertion covers titles, descriptions, extras and graph.
    // A false fact cannot be outweighed by a large number of correct fields.
    const complete=wrong.length?false:unknown.length||extra.length?'UNKNOWN':true
    stages[stage]={complete,correct:matched.filter(r=>r.verdict==='CORRECT').length,incorrect:wrong.length,unknown:unknown.length,checks:matched,unregistered:extra}
  }
  return {version:PUBLIC_SCORER,truth:'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL',stages,comparison:'SINGLE_ARM_CURRENT_BASELINE_NOT_RELATIVE_IMPROVEMENT'}
}
export function reportPublicNotices(references,adjudications){
  const cases=references.map(r=>{const records=adjudications.filter(a=>a.sourceId===r.sourceId);return {sourceId:r.sourceId,adjudicationRecords:records.length,...scorePublicNotice(r,records.length===1?records[0]:undefined)}})
  return {version:PUBLIC_SCORER,denominator:references.length,cases,summary:Object.fromEntries(['modelFirstFacts','displayBeforeHuman','humanFinal'].map(stage=>[stage,{correct:cases.filter(c=>c.stages[stage].complete===true).length,incorrect:cases.filter(c=>c.stages[stage].complete===false).length,unknown:cases.filter(c=>c.stages[stage].complete==='UNKNOWN').length,denominator:references.length}]))}
}
