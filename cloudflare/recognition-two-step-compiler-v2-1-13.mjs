import {compileTwoStep as compilePrevious} from './recognition-two-step-compiler-v2-1-12.mjs'
import {contextualizeItems,promoteReferentialActions} from './two-step-contextual-items.mjs'
import {alignSourceQuote} from './two-step-source-alignment.mjs'

// Only revisit facts that the previous compiler already aligned and assigned to
// the event, but could not fit into its old 800-character description. Keep
// every accepted fragment and its actual source offset in the canonical event.
function restoreLongEventDetails(raw,options,compiled){
 const accepted=[]
 for(const loss of compiled.audit?.losses??[]){
  if(loss.reason!=='EVENT_DETAIL_EXCEEDS_DESCRIPTION_LIMIT')continue
  const index=Number(loss.id),fact=raw.facts[index]
  if(!Number.isInteger(index)||!fact||typeof fact.quote!=='string')continue
  const ownerIndex=raw.items.findIndex(item=>item.id===fact.item&&item.kind==='活动')
  const event=compiled.result.events.find(item=>item.tempId==='g2-'+(ownerIndex+1))
  const hint=options.alignmentHints?.facts?.find(item=>item.index===index)?.span
  const validHint=hint&&Number.isInteger(hint.start)&&Number.isInteger(hint.end)&&hint.start>=0&&hint.end>hint.start&&options.source.slice(hint.start,hint.end)===hint.literal&&(()=>{const a=alignSourceQuote(fact.quote,hint.literal);return a&&a.start===0&&a.end===hint.literal.length})()
  const span=validHint?hint:alignSourceQuote(fact.quote,options.source)
  if(!event||!span||span.literal.length>500||event.evidenceIds.length>=20||compiled.result.evidence.length>=120)continue
  const value=span.literal.replace(new RegExp('^'+fact.type+'[：:]\\s*','u'),'').trim()
  const line=fact.type+'：'+value,evidenceId='g2-detail-e'+(index+1)
  if(!value||event.description.split('\n').includes(line)||event.description.length+1+line.length>2400||compiled.result.evidence.some(item=>item.id===evidenceId))continue
  event.description+='\n'+line
  event.evidenceIds.push(evidenceId)
  compiled.result.evidence.push({id:evidenceId,sourceId:'pending-source',quote:span.literal,quotedText:span.literal,textStart:span.start,textEnd:span.end,field:'description',extractionMethod:'parser',confidence:1})
  accepted.push({index,item:fact.item,start:span.start,end:span.end})
 }
 return accepted
}

// Resolve bounded literal source context before the existing compiler assigns
// ownership. This preserves the original model raw and the 2.1.12 compiler.
export function compileTwoStep(raw,options){
 if(!raw||!Array.isArray(raw.items)||!Array.isArray(raw.facts))return compilePrevious(raw,options)
 const promoted=promoteReferentialActions(raw,options.source),prepared=contextualizeItems(promoted.raw,options.source)
 const consumed=new Set(promoted.consumed),newIndexes=new Map()
 for(let index=0,next=0;index<raw.facts.length;index++)if(!consumed.has(index))newIndexes.set(index,next++)
 const alignmentHints=options.alignmentHints?{...options.alignmentHints,facts:(options.alignmentHints.facts??[]).filter(h=>newIndexes.has(h.index)).map(h=>({...h,index:newIndexes.get(h.index)}))}:null
 const adjusted={...options,alignmentHints}
 const compiled=compilePrevious(prepared.raw,adjusted)
 if(compiled.audit){
  compiled.audit.compilerVersion='two-step-compiler-2.1.13'
  compiled.audit.contextualItems=[...promoted.edits,...prepared.edits]
  compiled.audit.restoredLongEventDetails=restoreLongEventDetails(prepared.raw,adjusted,compiled)
 }
 return compiled
}
