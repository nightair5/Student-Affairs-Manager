import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {pathToFileURL} from 'node:url'
import {resolve} from 'node:path'

const root='docs/recognition-optimization/candidate15/d9-development'
const hash=value=>createHash('sha256').update(value).digest('hex')
const sort=value=>Array.isArray(value)?value.map(sort):value&&typeof value==='object'
  ? Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,sort(item)])):value
const canonical=value=>JSON.stringify(sort(value))
const fileHash=path=>hash(Buffer.from(readFileSync(path,'utf8').replace(/\r\n/g,'\n')))
function assert(value,code){if(!value)throw Error('D9_GUARD_'+code)}

export function verifyD9Package(manifest,prepared){
  assert(manifest.dispatchAuthorized===false&&prepared.dispatchAuthorized===false,'UNAUTHORIZED_ONLY')
  assert(manifest.runStatus==='NOT_RUN'&&prepared.runStatus==='NOT_RUN','NOT_RUN')
  assert(manifest.modelCalls===0&&manifest.grantCreated===false&&manifest.ledgerWritten===false,'ZERO_CALL')
  const requests=prepared.requests
  assert(requests.length===24&&manifest.actualRequestIdentities.length===24,'COUNT')
  const seen=new Set(),orders=new Map()
  for(const [i,row] of requests.entries()){
    assert(row.ordinal===i+1&&row.status==='NOT_RUN'&&row.dispatchAuthorized===false,'ROW_STATE')
    assert(row.model===manifest.model&&row.body.model===manifest.model,'MODEL')
    assert(row.body.temperature===manifest.fixedParameters.temperature&&row.body.stream===manifest.fixedParameters.stream
      &&row.body.max_output_tokens===manifest.fixedParameters.max_output_tokens
      &&JSON.stringify(row.body.reasoning)===JSON.stringify(manifest.fixedParameters.reasoning),'PARAMETERS')
    assert(!/(Expected|referenceSha256|scoringAnswer)/i.test(JSON.stringify(row.body)),'ANSWER_LEAK')
    assert(row.requestSha256===hash(JSON.stringify(row.body)),'REQUEST_DRIFT')
    const {unitIdentitySha256,body,dispatchAuthorized,status,...identity}=row
    assert(unitIdentitySha256===hash(canonical(identity)),'IDENTITY_DRIFT')
    assert(!seen.has(unitIdentitySha256),'DUPLICATE');seen.add(unitIdentitySha256)
    const {body:ignored,...summarized}=row;void ignored
    assert(JSON.stringify(summarized)===JSON.stringify(manifest.actualRequestIdentities[i]),'MANIFEST_DRIFT')
    const pair=orders.get(row.sourceId)??[];pair.push(row);orders.set(row.sourceId,pair)
  }
  assert(orders.size===12,'SOURCE_COUNT')
  let ab=0,ba=0
  for(const pair of orders.values()){
    assert(pair.length===2&&pair[0].sourceSha256===pair[1].sourceSha256&&pair[0].referenceTime===pair[1].referenceTime&&pair[0].timezone===pair[1].timezone,'PAIR')
    const order=pair.map(row=>row.arm).join('');assert(order===pair[0].order&&order===pair[1].order&&(order==='AB'||order==='BA'),'ORDER')
    if(order==='AB')ab++;else ba++
  }
  assert(ab===6&&ba===6,'BALANCE')
  return {sources:12,requests:24,balancedOrder:{AB:ab,BA:ba},dispatchAuthorized:false}
}

export function assertD9DispatchAuthorized(){throw Error('D9_DISPATCH_NOT_AUTHORIZED_NEW_GRANT_REQUIRED')}

export function verifyD9Files(){
  const manifest=JSON.parse(readFileSync(root+'/MANIFEST.json','utf8'))
  for(const component of manifest.files)assert(fileHash(component.path)===component.sha256,'FILE_DRIFT_'+component.path)
  const prepared=JSON.parse(readFileSync(root+'/PREPARED_REQUEST_IDENTITIES.json','utf8'))
  return verifyD9Package(manifest,prepared)
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)console.log(JSON.stringify(verifyD9Files()))
