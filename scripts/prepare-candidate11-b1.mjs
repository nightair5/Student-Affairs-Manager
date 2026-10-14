import {createHash} from 'node:crypto'
import {existsSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs'
import {dirname, resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {isDeepStrictEqual} from 'node:util'
import {build} from 'esbuild'
import {verifyProtectedFiles} from './verify-candidate11-analysis.mjs'

export const B1_DIRECTORY='docs/recognition-optimization/candidate11/b1-preparation'
export const SOURCES_FILE=B1_DIRECTORY+'/SOURCES.json'
export const REFERENCES_FILE=B1_DIRECTORY+'/REFERENCES.json'
export const MODEL_SCHEMA_FILE=B1_DIRECTORY+'/MODEL_SCHEMA.json'
export const PREPARED_FILE=B1_DIRECTORY+'/PREPARED_REQUESTS.json'
export const MANIFEST_FILE=B1_DIRECTORY+'/MANIFEST.json'
export const REPORT_FILE=B1_DIRECTORY+'/PREPARATION_REPORT.json'
export const AUTHORITY_LEDGER='C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl'
export const SNAPSHOT_LEDGER='docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl'
const EXPECTED_LEDGER_SHA='dc52d9cd04b809be9d22d5298bd45d0e6f0a01307017d48a91aaa91a45e8e597'
const VARIANTS=['V00','V10','V01','V11']
const sha256=value=>createHash('sha256').update(value).digest('hex')
const check=(condition,code)=>{if(!condition)throw Error('C11_B1_'+code)}
const readJson=(root,path)=>JSON.parse(readFileSync(resolve(root,path),'utf8'))
const stable=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)
  ?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item)
const json=value=>JSON.stringify(value,null,2)+'\n'

export async function loadB1Api(root=process.cwd()) {
  const bundled=await build({absWorkingDir:root,stdin:{contents:`
    export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11.ts';
    export {prepareCandidate11,validateCandidate11Prepared,candidate11StageRecord,denyCandidate11Dispatch,C11_SCORER_VERSION} from './src/experiments/candidate11/identity.ts';
    export {CANDIDATE11_VERSION,CANDIDATE11_EXAMPLE_VERSION,CANDIDATE11_VARIANTS,CANDIDATE11_META,CANDIDATE11_EXAMPLES} from './src/experiments/realInput01/candidate11.ts';
    export {MODEL_JSON_SCHEMA,WIRE_VERSION,FLASH41_MODEL_NAME,MAX_REQUEST_BYTES,MAX_OUTPUT_TOKENS} from './src/experiments/realInput01/modelWire.ts';
    export {SEMANTIC_VERSION} from './src/experiments/mainline04/semanticContract.ts';
  `,resolveDir:root,loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent'})
  return import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].contents).toString('base64'))
}

function allEvidenceQuotes(value,out=[]) {
  if(Array.isArray(value)){for(const item of value)allEvidenceQuotes(item,out);return out}
  if(!value||typeof value!=='object')return out
  for(const [key,child] of Object.entries(value)){
    if(key==='evidenceQuote'&&typeof child==='string')out.push(child)
    else if(key==='evidenceQuotes'&&Array.isArray(child))out.push(...child)
    else allEvidenceQuotes(child,out)
  }
  return out
}

export function validateB1Inputs(sources,references,examples) {
  check(sources?.version==='candidate11-b1-development-sources-1.0.0'&&sources.evaluationRole==='SEEN_DEVELOPMENT','SOURCE_VERSION')
  check(references?.version==='candidate11-b1-structured-references-1.0.0','REFERENCE_VERSION')
  check(Array.isArray(sources.sources)&&sources.sources.length===6&&Array.isArray(references.references)&&references.references.length===6,'SOURCE_COUNT')
  const sourceIds=new Set(),referenceIds=new Set()
  for(const source of sources.sources){
    check(/^C11-B1-D0[1-6]$/.test(source.id)&&!sourceIds.has(source.id)&&typeof source.text==='string'&&source.text.trim(),'SOURCE_ID')
    sourceIds.add(source.id)
    check(source.seenDegree==='SEEN_BY_CANDIDATE_DEVELOPER_AND_REFERENCE_AUTHOR'&&source.teachingOverlap?.exactTextOverlap===false,'SEEN_DISCLOSURE')
    check(Array.isArray(source.variantOrder)&&source.variantOrder.length===4&&new Set(source.variantOrder).size===4
      &&source.variantOrder.every(value=>VARIANTS.includes(value)),'VARIANT_ORDER')
    check(!examples.some(example=>source.text.includes(example.text)||example.text.includes(source.text)),'EXACT_TEACHING_OVERLAP')
  }
  for(const reference of references.references){
    const source=sources.sources.find(item=>item.id===reference.sourceId)
    check(source&&!referenceIds.has(reference.sourceId),'REFERENCE_ID');referenceIds.add(reference.sourceId)
    check(reference.coverage==='complete'&&reference.provenance?.independentHuman===false,'REFERENCE_DISCLOSURE')
    check(Array.isArray(reference.minimalObligations)&&reference.minimalObligations.length===reference.composition.semanticTaskEntityCount,'OBLIGATION_COUNT')
    const ids=new Set(reference.minimalObligations.map(item=>item.id))
    check(ids.size===reference.minimalObligations.length,'OBLIGATION_ID')
    for(const task of reference.minimalObligations){
      check(task.actionAliases?.length&&task.objectAliases?.length&&task.evidenceQuotes?.length,'OBLIGATION_IDENTITY')
      check(task.dependencyIds.every(id=>ids.has(id)),'DEPENDENCY_ID')
      check(task.evidenceQuotes.every(quote=>source.text.includes(quote)),'TASK_EVIDENCE')
    }
    check(allEvidenceQuotes(reference).every(quote=>source.text.includes(quote)),'REFERENCE_EVIDENCE')
    check(reference.scorerReference?.coverage==='complete'&&reference.scorerReference.tasks.length===reference.minimalObligations.length,'SCORER_PROJECTION')
  }
  check([...sourceIds].every(id=>referenceIds.has(id)),'REFERENCE_COVERAGE')
  const positions=Object.fromEntries(VARIANTS.map(variant=>[variant,[0,0,0,0]])),transitions={}
  for(const source of sources.sources)for(const [position,variant] of source.variantOrder.entries()){
    positions[variant][position]++
    if(position){const edge=source.variantOrder[position-1]+'>'+variant;transitions[edge]=(transitions[edge]??0)+1}
  }
  check(Object.values(positions).every(row=>row.reduce((a,b)=>a+b,0)===6&&Math.max(...row)-Math.min(...row)<=1),'POSITION_BALANCE')
  for(let position=0;position<4;position++){
    const mOn=sources.sources.filter(source=>source.variantOrder[position][1]==='1').length
    const eOn=sources.sources.filter(source=>source.variantOrder[position][2]==='1').length
    check(mOn===3&&eOn===3,'FACTOR_POSITION_BALANCE')
  }
  check(Object.keys(transitions).length===12&&Object.values(transitions).every(count=>count>=1&&count<=2),'TRANSITION_BALANCE')
  return {positions,transitions}
}

function fileHash(root,path){return sha256(readFileSync(resolve(root,path)))}
function assertSameNonPromptBodies(requests) {
  const normalized=requests.map(entry=>{const body=structuredClone(entry.prepared.request);body.input[0].content[0].text='__FACTOR_PROMPT__';return body})
  check(normalized.every(body=>isDeepStrictEqual(body,normalized[0])),'NON_PROMPT_DRIFT')
  const user=requests.map(entry=>entry.prepared.request.input[1])
  check(user.every(value=>isDeepStrictEqual(value,user[0])),'INPUT_DRIFT')
  check(requests.every(entry=>isDeepStrictEqual(entry.prepared.identity.modelConfig,requests[0].prepared.identity.modelConfig)),'MODEL_CONFIG_DRIFT')
}

export async function buildB1Outputs(root=process.cwd()) {
  const api=await loadB1Api(root),sources=readJson(root,SOURCES_FILE),references=readJson(root,REFERENCES_FILE)
  const balance=validateB1Inputs(sources,references,api.CANDIDATE11_EXAMPLES)
  check(isDeepStrictEqual(api.CANDIDATE11_VARIANTS,VARIANTS),'VARIANT_VERSION')
  const referenceById=new Map(references.references.map(value=>[value.sourceId,value])),requests=[]
  let ordinal=0
  for(const source of sources.sources){
    const context={index:await api.indexImmutableScopesV11(source.id,source.id+'-v1',source.text),referenceTime:sources.referenceTime,timezone:sources.timezone}
    const sourceRequests=[]
    for(const variant of source.variantOrder){
      const prepared=await api.prepareCandidate11(context,variant);await api.validateCandidate11Prepared(prepared)
      const requestSerialized=JSON.stringify(prepared.request),reference=referenceById.get(source.id)
      check(prepared.modelCallsEnabled===false&&prepared.mode==='ENGINEERING_NO_AUTHORIZATION'&&prepared.stage==='prepared','DISPATCH_MODE')
      check(prepared.identity.requestSha===sha256(requestSerialized)&&prepared.identity.inputSha===sha256(source.text),'REQUEST_HASH')
      const unitCore={unitId:`${source.id}-${variant}`,ordinal:++ordinal,sourceId:source.id,sourceVersionId:context.index.sourceVersionId,
        variant,position:source.variantOrder.indexOf(variant)+1,sourceSha:sha256(source.text),referenceSha:sha256(stable(reference)),
        identitySha:prepared.identitySha,requestSha:prepared.identity.requestSha,inputSha:prepared.identity.inputSha,promptSha:prepared.identity.promptSha,
        exampleSha:prepared.identity.exampleSha,schemaSha:prepared.identity.schemaSha,requestBytes:Buffer.byteLength(requestSerialized)}
      const entry={...unitCore,unitIdentitySha:sha256(stable(unitCore)),resultStatus:'NOT_RUN',dispatchAuthorized:false,
        requestSerialized,prepared}
      requests.push(entry);sourceRequests.push(entry)
    }
    assertSameNonPromptBodies(sourceRequests)
    check(new Set(sourceRequests.map(entry=>entry.inputSha)).size===1&&new Set(sourceRequests.map(entry=>entry.schemaSha)).size===1,'WITHIN_SOURCE_IDENTITY')
    const prompt=Object.fromEntries(sourceRequests.map(entry=>[entry.variant,entry.prepared.request.input[0].content[0].text]))
    const examplesText=JSON.stringify(api.CANDIDATE11_EXAMPLES)
    check(prompt.V10===prompt.V00+'\n'+api.CANDIDATE11_META&&prompt.V01===prompt.V00+'\n'+examplesText
      &&prompt.V11===prompt.V00+'\n'+api.CANDIDATE11_META+'\n'+examplesText,'FACTOR_DECOMPOSITION')
  }
  check(requests.length===24&&new Set(requests.map(entry=>entry.unitId)).size===24&&new Set(requests.map(entry=>entry.unitIdentitySha)).size===24,'ROSTER')
  const modelSchemaText=json(api.MODEL_JSON_SCHEMA)
  const preparedPackage={version:'candidate11-b1-prepared-requests-1.0.0',status:'B1_PREPARED_FOR_REVIEW',modelCalls:0,
    dispatchAuthorized:false,resultStatus:'NOT_RUN',evaluationRole:'SEEN_DEVELOPMENT',requestCount:requests.length,requests}
  const preparedText=json(preparedPackage)
  const inputPaths=[SOURCES_FILE,REFERENCES_FILE,B1_DIRECTORY+'/REFERENCE_SCHEMA.json',B1_DIRECTORY+'/SCORING_REFERENCE_RULES.md',
    B1_DIRECTORY+'/EXPERIMENT_DESIGN.md',B1_DIRECTORY+'/BUDGET_AUTHORIZATION_CARD.md',B1_DIRECTORY+'/PRICING_EVIDENCE.json',
    B1_DIRECTORY+'/README.md',B1_DIRECTORY+'/REVIEW.md',
    'src/experiments/realInput01/candidate11.ts','src/experiments/realInput01/candidate03.ts','src/experiments/realInput01/contrastiveEvidenceExamples.ts',
    'src/experiments/realInput01/modelWire.ts','src/experiments/mainline04/semanticContract.ts','src/experiments/candidate11/identity.ts',
    'scripts/score-candidate11-recognition.mjs','scripts/prepare-candidate11-b1.mjs','scripts/candidate11-b1.node-test.mjs']
  const artifactHashes=Object.fromEntries(inputPaths.map(path=>[path,fileHash(root,path)]))
  artifactHashes[MODEL_SCHEMA_FILE]=sha256(modelSchemaText);artifactHashes[PREPARED_FILE]=sha256(preparedText)
  const candidateFiles=['src/experiments/realInput01/candidate11.ts','src/experiments/realInput01/candidate03.ts','src/experiments/realInput01/contrastiveEvidenceExamples.ts']
  const candidateBundleSha=sha256(candidateFiles.map(path=>path+':'+artifactHashes[path]).join('\n'))
  const manifest={version:'candidate11-b1-manifest-1.0.0',status:'B1_PREPARED_FOR_REVIEW',resultStatus:'NOT_RUN',modelCallsEnabled:false,
    authorization:'AWAITING_NEW_MODEL_CALL_AUTHORIZATION',evaluationRole:'SEEN_DEVELOPMENT',requestCount:24,
    versions:{candidate:api.CANDIDATE11_VERSION,examples:api.CANDIDATE11_EXAMPLE_VERSION,wire:api.WIRE_VERSION,semantic:api.SEMANTIC_VERSION,
      scorer:api.C11_SCORER_VERSION,reference:references.version,source:sources.version},
    fixedConfig:{model:api.FLASH41_MODEL_NAME,temperature:0,reasoning:{effort:'none'},maxOutputTokens:api.MAX_OUTPUT_TOKENS,
      requestByteCeiling:api.MAX_REQUEST_BYTES,referenceTime:sources.referenceTime,timezone:sources.timezone},
    candidateBundleSha,modelSchemaSha:sha256(modelSchemaText),artifactHashes,balance,
    units:requests.map(({requestSerialized,prepared,...unit})=>({...unit,candidateBundleSha,modelConfig:prepared.identity.modelConfig})),
    prohibitions:['MODEL_DISPATCH','SECRET_READ','GRANT_CREATE','BUDGET_RESERVE','RECEIPT_CREATE','LEDGER_WRITE','HUMAN_TRIAL','MERGE','DEPLOY']}
  const manifestText=json(manifest),protection=verifyProtectedFiles(root)
  const authority=readFileSync(AUTHORITY_LEDGER),snapshot=readFileSync(resolve(root,SNAPSHOT_LEDGER))
  const ledgerRows=snapshot.toString('utf8').trimEnd().split('\n').map(JSON.parse)
  const ledger={authoritativePath:AUTHORITY_LEDGER,authoritativeSha:sha256(authority),snapshotPath:SNAPSHOT_LEDGER,snapshotSha:sha256(snapshot),
    bytes:snapshot.length,rows:ledgerRows.length,reserves:ledgerRows.filter(row=>['reserve','recoveryReserve','batchReserve'].includes(row.event?.kind)).length,
    sameBytes:isDeepStrictEqual(authority,snapshot),expectedSha:EXPECTED_LEDGER_SHA,writerOpened:false}
  check(ledger.authoritativeSha===EXPECTED_LEDGER_SHA&&ledger.snapshotSha===EXPECTED_LEDGER_SHA&&ledger.sameBytes&&ledger.rows===644&&ledger.reserves===314,'LEDGER_SNAPSHOT')
  const report={version:'candidate11-b1-preparation-report-1.0.0',status:'B1_PREPARED_FOR_REVIEW',modelCalls:0,
    preparedRequests:24,completeEngineeringReferences:references.references.filter(value=>value.coverage==='complete').length,
    partialReferences:references.references.filter(value=>value.coverage==='partial').length,independentHumanReferences:0,
    manifestSha:sha256(manifestText),preparedPackageSha:sha256(preparedText),modelSchemaSha:sha256(modelSchemaText),
    maxPreparedRequestBytes:Math.max(...requests.map(entry=>entry.requestBytes)),minPreparedRequestBytes:Math.min(...requests.map(entry=>entry.requestBytes)),
    protection,ledger,historicalFailure:{id:'RCO-5-007',status:'PRESERVED_FAILING',error:'FREEZE_HASH_MISMATCH:package-lock.json'},
    dispatch:'DENIED',authorization:'AWAITING_NEW_MODEL_CALL_AUTHORIZATION'}
  return {modelSchemaText,preparedText,manifestText,reportText:json(report),manifest,preparedPackage,report}
}

function freezeWrite(root,path,textValue) {
  const target=resolve(root,path);mkdirSync(dirname(target),{recursive:true})
  if(existsSync(target))check(readFileSync(target,'utf8')===textValue,'FROZEN_OUTPUT_DRIFT:'+path)
  else writeFileSync(target,textValue,{flag:'wx'})
}
export async function writeB1Outputs(root=process.cwd()) {
  const outputs=await buildB1Outputs(root)
  freezeWrite(root,MODEL_SCHEMA_FILE,outputs.modelSchemaText);freezeWrite(root,PREPARED_FILE,outputs.preparedText)
  freezeWrite(root,MANIFEST_FILE,outputs.manifestText);freezeWrite(root,REPORT_FILE,outputs.reportText)
  return outputs
}
export async function verifyB1Outputs(root=process.cwd()) {
  const outputs=await buildB1Outputs(root)
  for(const [path,textValue] of [[MODEL_SCHEMA_FILE,outputs.modelSchemaText],[PREPARED_FILE,outputs.preparedText],
    [MANIFEST_FILE,outputs.manifestText],[REPORT_FILE,outputs.reportText]])check(existsSync(resolve(root,path))&&readFileSync(resolve(root,path),'utf8')===textValue,'OUTPUT_DRIFT:'+path)
  return outputs
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const args=process.argv.slice(2);check(args.length===1&&['--write','--verify'].includes(args[0]),'ARGUMENT')
  const result=args[0]==='--write'?await writeB1Outputs():await verifyB1Outputs()
  console.log(JSON.stringify({status:result.report.status,requests:result.report.preparedRequests,modelCalls:result.report.modelCalls,
    references:result.report.completeEngineeringReferences,manifestSha:result.report.manifestSha,
    maxPreparedRequestBytes:result.report.maxPreparedRequestBytes,ledger:result.report.ledger,protection:result.report.protection}))
}
