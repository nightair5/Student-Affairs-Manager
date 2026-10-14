import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {resolve,dirname} from 'node:path'
import {pathToFileURL} from 'node:url'
import {verifyD9Package} from './verify-candidate15-d9.mjs'

const D9_HEAD='645555681163f4bdac55377df88caa5cec7d0c46'
const root='docs/recognition-optimization/candidate15/d10-development'
const d9='docs/recognition-optimization/candidate15/d9-development'
const hash=value=>createHash('sha256').update(value).digest('hex')
const bytes=path=>readFileSync(path)
const canonicalBytes=value=>Buffer.from(value.toString('utf8').replace(/\r\n/g,'\n'))
const fileHash=path=>hash(canonicalBytes(bytes(path)))
const assert=(value,code)=>{if(!value)throw Error('D10_GUARD_'+code)}
const oldFiles=['MANIFEST.json','REFERENCES.json','LEGAL_WIRE_ORACLES.json','ROUNDTRIP_RESULTS.json','PREPARED_REQUEST_IDENTITIES.json']
const productFiles=[
  'src/App.tsx','src/components/DraftReviewPanel.tsx','src/components/SourceDetailPanel.tsx',
  'src/lib/sourceWorkflow.ts','src/pages/InboxPage.tsx','src/pages/LibraryPage.tsx',
  'src/experiments/realInput01/IndependentEventEditor.tsx','src/experiments/realInput01/factCorrections.ts',
  'src/experiments/realInput01/runtime.ts','src/experiments/mainline05/semanticState.ts',
  'src/experiments/mainline05/semanticConfirmation.ts',
  'src/experiments/mainline02/runtime.ts','src/experiments/candidate15/d8Observation.ts',
  'src/experiments/candidate15/d8Runtime.tsx','src/experiments/candidate15/d8Browser.tsx',
  'src/experiments/candidate15/uiMeasurement.ts','src/experiments/candidate15/measurement.ts','scripts/serve-candidate15-d8.mjs',
  'scripts/serve-candidate15-d10.mjs','scripts/prepare-candidate15-d10.mjs',
  'scripts/candidate15-d10.node-test.mjs'
]
const changedD9Files=new Set(productFiles)
const expectedGate={determinateUnits:24,schemaAndReferencesPerArm:12,candidate15Severe:0,candidate15Forbidden:0,teachingLeak:0,
  taskFnDeltaMaximum:0,criticalMajorDeltaMaximum:0,completeSourceNetGainMinimum:2,failureDecision:'REJECT_CANDIDATE15_DEVELOPMENT'}
export function assertD10DispatchAuthorized(){throw Error('D10_DISPATCH_NOT_AUTHORIZED_NEW_GRANT_REQUIRED')}
export function verifyD10Package(manifest,prepared,d9Manifest,d9Prepared){
  verifyD9Package(d9Manifest,d9Prepared)
  assert(manifest.dispatchAuthorized===false&&manifest.runStatus==='NOT_RUN'&&manifest.modelCalls===0,'ZERO_CALL')
  assert(manifest.d9Head===D9_HEAD&&manifest.d9ManifestSha256===hash(bytes(d9+'/MANIFEST.json')),'D9_BINDING')
  assert(prepared.version==='candidate15-d10-requests-1.0.0'&&prepared.dispatchAuthorized===false&&prepared.runStatus==='NOT_RUN','PREPARED_STATE')
  assert(prepared.requests.length===24&&manifest.actualRequestIdentities.length===24,'COUNT')
  const seen=new Set(),orders=new Map()
  for(const [i,row] of prepared.requests.entries()){
    const prior=d9Prepared.requests[i]
    assert(row.ordinal===i+1&&row.status==='NOT_RUN'&&row.dispatchAuthorized===false,'ROW_STATE')
    assert(row.unitIdentitySha256===prior.unitIdentitySha256&&row.requestSha256===prior.requestSha256&&JSON.stringify(row.body)===JSON.stringify(prior.body),'REQUEST_DRIFT')
    assert(!seen.has(row.unitIdentitySha256),'DUPLICATE');seen.add(row.unitIdentitySha256)
    assert(JSON.stringify(row)===JSON.stringify(prior),'D9_IDENTITY_CHANGED')
    assert(JSON.stringify(manifest.actualRequestIdentities[i])===JSON.stringify(d9Manifest.actualRequestIdentities[i]),'MANIFEST_IDENTITY')
    const arms=orders.get(row.sourceId)??[];arms.push(row.arm);orders.set(row.sourceId,arms)
  }
  assert(orders.size===12&&[...orders.values()].filter(a=>a.join('')==='AB').length===6&&[...orders.values()].filter(a=>a.join('')==='BA').length===6,'BALANCE')
  assert(JSON.stringify(manifest.promotionGate)===JSON.stringify(expectedGate),'GATE_DRIFT')
  return {sources:12,requests:24,identitiesUnchanged:true,dispatchAuthorized:false}
}
export function prepareD10(write=false){
  const d9Manifest=JSON.parse(bytes(d9+'/MANIFEST.json')),d9Prepared=JSON.parse(bytes(d9+'/PREPARED_REQUEST_IDENTITIES.json'))
  for(const name of oldFiles){const path=d9+'/'+name,historical=execFileSync('git',['show',`${D9_HEAD}:${path}`]);assert(bytes(path).equals(historical),'D9_FROZEN_ARTIFACT_DRIFT_'+name)}
  for(const entry of d9Manifest.files){
    const historical=execFileSync('git',['show',`${D9_HEAD}:${entry.path}`])
    assert(hash(canonicalBytes(historical))===entry.sha256,'D9_HISTORICAL_COMPONENT_'+entry.path)
    if(!changedD9Files.has(entry.path))assert(fileHash(entry.path)===entry.sha256,'D9_UNRELATED_COMPONENT_DRIFT_'+entry.path)
  }
  const references={d9Head:D9_HEAD,d9Files:oldFiles.map(name=>({path:d9+'/'+name,sha256:hash(bytes(d9+'/'+name))})),productFiles:productFiles.map(path=>({path,sha256:fileHash(path)}))}
  const prepared={version:'candidate15-d10-requests-1.0.0',dispatchAuthorized:false,runStatus:'NOT_RUN',d9IdentityPolicy:'BYTE_IDENTICAL_REQUESTS',requests:d9Prepared.requests}
  const requestBytes=prepared.requests.map(row=>Buffer.byteLength(JSON.stringify(row.body)))
  const manifest={version:'candidate15-d10-development-freeze-1.0.0',status:'ZERO_CALL_REVIEW_ONLY',dataRole:'FULLY_SEEN_SYNTHETIC_DEVELOPMENT',independentHumanTruth:false,
    d9Head:D9_HEAD,d9ManifestSha256:hash(bytes(d9+'/MANIFEST.json')),historicalValidation:'GIT_SHOW_D9_HEAD',
    sources:12,arms:{candidate03:12,candidate15:12},orders:{AB:6,BA:6},model:'deepseek-flash',
    fixedParameters:d9Manifest.fixedParameters,promotionGate:expectedGate,actualRequestIdentities:d9Manifest.actualRequestIdentities,
    requestBytes:{total:requestBytes.reduce((a,b)=>a+b,0),minimum:Math.min(...requestBytes),maximum:Math.max(...requestBytes)},
    references,dispatchAuthorized:false,runStatus:'NOT_RUN',modelCalls:0,grantCreated:false,ledgerWritten:false,
    repeatPolicy:'ONE_SEND_ZERO_RETRY_ZERO_REPAIR_ZERO_VERIFIER_STOP_ON_UNCERTAIN_SEND_OR_SETTLE',
    requestIdentityPolicy:'D9_BODY_AND_IDENTITY_BYTE_IDENTICAL_OR_STOP'}
  verifyD10Package(manifest,prepared,d9Manifest,d9Prepared)
  if(write){mkdirSync(root,{recursive:true});for(const [name,value] of [['MANIFEST.json',manifest],['PREPARED_REQUEST_IDENTITIES.json',prepared]]){
    const path=root+'/'+name;mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(value,null,2)+'\n')
  }}else{
    assert(JSON.stringify(manifest)===JSON.stringify(JSON.parse(bytes(root+'/MANIFEST.json'))),'MANIFEST_DRIFT')
    assert(JSON.stringify(prepared)===JSON.stringify(JSON.parse(bytes(root+'/PREPARED_REQUEST_IDENTITIES.json'))),'PREPARED_DRIFT')
  }
  return {sources:12,requests:24,requestBytes:manifest.requestBytes,dispatchAuthorized:false,d9ManifestSha256:manifest.d9ManifestSha256}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log(JSON.stringify(prepareD10(process.argv[2]==='--write')))
