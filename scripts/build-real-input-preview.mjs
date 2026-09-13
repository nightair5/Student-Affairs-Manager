import {build} from 'esbuild'
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync} from 'node:fs'
import {resolve,join,basename} from 'node:path'
import {tmpdir} from 'node:os'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {createServer} from 'node:http'
import previewWorker from '../cloudflare/real-input-preview.mjs'

const hash=x=>createHash('sha256').update(x).digest('hex')
const check=(ok,code)=>{if(!ok)throw Error('HTTPS_PREVIEW_'+code)}
const sourceRoot=resolve(fileURLToPath(new URL('..',import.meta.url)))
const D='docs/recognition-optimization/mainline-real-input-01/runs/candidate06-20260912a/'
const pinned={
  'BINDING.json':'301c71c90c23b743d1ff01ab83d914e3da4affcb3df06bb090c7602d05ba0dbf',
  'Q01-06_RAW.jsonl':'0f706be67f80039db7c038ffc46641af5dee6e7bf37155b432e56fd3b0b71bfc',
  'Q07-06_RAW.jsonl':'ea18f7c430016e95331fd00f8542ed46ad576d32282ebdadc8c08963f746a72c',
}
const historicalName='rco-mainline-01-02-i1-real-input-d030c507-3f7c-4a2c-a511-8cd5bd534862'
const R='docs/recognition-optimization/mainline-real-input-01/runs/candidate07-20260913a/'
const pinned07={
  'BINDING_FINAL.json':'7d49dede6304e25e186e96dcee787ad2f477eaf25ac45a1fb1161fea5ec0aab7',
  'R11-07_RAW.jsonl':'b96eb4fdff1be4137955510609683b4fc5746f175aaddf83147c970bdd30a3ba',
  'R12-07_RAW.jsonl':'9b2af233504c7684be20e56c344b23714be51465f622bc7049dfbbfabfb4a801',
}
export async function buildPreview(origin='https://student-affairs-real-input-preview.nightsdell.workers.dev', {localOnly=false}={}){
  check(localOnly ? origin==='http://127.0.0.1:6632' : origin==='https://student-affairs-real-input-preview.nightsdell.workers.dev','ORIGIN')
  const read=n=>{const b=readFileSync(join(sourceRoot,D,n));check(hash(b)===pinned[n],'HISTORY_CHANGED');return JSON.parse(b)}
  const binding=read('BINDING.json')
  const records=['Q01-06','Q07-06'].map(unitId=>{
    const raw=read(unitId+'_RAW.jsonl'),item=binding.items.find(i=>i.id===unitId.slice(0,3)),unit=binding.units.find(u=>u.unitId===unitId)
    check(item&&unit&&raw.httpStatus===200&&raw.requestSha===unit.requestSha&&raw.inputSha===unit.inputSha
      &&raw.candidateSha===unit.candidateSha&&hash(raw.rawHttpText)===raw.responseSha,'RAW_BINDING')
    return {version:'recorded-paired06-1',unitId,name:historicalName,operationId:item.operationId,title:item.title,
      context:item.context,requestSha:raw.requestSha,responseSha:raw.responseSha,rawHttpText:raw.rawHttpText}
  })
  const read07=n=>{const b=readFileSync(join(sourceRoot,R,n));check(hash(b)===pinned07[n],'PAIRED07_HISTORY_CHANGED');return JSON.parse(b)}
  const binding07=read07('BINDING_FINAL.json')
  for(const unitId of ['R11-07','R12-07']){
    const raw=read07(unitId+'_RAW.jsonl'),item=binding07.items.find(i=>i.id===unitId.slice(0,3)),unit=binding07.units.find(u=>u.unitId===unitId)
    check(item&&unit&&raw.httpStatus===200&&raw.requestSha===unit.requestSha&&raw.inputSha===unit.inputSha
      &&raw.candidateSha===unit.candidateSha&&hash(raw.rawHttpText)===raw.responseSha,'PAIRED07_RAW_BINDING')
    records.push({version:'recorded-paired07-1',unitId,name:historicalName,operationId:item.operationId,title:item.title,
      context:item.context,requestSha:raw.requestSha,responseSha:raw.responseSha,rawHttpText:raw.rawHttpText})
  }
  // Deliberately omit receipts, billing, Expected and absolute source paths from public assets.
  const config={mode:'recorded_batch',httpsPreview:{origin,...(localOnly?{localOnly:true}:{})},capability:'',units:[],carriers:[],
    resources:{workerPath:'',corePath:'',langPath:'',pdfWorkerPath:''},
    batch:records.map(({unitId,requestSha,responseSha})=>({unitId,requestSha,responseSha}))}
  const directory=mkdtempSync(join(tmpdir(),'real-input-https-')),assets=join(directory,'assets');mkdirSync(assets)
  const bundled=await build({absWorkingDir:sourceRoot,entryPoints:['src/experiments/realInput01/browser.tsx'],bundle:true,write:false,
    format:'esm',platform:'browser',jsx:'automatic',target:'es2022',outdir:'memory',metafile:true,
    define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}',__REAL_INPUT_CONFIG__:JSON.stringify(config)}})
  const forbidden=Object.entries(bundled.metafile.outputs).flatMap(([,output])=>Object.entries(output.inputs)
    .filter(([path,v])=>/(seenInputs|engineeringReplay|fixtures\.ts|fidelity|evaluation\.ts|\.test\.|DATASET|_RAW|BINDING\.json)/i.test(path)&&v.bytesInOutput>0).map(([p])=>p))
  // esbuild may emit only shared define initializers for a tree-shaken module.
  const js=bundled.outputFiles.find(f=>f.path.endsWith('.js')).text
  for(const path of new Set(forbidden)){
    const start=js.indexOf('// '+path+'\n'),end=js.indexOf('\n// ',start+4)
    check(start>=0&&!js.slice(start+path.length+4,end<0?undefined:end).replace(/^init_define_(?:REAL_INPUT_CONFIG|import_meta_env)\(\);\s*/gm,'').trim(),'ANSWER_IN_BUNDLE')
  }
  for(const file of bundled.outputFiles){
    let text=file.text
    if(file.path.endsWith('.css'))text=text.replace(/@import\s+url\("https:\/\/fonts\.googleapis\.com[^;]+;\s*/g,'')
    check(!/\bsk-[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|C:\\\\Users\\\\Winner/i.test(text),'PRIVATE_ASSET')
    writeFileSync(join(assets,basename(file.path)),text)
  }
  mkdirSync(join(assets,'recorded'))
  for(const record of records)writeFileSync(join(assets,'recorded',record.unitId+'.json'),JSON.stringify(record))
  writeFileSync(join(assets,'index.html'),'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>学生事务管家 · HTTPS隔离实验版</title><link rel="stylesheet" href="/browser.css"></head><body><div id="root"></div><script type="module" src="/browser.js"></script></body></html>')
  const deployment=JSON.parse(readFileSync(join(sourceRoot,'wrangler.real-input-preview.jsonc'),'utf8'))
  check(deployment.name==='student-affairs-real-input-preview'&&deployment.routes.length===0&&!deployment.vars&&!deployment.services,'DEPLOYMENT_SCOPE')
  deployment.main=join(sourceRoot,'cloudflare/real-input-preview.mjs');deployment.assets.directory=assets;delete deployment.$schema
  // A local artifact cannot accidentally be passed to Wrangler for deployment.
  const configuration=localOnly?null:join(directory,'wrangler.json');if(configuration)writeFileSync(configuration,JSON.stringify(deployment,null,2))
  const paths=['index.html','browser.js','browser.css',...records.map(r=>'recorded/'+r.unitId+'.json')]
  const manifest={origin,directory,configuration,...(localOnly?{localOnly:true}:{}),modelCallsEnabled:false,rootEnvRead:false,
    assets:paths.map(path=>({path,sha256:hash(readFileSync(join(assets,path))),bytes:readFileSync(join(assets,path)).length})),
    sourceFiles:['src/experiments/realInput01/browser.tsx','src/experiments/realInput01/runtime.ts','scripts/build-real-input-preview.mjs',
      'cloudflare/real-input-preview.mjs','wrangler.real-input-preview.jsonc'].map(path=>({path,sha256:hash(readFileSync(join(sourceRoot,path)))}))}
  writeFileSync(join(directory,'manifest.json'),JSON.stringify(manifest,null,2))
  return manifest
}
export async function startLocalPreview(){
  const origin='http://127.0.0.1:6632'
  const manifest=await buildPreview(origin,{localOnly:true})
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'}
  const assets=new Map(manifest.assets.map(item=>['/'+item.path,readFileSync(join(manifest.directory,'assets',item.path))]))
  const env={ASSETS:{fetch:async request=>{
    const path=new URL(request.url).pathname,bytes=assets.get(path)
    return new Response(request.method==='HEAD'?null:bytes,{status:bytes?200:404,headers:{'Content-Type':types[path.slice(path.lastIndexOf('.'))]??'application/octet-stream'}})
  }}}
  const server=createServer(async(req,res)=>{
    try{
      if(req.headers.host!=='127.0.0.1:6632'||(req.headers.origin&&req.headers.origin!==origin)
        ||(req.headers['sec-fetch-site']&&!['none','same-origin'].includes(req.headers['sec-fetch-site']))){res.writeHead(403);res.end('LOCAL_ORIGIN_REJECTED');return}
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end('MODEL_AND_WRITES_DISABLED');return}
      if(!req.url?.startsWith('/')||req.url.startsWith('//')||/[\\%]/.test(req.url)){res.writeHead(404);res.end('NOT_AVAILABLE');return}
      const response=await previewWorker.fetch(new Request(origin+req.url,{method:req.method}),env)
      res.writeHead(response.status,Object.fromEntries(response.headers))
      res.end(Buffer.from(await response.arrayBuffer()))
    }catch{res.writeHead(500);res.end('LOCAL_PREVIEW_FAILED')}
  })
  await new Promise((yes,no)=>{server.once('error',no);server.listen(6632,'127.0.0.1',yes)})
  return {server,manifest}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2)
  check(args.length===0||(args.length===1&&args[0]==='--local'),'ARGS')
  console.log(JSON.stringify(args[0]==='--local'?(await startLocalPreview()).manifest:await buildPreview()))
}
