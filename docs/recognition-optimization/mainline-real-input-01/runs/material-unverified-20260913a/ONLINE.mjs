// Public static HTTP verification only; never browser/database acceptance.
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
const manifest=JSON.parse(readFileSync(process.argv[2],'utf8'))
const hash=x=>createHash('sha256').update(x).digest('hex')
const request=path=>fetch(manifest.origin+'/'+path,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(20000)})
const assets=await Promise.all(manifest.assets.map(async a=>{
  const r=await request(a.path),sha256=hash(Buffer.from(await r.arrayBuffer()))
  return {path:a.path,status:r.status,sha256,match:r.ok&&sha256===a.sha256}
}))
const status=await (await request('api/status')).json()
const forbidden=await fetch(manifest.origin+'/api/recognize',{method:'POST',signal:AbortSignal.timeout(20000)})
const result={kind:'HTTP_NOT_BROWSER_ACCEPTANCE',assets,status,modelEndpointPostStatus:forbidden.status,
  passed:assets.every(a=>a.match)&&status.modelCallsEnabled===false&&forbidden.status===405}
console.log(JSON.stringify(result))
if(!result.passed)process.exitCode=1
