import { build } from 'esbuild'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { readCandidate19Package, createCandidate19Host } from './candidate19-execution-host.mjs'
const root='docs/recognition-optimization/candidate19-development',out=resolve('.data/candidate19/fact-diagnostic-v1')
mkdirSync(out,{recursive:true})
await build({stdin:{contents:`export {decodeCurrentSourceRecording,projectConditionalNonAction} from './src/recognition/conditionalNonActionProduct'; export {decodeProductSourceRecording} from './src/recognition/sourceAccountingSupportProduct'; export {projectDirectiveDisposition} from './src/recognition/directiveDispositionProduct'; export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11'; export {assembleSemanticFirstSuggestionD26} from './src/recognition/firstSuggestionD26'; export {diagnoseRecordedFacts,RECORDED_FACT_REFERENCES,RECORDED_FACT_DIAGNOSTIC_VERSION} from './src/recognition/recordedFactDiagnostic'`,resolveDir:process.cwd()},outfile:join(out,'components.mjs'),bundle:true,platform:'node',format:'esm'})
const x=await import(pathToFileURL(join(out,'components.mjs'))),pack=readCandidate19Package(),scene=await createCandidate19Host().resumeReadOnly()
if(scene.audit!=='CONSISTENT'||scene.halt||scene.lockExists||scene.state.units.some(u=>u.status!=='SETTLED'))throw Error('DIAGNOSTIC_REQUIRES_COMPLETE_DEFINITE_RECORDINGS')
const sources=JSON.parse(readFileSync(root+'/SOURCES.json')).sources,frozen=JSON.parse(readFileSync(root+'/paid-evidence/completed/FROZEN_COMPARISON_REPORT.json')),cases=[]
for(const u of pack.units){
  const file=root+'/paid-evidence/'+(u.ordinal<3?'':'completed/')+'raw-'+String(u.ordinal).padStart(2,'0')+'.json'
  const raw=JSON.parse(readFileSync(file)),source=sources.find(s=>s.sourceId===u.sourceId),ref=x.RECORDED_FACT_REFERENCES.find(s=>s.sourceId===u.sourceId)
  if(createHash('sha256').update(raw.rawHttpText).digest('hex')!==raw.responseSha256||raw.requestSha256!==u.requestSha256)throw Error('RAW_IDENTITY_DRIFT')
  const context={index:await x.indexImmutableScopesV11(source.sourceId,source.sourceVersionId,source.sourceText),referenceTime:source.referenceTime,timezone:source.timezone}
  const base={ordinal:u.ordinal,sourceId:u.sourceId,candidate:u.candidate,sourceText:source.sourceText,sourceSha256:source.sourceSha256,responseSha256:raw.responseSha256,originalFrozen:frozen.cases.find(c=>c.ordinal===u.ordinal)}
  try{
    const old=x.decodeProductSourceRecording(raw.rawHttpText,u.candidate,context),p=x.decodeCurrentSourceRecording(raw.rawHttpText,u.candidate,context)
    const previous=x.assembleSemanticFirstSuggestionD26(x.projectDirectiveDisposition(old.originalAdapted,context).result,context).result
    const current=x.assembleSemanticFirstSuggestionD26(x.projectConditionalNonAction(p.originalAdapted,context).result,context).result
    cases.push({...base,originalWire:JSON.parse(JSON.parse(raw.rawHttpText).output[0].content[0].text),previousProgramDiagnostic:x.diagnoseRecordedFacts(ref,previous,context),currentProgramDiagnostic:x.diagnoseRecordedFacts(ref,current,context),conversionAudit:p.productDisposition,supportAudit:p.supportAccountingAudit,firstDisplay:p.result,humanCorrections:[]})
  }catch(e){cases.push({...base,currentProgramDiagnostic:{completeStatus:'FACT_ERROR',risks:[{kind:'CONTRACT_OR_GRAPH_REJECTION',detail:e.message}],disputes:[]},error:e.message})}
}
const summary=Object.fromEntries(['Candidate17','Candidate19'].map(candidate=>{const arm=cases.filter(c=>c.candidate===candidate);return [candidate,{denominator:6,provisionalStructuredPass:arm.filter(c=>c.currentProgramDiagnostic.completeStatus==='PROVISIONAL_STRUCTURED_PASS').length,factError:arm.filter(c=>c.currentProgramDiagnostic.completeStatus==='FACT_ERROR').length,unknown:arm.filter(c=>c.currentProgramDiagnostic.completeStatus==='UNKNOWN').length,independentWholeUserCorrect:'NOT_OBSERVABLE'}]}))
const report={version:x.RECORDED_FACT_DIAGNOSTIC_VERSION,role:'POST_HOC_ALL_12_RECORDINGS_NOT_NEW_MODEL_COMPARISON',plannedDenominator:12,modelGrantReserveSettle:0,ledgerBefore:scene.ledger,referenceTruth:'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL',originalFrozenSummary:frozen.summary,originalSelection:frozen.selection,summary,cases}
writeFileSync(join(out,'REPORT.json'),JSON.stringify(report,null,2)+'\n')
writeFileSync(join(out,'REFERENCES.json'),JSON.stringify({version:x.RECORDED_FACT_DIAGNOSTIC_VERSION,author:'single-author/model-assisted/provisional',timing:'POST_HOC_NOT_PREREGISTERED',references:x.RECORDED_FACT_REFERENCES},null,2)+'\n')
console.log(JSON.stringify({file:join(out,'REPORT.json'),summary,cases:cases.map(c=>({ordinal:c.ordinal,status:c.currentProgramDiagnostic.completeStatus,risks:c.currentProgramDiagnostic.risks,disputes:c.currentProgramDiagnostic.disputes,conversion:c.conversionAudit?.decisions.map(d=>({id:d.entityId,operation:d.operation}))}))},null,2))
