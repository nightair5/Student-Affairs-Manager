import {build} from 'esbuild'
import {readFileSync,writeFileSync} from 'node:fs'
import {isDeepStrictEqual} from 'node:util'
const b=await build({stdin:{contents:`export {CURRENT_NOTICE_CASES,createCurrentNoticeFixture} from './src/experiments/candidate19Recorded/currentNoticeFixtures';export {decodeCurrentSourceRecording} from './src/recognition/conditionalNonActionProduct';export {assembleCurrentFirstSuggestion} from './src/recognition/materialChannelGrounding';export {interpretTimeD26} from './src/lib/timeSemanticsD26';`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'})
const x=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'))
const cases=[]
for(const row of x.CURRENT_NOTICE_CASES){
 const f=await x.createCurrentNoticeFixture(row.id)
 try{const decoded=x.decodeCurrentSourceRecording(f.rawHttpText,'EngineeringFixture',f.context),first=x.assembleCurrentFirstSuggestion(decoded.result,{sourceText:f.sourceText,referenceTime:f.context.referenceTime,timezone:f.context.timezone})
 cases.push({id:row.id,role:f.role,first:first.result,conversion:decoded.supportAccountingAudit,timeAudit:first.audit.times})}
 catch(e){cases.push({id:row.id,role:f.role,error:e.message})}
}
const report={version:'current-notice-engineering-diagnostic-1',modelCalls:0,cases}
if(process.argv[2]==='--write-before')writeFileSync('docs/recognition-optimization/candidate19-public-development/current-notice-mainline/BEFORE.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'})
else if(process.argv[2]==='--write-after')writeFileSync('docs/recognition-optimization/candidate19-public-development/current-notice-mainline/AFTER.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'})
else if(process.argv[2]==='--verify'&&!isDeepStrictEqual(JSON.parse(readFileSync('docs/recognition-optimization/candidate19-public-development/current-notice-mainline/AFTER.json','utf8')),report))throw Error('CURRENT_NOTICE_AFTER_DRIFT')
else if(!['--verify','--write-before','--write-after'].includes(process.argv[2]))throw Error('CURRENT_NOTICE_DIAGNOSTIC_MODE')
if(cases.some(c=>c.error))process.exitCode=1
console.log(JSON.stringify(cases.map(c=>({id:c.id,error:c.error??null,times:c.first?.timePoints.map(p=>({id:p.tempId,raw:p.rawText,value:p.normalizedValue,needsConfirmation:p.needsConfirmation})),conflicts:c.first?.conflicts})),null,2))
