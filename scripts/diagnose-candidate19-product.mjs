import {build} from 'esbuild'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {readCandidate19Package,createCandidate19Host} from './candidate19-execution-host.mjs'
import {scoreCandidate19} from './candidate19-scoring.mjs'
const root='docs/recognition-optimization/candidate19-development',out=resolve('.data/candidate19/product-diagnostic')
mkdirSync(out,{recursive:true})
await build({stdin:{contents:`export {decodeProductSourceRecording} from './src/recognition/sourceAccountingSupportProduct'; export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11'; export {assembleSemanticFirstSuggestionD26} from './src/recognition/firstSuggestionD26'; export {projectDirectiveDisposition} from './src/recognition/directiveDispositionProduct'`,resolveDir:process.cwd()},outfile:join(out,'components.mjs'),bundle:true,platform:'node',format:'esm'})
const x=await import(pathToFileURL(join(out,'components.mjs'))),pack=readCandidate19Package(),scene=await createCandidate19Host().resumeReadOnly()
if(scene.audit!=='CONSISTENT'||scene.halt||scene.lockExists||scene.state.units.some(u=>u.status!=='SETTLED'))throw Error('DIAGNOSTIC_REQUIRES_COMPLETE_DEFINITE_RECORDINGS')
const sources=JSON.parse(readFileSync(root+'/SOURCES.json')).sources,refs=JSON.parse(readFileSync(root+'/REFERENCES.json')).references
const frozen=JSON.parse(readFileSync(root+'/paid-evidence/completed/FROZEN_COMPARISON_REPORT.json'))
const cases=[]
for(const u of pack.units){
 const r=JSON.parse(readFileSync('.data/candidate19/execution/raw/'+String(u.ordinal).padStart(2,'0')+'.json')),source=sources.find(s=>s.sourceId===u.sourceId),ref=refs.find(s=>s.sourceId===u.sourceId)
 if(createHash('sha256').update(r.rawHttpText).digest('hex')!==r.responseSha256)throw Error('RAW_DRIFT')
 const context={index:await x.indexImmutableScopesV11(source.sourceId,source.sourceVersionId,source.sourceText),referenceTime:source.referenceTime,timezone:source.timezone}
 try{const p=x.decodeProductSourceRecording(r.rawHttpText,u.candidate,context),projection=x.projectDirectiveDisposition(p.originalAdapted,context),semantic=x.assembleSemanticFirstSuggestionD26(projection.result,context).result
 cases.push({ordinal:u.ordinal,sourceId:u.sourceId,candidate:u.candidate,sourceText:source.sourceText,responseSha256:r.responseSha256,originalFrozen:frozen.cases.find(c=>c.ordinal===u.ordinal),productAccepted:true,supportAudit:p.supportAccountingAudit,dispositionAudit:p.productDisposition,firstDisplay:p.result,postHocSameScorerDiagnostic:scoreCandidate19(ref,semantic,u.candidate==='Candidate19'?p.supportAccountingAudit.originalWire:null),humanCorrections:[],humanTruth:'NOT_ADJUDICATED'})
 }catch(e){cases.push({ordinal:u.ordinal,sourceId:u.sourceId,candidate:u.candidate,responseSha256:r.responseSha256,originalFrozen:frozen.cases.find(c=>c.ordinal===u.ordinal),productAccepted:false,error:e.message,humanTruth:'NOT_ADJUDICATED'})}
}
const report={version:'c19-post-comparison-product-diagnostic-1',role:'POST_HOC_OLD_RAW_PROGRAM_COMPATIBILITY_NOT_NEW_MODEL_EFFECT',plannedDenominator:12,newModelCalls:0,grantReserveSettle:0,referenceTruth:'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL',frozenScoresUnchanged:frozen.summary,selectionUnchanged:frozen.selection,summary:Object.fromEntries(['Candidate17','Candidate19'].map(c=>[c,{denominator:6,decoded:cases.filter(r=>r.candidate===c&&r.productAccepted).length,rejected:cases.filter(r=>r.candidate===c&&!r.productAccepted).length,independentWholeCorrect:'NOT_OBSERVABLE'}])),cases}
writeFileSync(join(out,'REPORT.json'),JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({file:join(out,'REPORT.json'),summary:report.summary,cases:cases.map(c=>({ordinal:c.ordinal,accepted:c.productAccepted,taskCount:c.firstDisplay?.standaloneTasks.length,eventCount:c.firstDisplay?.events.length,risks:c.postHocSameScorerDiagnostic?.risks.map(r=>r.kind),error:c.error}))},null,2))
