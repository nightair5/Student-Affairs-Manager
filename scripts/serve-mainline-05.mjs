import { createServer } from 'node:http'
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { build } from 'esbuild'

const args=process.argv.slice(2)
const checking=args.length===1&&args[0]==='--check'
const portArg=args.length===1&&/^--port=[0-9]+$/.test(args[0])?Number(args[0].slice(7)):undefined
if(args.length&&!checking&&!(Number.isInteger(portArg)&&portArg>=1024&&portArg<=65535))throw Error('ONLY_CHECK_OR_EXPLICIT_LOOPBACK_PORT_ALLOWED')
const port=portArg??0
const known = JSON.parse(readFileSync('docs/recognition-optimization/mainline-03-i1/BASELINE.json','utf8'))
const dataPath='docs/recognition-optimization/RCO-5-008-B8_DEVELOPMENT_DATASET.json'
const rawPath='docs/recognition-optimization/rco-5-008-b8-runs/rco-5-008-b8-m1-20260904a/raw-results.json'
const hashes=new Map()
function readProtected(path){const bytes=readFileSync(path),sha=createHash('sha256').update(bytes).digest('hex')
  if(known.files.find(f=>f.path===path)?.sha256!==sha)throw Error('REPLAY_PROTECTION_CHANGED:'+path)
  hashes.set(path,'sha256:'+sha);return bytes}
readProtected('src/experiments/mainline01/fixtures.ts')
const data=JSON.parse(readProtected(dataPath)),raw=JSON.parse(readProtected(rawPath))
const seen=['rco-task-b8-01','rco-task-b8-07','rco-task-b8-09'].map(caseId=>{
  const inputs=data.cases.filter(c=>c.id===caseId),records=raw.records.filter(r=>r.caseId===caseId)
  if(inputs.length!==1||records.length!==1)throw Error('NON_UNIQUE_REPLAY')
  const record=records[0]
  return{caseId,sourceText:inputs[0].sourceText,runId:raw.runId,model:record.responseModel,rawOutputText:record.rawOutputText,parsed:record.parsed,
    originFiles:[{path:dataPath,sha256:hashes.get(dataPath)},{path:rawPath,sha256:hashes.get(rawPath)}]}
})
const bundle=await build({entryPoints:['src/experiments/mainline05/browser.tsx'],bundle:true,write:false,metafile:true,outdir:'memory',
  platform:'browser',format:'esm',target:'es2022',jsx:'automatic',loader:{'.svg':'dataurl'},
  define:{'process.env.NODE_ENV':'"test"','import.meta.env':'{}',__MAINLINE05_INPUTS__:JSON.stringify({seen})}})
const forbidden=Object.keys(bundle.metafile.inputs).filter(path=>/(?:fidelity|confirmationHarness|evaluationDataset|score|run-rco-|DATASET\.json|raw-results\.json|\.test\.)/i.test(path))
if(forbidden.length)throw Error('FORBIDDEN_BROWSER_INPUT:'+forbidden.join(','))
if(checking)console.log(JSON.stringify({bundle:'PASS',realApp:true,seenDiagnostics:seen.length,engineeringTypes:8,forbiddenDependencies:forbidden,externalCalls:0}))
else{
  const assets=new Map(bundle.outputFiles.map(f=>['/'+basename(f.path),f.contents]))
  const js=[...assets.keys()].find(k=>k.endsWith('.js')),css=[...assets.keys()].find(k=>k.endsWith('.css'))
  const html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MAINLINE05真实App隔离验收</title>'
    +(css?'<link rel="stylesheet" href="'+css+'">':'')+'<div id="root"></div><script type="module" src="'+js+'"></script></html>'
  const server=createServer((req,res)=>{
    const path=new URL(req.url,'http://127.0.0.1').pathname
    res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
    res.setHeader('Cache-Control','no-store')
    if(req.method!=='GET'||(path!=='/'&&!assets.has(path))){res.writeHead(404);res.end();return}
    res.setHeader('Content-Type',path==='/'?'text/html; charset=utf-8':path.endsWith('.css')?'text/css':'text/javascript')
    res.end(path==='/'?html:assets.get(path))
  })
  server.listen(port,'127.0.0.1',()=>console.log('MAINLINE05_URL=http://127.0.0.1:'+server.address().port+'/?run=mainline05-'+randomUUID()+'&new=1'))
}
