import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import {join} from 'node:path'
import {isDeepStrictEqual} from 'node:util'
import {publicNoticeRecordedScene,historicalCandidate19Controls} from './public-notice-recorded-readonly.mjs'
import {publicNoticeComponents} from './public-notice-components.mjs'
import {ROOT,sha,json} from './prepare-public-notice-diagnostic.mjs'
import {reportPublicNotices} from './public-notice-scoring.mjs'
const read=p=>JSON.parse(readFileSync(p,'utf8'))
const scene=publicNoticeRecordedScene(),x=await publicNoticeComponents(),known=[]
for(const record of scene.recordings){
  const context={index:await x.indexImmutableScopesV11(record.sourceId,record.sourceVersionId,record.sourceText),referenceTime:record.referenceTime,timezone:record.timezone}
  const decoded=x.decodeCurrentSourceRecording(record.rawHttpText,record.candidate,context),first=x.assembleCurrentFirstSuggestion(decoded.result,{sourceText:record.sourceText,referenceTime:record.referenceTime,timezone:record.timezone})
  known.push({sourceId:record.sourceId,responseSha256:record.responseSha256,modelWire:JSON.parse(JSON.parse(record.rawHttpText).output[0].content[0].text),supportAudit:decoded.supportAccountingAudit,firstSuggestion:first.result,assemblyAudit:first.audit,role:'POST_OUTPUT_PROGRAM_COMPATIBILITY_NOT_NEW_MODEL_IMPROVEMENT'})
}
const refs=read(join(ROOT,'REFERENCES.json')).references,adjudication=read(join(ROOT,'paid-evidence/ADJUDICATION.json')).adjudications
const oldDisplay=adjudication.map(a=>({...a,displayBeforeHuman:a.frozenDisplay}))
const before=reportPublicNotices(refs,oldDisplay),after=reportPublicNotices(refs,adjudication)
const old=read(join(ROOT,'OLD_12_DIAGNOSTIC.json')).cases,regression=[]
for(const record of historicalCandidate19Controls()){
  const context={index:await x.indexImmutableScopesV11(record.sourceId,record.sourceVersionId,record.sourceText),referenceTime:record.referenceTime,timezone:record.timezone}
  const first=x.assembleCurrentFirstSuggestion(x.decodeCurrentSourceRecording(record.rawHttpText,record.candidate,context).result,{sourceText:record.sourceText,referenceTime:record.referenceTime,timezone:record.timezone}).result,prior=old.find(c=>c.ordinal===record.ordinal-200)
  if(!prior||prior.responseSha256!==record.responseSha256||!isDeepStrictEqual(prior.firstSuggestion,first))throw Error('PUBLIC_OLD_FIRST_DISPLAY_REGRESSION_'+record.ordinal)
  regression.push({ordinal:record.ordinal-200,sourceId:record.sourceId,candidate:record.candidate,responseSha256:record.responseSha256,firstSuggestionEqual:true})
}
const report={version:'public-known-recorded-diagnostic-1.0.0',scope:'SEALED_INCOMPLETE_SINGLE_ARM',batch:scene.scene.batch,denominator:4,observedModelResponses:known.length,allPlannedUnits:scene.scene.units,scene:scene.scene,known,frozenReport:before,postConversionReport:after,humanFinal:'NOT_OBSERVABLE_ENGINEERING_ONLY',wireContract:{knownRejectedByFrozen:1,knownAcceptedByFrozen:0,unknown:3,reason:'Information accounting support references disagree with frozen contract; source facts evaluated separately'},conclusion:'EVIDENCE_INCOMPLETE_NO_BATCH_ACCURACY_ESTIMATE_NO_RELATIVE_WINNER',oldTwelveRegression:regression,fees:{knownUsage:scene.state.units[0].usage,knownConservativeInternalMicroUsd:scene.state.units[0].costUpperMicroUsd,uncertainReserveUpperMicroUsd:324404,totalHardLimitMicroUsd:1300000,providerActualDeduction:'NOT_OBSERVABLE'},immutable:{initialDiagnosticSha256:sha(readFileSync(join(ROOT,'paid-evidence/INITIAL_FROZEN_DIAGNOSTIC.json'))),rawFileSha256:sha(readFileSync(join(ROOT,'paid-evidence/raw-01.json'))),manifestSha256:scene.pack.binding.manifestSha256,identitiesSha256:scene.pack.binding.identitiesSha256}}
const target=join(ROOT,'paid-evidence/POST_CONVERSION_DIAGNOSTIC.json')
if(process.argv[2]==='--write'){if(existsSync(target))throw Error('PUBLIC_RECORDED_REPORT_ALREADY_EXISTS');writeFileSync(target,json(report),{flag:'wx'})}
else if(process.argv[2]==='--verify'){if(!isDeepStrictEqual(read(target),report))throw Error('PUBLIC_RECORDED_REPORT_DRIFT')}
else throw Error('PUBLIC_RECORDED_REPORT_MODE')
console.log(json({status:'SEALED_SCENE_AND_KNOWN_DIAGNOSTIC_VERIFIED',before:before.summary,after:after.summary,oldTwelveUnchanged:regression.length,dispatch:0,ledgerWrites:0}))
