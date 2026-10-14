import {build} from 'esbuild'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {candidate19RecordedScene} from './candidate19-recorded-readonly.mjs'
const root='docs/recognition-optimization/candidate19-development',out=resolve('.data/candidate19/channel-followup-v1')
mkdirSync(out,{recursive:true})
await build({stdin:{contents:`export {decodeCurrentSourceRecording,projectConditionalNonAction} from './src/recognition/conditionalNonActionProduct';export {assembleCurrentFirstSuggestion} from './src/recognition/materialChannelGrounding';export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11';export {assembleSemanticFirstSuggestionD26} from './src/recognition/firstSuggestionD26';export {diagnoseRecordedFacts,RECORDED_FACT_REFERENCES} from './src/recognition/recordedFactDiagnostic'`,resolveDir:process.cwd()},outfile:join(out,'components.mjs'),bundle:true,platform:'node',format:'esm'})
const x=await import(pathToFileURL(join(out,'components.mjs'))),{pack,scene:before}=await candidate19RecordedScene()
if(before.audit!=='CONSISTENT'||before.halt||before.lockExists||before.state.units.some(u=>u.status!=='SETTLED'))throw Error('COMPLETE_DEFINITE_RECORDINGS_REQUIRED')
const sources=JSON.parse(readFileSync(root+'/SOURCES.json')).sources,cases=[]
for(const u of pack.units){
  const raw=JSON.parse(readFileSync(root+'/paid-evidence/'+(u.ordinal<3?'':'completed/')+'raw-'+String(u.ordinal).padStart(2,'0')+'.json'))
  if(createHash('sha256').update(raw.rawHttpText).digest('hex')!==raw.responseSha256||raw.requestSha256!==u.requestSha256)throw Error('RAW_IDENTITY_DRIFT')
  const source=sources.find(s=>s.sourceId===u.sourceId),context={index:await x.indexImmutableScopesV11(source.sourceId,source.sourceVersionId,source.sourceText),referenceTime:source.referenceTime,timezone:source.timezone}
  const p=x.decodeCurrentSourceRecording(raw.rawHttpText,u.candidate,context),first=x.assembleCurrentFirstSuggestion(p.result,{sourceText:source.sourceText,referenceTime:source.referenceTime,timezone:source.timezone})
  const originalFacts=x.assembleSemanticFirstSuggestionD26(x.projectConditionalNonAction(p.originalAdapted,context).result,context).result
  // Assess original facts. Removing an ungrounded display value never earns a correct score.
  const diagnostic=x.diagnoseRecordedFacts(x.RECORDED_FACT_REFERENCES.find(r=>r.sourceId===u.sourceId),originalFacts,context)
  cases.push({ordinal:u.ordinal,sourceId:u.sourceId,candidate:u.candidate,sourceSha256:source.sourceSha256,responseSha256:raw.responseSha256,requestSha256:raw.requestSha256,referenceTime:source.referenceTime,modelFactsDiagnosticUnchanged:diagnostic,originalModelWire:JSON.parse(JSON.parse(raw.rawHttpText).output[0].content[0].text),programConversion:p.sidecar,firstSuggestion:first.result,channelGrounding:first.materialChannelAudit,humanCorrections:[],rateRole:'POST_HOC_PROVISIONAL_NOT_NEW_MODEL_EFFECT',wholeUserCorrect:'NOT_OBSERVABLE'})
}
const {scene:after}=await candidate19RecordedScene()
if(after.ledger.sha256!==before.ledger.sha256)throw Error('LEDGER_CHANGED_DURING_READ_ONLY_DIAGNOSTIC')
const summary=Object.fromEntries(['Candidate17','Candidate19'].map(candidate=>{const arm=cases.filter(c=>c.candidate===candidate);return [candidate,{denominator:6,provisionalPass:arm.filter(c=>c.modelFactsDiagnosticUnchanged.completeStatus==='PROVISIONAL_STRUCTURED_PASS').length,factError:arm.filter(c=>c.modelFactsDiagnosticUnchanged.completeStatus==='FACT_ERROR').length,unknown:arm.filter(c=>c.modelFactsDiagnosticUnchanged.completeStatus==='UNKNOWN').length,channelDispositions:arm.flatMap(c=>c.channelGrounding.decisions.map(d=>({sourceId:c.sourceId,...d}))) }]}))
writeFileSync(join(out,'REPORT.json'),JSON.stringify({version:'recorded-channel-role-diagnostic-1.0.0',role:'POST_HOC_ALL_12_NOT_NEW_MODEL_COMPARISON',plannedDenominator:12,newModelRequests:0,grant:0,reserve:0,settle:0,ledgerBefore:before.ledger,ledgerAfter:after.ledger,referenceRole:'single-author/model-assisted/provisional',originalFrozen:'C17 2/6; C19 1/6; MIXED_PROGRESS unchanged',summary,cases},null,2)+'\n')
console.log(JSON.stringify({report:join(out,'REPORT.json'),summary,ledgerUnchanged:true},null,2))
