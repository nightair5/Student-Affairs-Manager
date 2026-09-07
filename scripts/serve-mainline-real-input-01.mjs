import { createServer } from 'node:http'
import { randomBytes, randomUUID, createHash } from 'node:crypto'
import { readFileSync, readdirSync, realpathSync } from 'node:fs'
import { basename, dirname, resolve, relative, sep } from 'node:path'
import { gzipSync } from 'node:zlib'
import { build } from 'esbuild'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const check = (condition, code) => { if (!condition) throw Error('REAL_INPUT_LAUNCHER_' + code) }

/** Only the authorized immutable historical record, never an arbitrary disk path. */
export function loadRecordedA02() {
  const root='docs/recognition-optimization/mainline-real-input-01/runs/'
  const bound=(path,sha)=>{const bytes=readFileSync(path);check(hash(bytes)===sha,'RECORDED_FILE_CHANGED');return JSON.parse(bytes)}
  const state=bound(root+'usage-resume-20260907a/STATE.json','d478c58f7f44e68a852bc7712c5d3e7994f2390750f5915d65204963dff9e73b')
  bound(root+'usage-resume-20260907a/REQUEST_MANIFEST.json','7ed6c3c2054e0d101328f882e0efc5e4415d0db8d3cc1f2bc98157ce324d9a9c')
  const raw=bound(root+'recovery-a02-20260907a/RAW_RESULTS.jsonl','ef8c5d999cd6c762b6cf44736c195dced0719127420f4b2ca9fa7b7c0c922f31')
  const prep=bound(state.preparation.path,state.preparation.sha256), unit=state.units.find(u=>u.unitId==='A02'),record=prep.preparations.find(p=>p.unitId==='A02')
  check(record&&unit&&raw.unitId==='A02'&&raw.httpStatus===200&&raw.requestSha===unit.requestSha
    &&raw.inputSha===unit.inputSha&&raw.candidateSha===unit.candidateSha&&hash(raw.rawHttpText)===raw.responseSha
    &&record.requestText===state.requests.A02&&hash(record.requestText)===unit.requestSha
    &&prep.origin==='http://127.0.0.1:6631','RECORDED_BINDING')
  return {version:'recorded-a02-1',name:prep.name,handle:record.handle,context:record.context,
    requestSha:unit.requestSha,responseSha:raw.responseSha,rawHttpText:raw.rawHttpText}
}

/** Fixed loopback assets only. No root/static directory serving, secret lookup,
 * upstream fetch, fallback recognizer or installation occurs in this launcher. */
export async function createLocalApp({port,carrierManifest,checking=false,recordedA02=false}) {
  check(Number.isSafeInteger(port)&&port>=1024&&port<=65535,'EXPLICIT_PORT')
  const origin='http://127.0.0.1:'+port, capability=randomBytes(32).toString('hex')
  check(!recordedA02||port===6631,'RECORDED_ORIGIN')
  const recorded=recordedA02?loadRecordedA02():null
  const mode=recorded?'recorded_a02':'seen_engineering_replay'
  const manifestPath=realpathSync(carrierManifest), manifest=JSON.parse(readFileSync(manifestPath,'utf8'))
  check(manifest.version==='real-input-engineering-carriers-1'&&manifest.records?.length===8,'CARRIERS')
  check(manifest.fixturePath==='src/experiments/mainline01/fixtures.ts'
    &&manifest.fixtureSha==='e2d7b1c2b71c462b72f1efb9168ca57be375de3a3c0a71ce5f77e96383fa76dc'
    &&hash(readFileSync(manifest.fixturePath))===manifest.fixtureSha,'OLD_SOURCE_CHANGED')
  const assets=new Map(), assetIdentities=[]
  const asset=(url,path,mime,compress=false)=>{
    const original=readFileSync(path),bytes=compress?gzipSync(original):original
    check(!assets.has(url),'DUPLICATE_ASSET');assets.set(url,{bytes,mime})
    assetIdentities.push({url,path,sha256:hash(original),servedSha256:hash(bytes)})
  }
  const replayBundle=await build({stdin:{contents:"export {seenWire,cases,notices} from './src/experiments/realInput01/seenInputs.ts'; export {buildModelRequest} from './src/experiments/realInput01/modelWire.ts'",resolveDir:process.cwd(),loader:'ts'},
    bundle:true,write:false,platform:'node',format:'esm',target:'node24'})
  const replay=await import('data:text/javascript;base64,'+Buffer.from(replayBundle.outputFiles[0].contents).toString('base64'))
  const carriers=manifest.records.map((item,i)=>{
    const path=realpathSync(item.path),rel=relative(dirname(manifestPath),path)
    check(rel&&!rel.startsWith('..'+sep)&&!rel.includes('..')&&dirname(path)===dirname(manifestPath),'CARRIER_PATH')
    check(item.unitId==='B0'+(i+1)&&item.caseName===replay.cases[i]&&item.sourceText===replay.notices[item.caseName]
      &&item.sourceSha256===hash(item.sourceText)&&item.fileName===basename(path)&&hash(readFileSync(path))===item.sha256,'CARRIER_IDENTITY')
    const url='/engineering-carriers/'+item.fileName;asset(url,path,item.mime)
    return {unitId:item.unitId,name:item.fileName,mime:item.mime,sha256:item.sha256,url,sourceText:item.sourceText}
  })
  asset('/real-input-assets/worker.min.js','node_modules/tesseract.js/dist/worker.min.js','text/javascript')
  for(const file of readdirSync('node_modules/tesseract.js-core').filter(file=>/^tesseract-core[-a-z.]*\.(?:js|wasm)$/.test(file)))
    asset('/real-input-assets/core/'+file,'node_modules/tesseract.js-core/'+file,file.endsWith('.wasm')?'application/wasm':'text/javascript')
  for(const language of ['chi_sim','eng'])asset('/real-input-assets/lang/'+language+'.traineddata.gz',language+'.traineddata','application/gzip',true)
  asset('/real-input-assets/pdf.worker.min.mjs','node_modules/pdfjs-dist/build/pdf.worker.min.mjs','text/javascript')
  const resources={workerPath:origin+'/real-input-assets/worker.min.js',corePath:origin+'/real-input-assets/core',
    langPath:origin+'/real-input-assets/lang',pdfWorkerPath:origin+'/real-input-assets/pdf.worker.min.mjs'}
  const bundle=await build({entryPoints:['src/experiments/realInput01/browser.tsx'],bundle:true,write:false,metafile:true,outdir:'memory',
    platform:'browser',format:'esm',target:'es2022',jsx:'automatic',loader:{'.svg':'dataurl'},
    define:{'process.env.NODE_ENV':'"test"','import.meta.env':'{}',__REAL_INPUT_CONFIG__:JSON.stringify({mode,capability,resources,carriers:recorded?[]:carriers,units:[],
      ...(recorded?{recorded:{name:recorded.name,requestSha:recorded.requestSha,responseSha:recorded.responseSha}}:{})})}})
  const parsedReferenceModules=Object.keys(bundle.metafile.inputs).filter(path=>/(?:seenInputs|engineeringReplay|fixtures\.ts|fidelity|evaluation\.ts|\.test\.|DATASET|raw-results)/i.test(path))
  const browserJs=bundle.outputFiles.find(file=>file.path.endsWith('.js')).text
  // esbuild visits the legacy handoff module, then tree-shakes its fixture import.
  // Its section may retain only shared define initializers, not fixture code.
  // Inspect the emitted section: any remaining statement is a hard failure.
  const forbidden=parsedReferenceModules.filter(path=>{
    const marker='// '+path+'\n',start=browserJs.indexOf(marker)
    if(start<0)return Object.values(bundle.metafile.outputs).some(out=>(out.inputs[path]?.bytesInOutput??0)>0)
    const next=browserJs.indexOf('\n// ',start+marker.length)
    const section=browserJs.slice(start+marker.length,next<0?undefined:next)
    return section.replace(/^init_define_(?:REAL_INPUT_CONFIG|import_meta_env)\(\);\s*/gm,'').trim().length>0
  })
  check(forbidden.length===0,'BROWSER_ANSWER_DEPENDENCY:'+forbidden.join(','))
  for(const file of bundle.outputFiles){let bytes=Buffer.from(file.contents)
    // The read-only global stylesheet has a web font import. This isolated asset
    // uses system fonts; no rewrite of the repository's stylesheet is performed.
    if(file.path.endsWith('.css'))bytes=Buffer.from(bytes.toString().replace(/@import\s+url\("https:\/\/fonts\.googleapis\.com[^;]+;\s*/g,''))
    assets.set('/'+basename(file.path),{bytes,mime:file.path.endsWith('.css')?'text/css':'text/javascript'})}
  const html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MAINLINE REAL INPUT 真实App隔离验收</title>'
    +'<link rel="stylesheet" href="/browser.css"><div id="root"></div><script type="module" src="/browser.js"></script></html>'
  const body=async req=>{let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;check(size<=262144,'LOCAL_BODY_LIMIT');chunks.push(chunk)}return Buffer.concat(chunks).toString('utf8')}
  const server=createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff')
    res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
    try {
      check(req.headers.host==='127.0.0.1:'+port,'HOST')
      check(typeof req.url==='string'&&req.url.startsWith('/')&&!req.url.includes('\\')&&!req.url.includes('%'),'URL')
      const url=new URL(req.url,origin),path=url.pathname
      if(req.method==='GET'&&(path==='/'||assets.has(path))){
        check(!req.headers.origin||req.headers.origin===origin,'ASSET_ORIGIN')
        check(!req.headers['sec-fetch-site']||['same-origin','none'].includes(req.headers['sec-fetch-site']),'ASSET_FETCH_SITE')
        res.setHeader('Content-Type',path==='/'?'text/html; charset=utf-8':assets.get(path).mime)
        res.end(path==='/'?html:assets.get(path).bytes);return
      }
      check(req.method==='POST'&&path===(recorded?'/api/real-input/recorded-a02':'/api/real-input/replay')&&!url.search,'LOCAL_ENDPOINT')
      check(req.headers.origin===origin&&req.headers['sec-fetch-site']==='same-origin'
        &&req.headers['x-real-input-capability']===capability&&req.headers['content-type']==='application/json','LOCAL_AUTH')
      const context=JSON.parse(await body(req))
      if(recorded){
        check(Object.keys(context).sort().join(',')==='requestSha,unitId'&&context.unitId==='A02'&&context.requestSha===recorded.requestSha,'RECORDED_REQUEST')
        res.setHeader('Content-Type','application/json');res.end(JSON.stringify(recorded));return
      }
      await replay.buildModelRequest(context)
      const kind=replay.cases.find(kind=>replay.notices[kind]===context.index.sourceContent)
      check(kind,'NOT_SEEN_ENGINEERING_TEXT')
      const result=await replay.seenWire(kind,{sourceId:context.index.sourceId,sourceVersionId:context.index.sourceVersionId})
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify({label:'seen_engineering_replay',rawHttpText:result.rawHttpText}))
    } catch { res.writeHead(400);res.end(JSON.stringify({error:'REAL_INPUT_LOCAL_REQUEST_REJECTED'})) }
  })
  const evidence={mode,realApp:true,upstreamEnabled:false,carriers:recorded?0:carriers.length,forbiddenBrowserInputs:forbidden,
    parsedReferenceModules,bundleInputs:Object.keys(bundle.metafile.inputs),bundleSha256:hash(bundle.outputFiles.find(f=>f.path.endsWith('.js')).contents),assetIdentities}
  if(checking)return {evidence,server}
  await new Promise((yes,no)=>{server.once('error',no);server.listen(port,'127.0.0.1',yes)})
  return {server,evidence,url:recorded?origin+'/?run='+recorded.name.slice('rco-mainline-01-02-i1-'.length):origin+'/?run=real-input-'+randomUUID()+'&new=1'}
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
  const args=process.argv.slice(2),pick=key=>args.find(arg=>arg.startsWith('--'+key+'='))?.slice(key.length+3)
  check(args.every(a=>a==='--check'||a==='--recorded-a02'||/^--(?:port|carriers)=/.test(a))&&new Set(args.map(a=>a.split('=')[0])).size===args.length,'ARGS')
  const result=await createLocalApp({port:Number(pick('port')),carrierManifest:pick('carriers'),checking:args.includes('--check'),recordedA02:args.includes('--recorded-a02')})
  console.log(JSON.stringify(args.includes('--check')?result.evidence:{url:result.url,mode:result.evidence.mode,upstreamEnabled:false}))
}
