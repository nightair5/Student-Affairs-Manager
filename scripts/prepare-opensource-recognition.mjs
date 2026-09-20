// Offline only: builds an auditable 24-request comparison package. No credentials,
// dispatch, database access, retries or deployment. Never overwrites an old run.
import {build} from 'esbuild'
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {tmpdir} from 'node:os'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'

const root=process.cwd(),sha=b=>createHash('sha256').update(b).digest('hex')
const directory=mkdtempSync(join(tmpdir(),'student-affairs-contrastive-'))
const compiled=join(directory,'prepare.mjs')
await build({absWorkingDir:root,stdin:{contents:`export {buildCandidate10ComparisonRequest} from './src/experiments/realInput01/candidate10.ts';
export {CONTRASTIVE_DEVELOPMENT_CASES} from './src/experiments/realInput01/contrastiveDevelopmentCases.ts';
export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11.ts';`,resolveDir:root},
  bundle:true,platform:'node',format:'esm',target:'node24',outfile:compiled,logLevel:'silent'})
const api=await import(pathToFileURL(compiled).href)
const requests=[],references=[]
for(const item of api.CONTRASTIVE_DEVELOPMENT_CASES){
  const context={index:await api.indexImmutableScopesV11('opensource-dev-'+item.id,'opensource-dev-'+item.id+':1',item.text),
    referenceTime:'2026-09-20T09:00:00+08:00',timezone:'Asia/Shanghai'}
  references.push({id:item.id,source:item.text,reference:item.reference,labelProvenance:'single-author-synthetic-development'})
  for(const arm of ['baseline','contrastive']){
    const request=await api.buildCandidate10ComparisonRequest(context,arm)
    const user=JSON.parse(request.body.input[1].content[0].text)
    if(Object.keys(user).sort().join(',')!=='referenceTime,scopes,source,timezone'||user.source!==item.text)throw Error('REQUEST_SCOPE_INVALID')
    requests.push({id:item.id,arm,context,promptVersion:request.promptVersion,requestSha256:sha(request.serialized),
      bytes:Buffer.byteLength(request.serialized),body:request.body})
  }
}
const protectedPaths=['src/experiments/realInput01/candidate03.ts','src/experiments/realInput01/modelWire.ts',
  'src/experiments/mainline04/semanticComposer.ts','src/experiments/mainline05/semanticCapture.ts',
  'src/experiments/mainline05/semanticState.ts','scripts/real-input-model-gateway.mjs','scripts/real-input-budget.mjs',
  'docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl']
const candidatePaths=['src/experiments/realInput01/candidate10.ts','src/experiments/realInput01/contrastiveEvidenceExamples.ts',
  'src/experiments/realInput01/contrastiveDevelopmentCases.ts']
mkdirSync(join(directory,'package'))
const output=join(directory,'package'),requestJson=JSON.stringify(requests,null,2)+'\n',referenceJson=JSON.stringify(references,null,2)+'\n'
writeFileSync(join(output,'REQUESTS.json'),requestJson)
writeFileSync(join(output,'REFERENCES.json'),referenceJson)
const manifest={version:'opensource-contrastive-development-1',createdAt:new Date().toISOString(),
  directory:output,modelCalls:0,dispatchEnabled:false,model:'deepseek-flash',reasoning:'none',
  plannedRequests:requests.length,sourceCount:references.length,promptVersions:[...new Set(requests.map(r=>r.promptVersion))],
  requestFileSha256:sha(requestJson),referenceFileSha256:sha(referenceJson),
  candidates:candidatePaths.map(path=>({path,sha256:sha(readFileSync(resolve(root,path)))})),
  protectedFiles:protectedPaths.map(path=>({path,sha256:sha(readFileSync(resolve(root,path)))})),
  requestBytes:{baseline:requests.filter(r=>r.arm==='baseline').map(r=>r.bytes),contrastive:requests.filter(r=>r.arm==='contrastive').map(r=>r.bytes)},
  evaluationStatus:'NOT_RUN',adoption:'NOT_ADOPTED',referenceStatus:'single-author-synthetic-development-not-blind'}
writeFileSync(join(output,'MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n')
console.log(JSON.stringify(manifest))
