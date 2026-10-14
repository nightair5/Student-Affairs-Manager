import {existsSync,readFileSync,writeFileSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {ROOT,json,verifyCurrentNoticeDiagnostic} from './prepare-current-notice-diagnostic.mjs'
import {createCurrentNoticeHost} from './current-notice-execution-host.mjs'
import {reportPublicNotices} from './public-notice-scoring.mjs'
export async function currentNoticeReport(){
 const pack=verifyCurrentNoticeDiagnostic(),scene=await createCurrentNoticeHost().resumeReadOnly(),references=JSON.parse(readFileSync(join(ROOT,'REFERENCES.json'),'utf8')).references,path=join(ROOT,'ADJUDICATION.json')
 const adjudications=existsSync(path)?JSON.parse(readFileSync(path,'utf8')).adjudications:[]
 if(adjudications.length&&!scene.state?.units.every(u=>u.status==='SETTLED'))throw Error('CURRENT_NO_WHOLE_RESULT_BEFORE_DETERMINATE_BATCH')
 return {batch:JSON.parse(readFileSync(join(ROOT,'MANIFEST.json'),'utf8')).batch,snapshot:pack.snapshot,authorization:'NOT_IMPLIED_BY_REPORT',execution:scene,metricScope:'CURRENT_SINGLE_ARM_DEVELOPMENT_NOT_IMPROVEMENT',...reportPublicNotices(references,adjudications),modelCallsByThisReport:0,ledgerWrites:0,humanMetrics:'NOT_OBSERVABLE'}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const r=await currentNoticeReport();if(process.argv[2]==='--write-not-run'){if(r.execution.state||r.execution.batchEvidence.rows)throw Error('CURRENT_NOT_RUN_REPORT_HAS_ACTIVITY');writeFileSync(join(ROOT,'NOT_RUN_REPORT.json'),json(r),{flag:'wx'})}else if(process.argv[2])throw Error('CURRENT_REPORT_MODE');console.log(json(r))}
