import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'

const root='docs/recognition-optimization/candidate17/d16-development'
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
export function verifyD16FrozenPackage(directory=root){
  const manifest=JSON.parse(readFileSync(resolve(directory,'MANIFEST.json'),'utf8'))
  for(const artifact of manifest.artifacts){
    const bytes=readFileSync(resolve(directory,artifact.path))
    if(sha(bytes)!==artifact.sha256)throw Error('D16_ARTIFACT_DRIFT:'+artifact.path)
  }
  for(const component of manifest.components)if(sha(readFileSync(resolve(component.path)))!==component.sha256)throw Error('D16_COMPONENT_DRIFT:'+component.path)
  const prepared=JSON.parse(readFileSync(resolve(directory,'PREPARED_REQUEST_IDENTITIES.json'),'utf8'))
  if(manifest.dispatchAuthorized!==false||prepared.dispatchAuthorized!==false||prepared.requests.length!==24)throw Error('D16_PACKAGE_NOT_ZERO_CALL')
  const seen=new Set(),order={AB:0,BA:0}
  for(let i=0;i<12;i++){
    const pair=prepared.requests.slice(i*2,i*2+2)
    if(pair.length!==2||pair[0].sourceId!==pair[1].sourceId||new Set(pair.map(row=>row.arm)).size!==2)throw Error('D16_PAIR_DRIFT')
    order[pair.map(row=>row.arm).join('')]++
  }
  if(order.AB!==6||order.BA!==6)throw Error('D16_BALANCE_DRIFT')
  for(const [i,row] of prepared.requests.entries()){
    if(row.ordinal!==i+1||row.dispatchAuthorized!==false||row.status!=='NOT_RUN'||seen.has(row.unitIdentitySha256))throw Error('D16_IDENTITY_DRIFT')
    seen.add(row.unitIdentitySha256)
    if(sha(JSON.stringify(row.body))!==row.requestSha256)throw Error('D16_REQUEST_DRIFT')
    const {unitIdentitySha256,body,dispatchAuthorized,status,...identity}=row
    if(sha(JSON.stringify(identity))!==unitIdentitySha256)throw Error('D16_UNIT_IDENTITY_DRIFT')
    if(row.body.model!=='deepseek-flash'||row.body.max_output_tokens!==8192||/\bexpected\b/i.test(JSON.stringify(row.body)))throw Error('D16_REQUEST_CONTRACT')
  }
  return {status:'ZERO_CALL_FROZEN',units:24,order,dispatchAuthorized:false}
}
// This preparation package has no grant path. A later, separately authorized
// executor must be built and bound to its own committed HEAD and grant.
export function assertD16DispatchAllowed(){throw Error('D16_DISPATCH_NOT_AUTHORIZED')}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){console.log(JSON.stringify(verifyD16FrozenPackage()))}
