import {build} from 'esbuild'
import {createServer} from 'node:http'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {resolve,basename} from 'node:path'
import {pathToFileURL} from 'node:url'
import {HISTORY_DIRECTORY,verifyCandidate11History,sha256} from './verify-candidate11-analysis.mjs'

export async function buildCandidate11Preview(origin='http://127.0.0.1:6633') {
  const url=new URL(origin)
  if(url.hostname!=='127.0.0.1'||url.protocol!=='http:'||!/^\d{4,5}$/.test(url.port)||['6631','6632'].includes(url.port)||url.origin!==origin)throw Error('C11_PREVIEW_ORIGIN')
  await verifyCandidate11History()
  const root=process.cwd(),directory=resolve('.data/candidate11/preview'),records=[]
  mkdirSync(directory,{recursive:true});mkdirSync(resolve(directory,'records'),{recursive:true})
  const bundle=await build({stdin:{contents:"export {seenWire,cases,notices} from './src/experiments/realInput01/seenInputs.ts'",resolveDir:root,loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',logLevel:'silent'})
  const api=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].contents).toString('base64'))
  const labels={multi:'工程夹具：两个任务与材料', 'no-date':'工程夹具：原文无日期',vague:'工程夹具：日期待通知',information:'工程夹具：纯资讯',
    'condition-true':'工程夹具：条件成立','condition-false':'工程夹具：条件不成立','condition-unknown':'工程夹具：条件未知',revision:'工程夹具：取消与替代'}
  for(const name of api.cases){
    const fixture=await api.seenWire(name,{sourceId:'c11-fixture-'+name,sourceVersionId:'c11-fixture-'+name+':1'})
    const {index,referenceTime,timezone}=fixture.original.context
    records.push({id:'fixture-'+name,label:labels[name],kind:'ENGINEERING_REPLAY',candidateVersion:null,context:{index,referenceTime,timezone},
      rawHttpText:fixture.rawHttpText,responseSha:sha256(fixture.rawHttpText),requestSha:null})
  }
  const binding=JSON.parse(readFileSync(HISTORY_DIRECTORY+'/BINDING_FINAL.json'))
  for(const item of binding.items){
    const id=item.id+'-A',raw=JSON.parse(readFileSync(HISTORY_DIRECTORY+'/'+id+'_RAW.jsonl'))
    records.push({id:'history-'+id,label:'历史 candidate03：'+item.sourceId,kind:'HISTORICAL_MODEL',candidateVersion:'real-input-source-semantics-3',
      context:item.context,rawHttpText:raw.rawHttpText,responseSha:raw.responseSha,requestSha:raw.requestSha})
  }
  const roster=records.map(record=>{
    const text=JSON.stringify(record);writeFileSync(resolve(directory,'records',record.id+'.json'),text)
    return {id:record.id,label:record.label,kind:record.kind,sha256:sha256(text)}
  })
  const config={origin,records:roster},output=await build({absWorkingDir:root,entryPoints:['src/experiments/candidate11/browser.tsx'],bundle:true,write:false,
    format:'esm',platform:'browser',jsx:'automatic',target:'es2022',outdir:'memory',minify:true,metafile:true,
    define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}',__C11_CONFIG__:JSON.stringify(config)}})
  for(const file of output.outputFiles){
    let text=file.text
    if(file.path.endsWith('.css'))text=text.replace(/@import\s+url\("https:\/\/fonts\.googleapis\.com[^;]+;\s*/g,'')
    if(/-----BEGIN [A-Z ]*PRIVATE KEY-----|\bsk-[A-Za-z0-9_-]{20,}/.test(text))throw Error('C11_PRIVATE_ASSET')
    writeFileSync(resolve(directory,basename(file.path)),text)
  }
  writeFileSync(resolve(directory,'index.html'),'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>C11 · 学生事务管家独立工程入口</title><link rel="stylesheet" href="/browser.css"></head><body><div id="root"><p>正在加载本机独立工程入口…</p></div><script type="module" src="/browser.js"></script></body></html>')
  const paths=['index.html','browser.js','browser.css',...roster.map(r=>'records/'+r.id+'.json')]
  const manifest={version:'c11-local-preview-1',origin,database:'rco-mainline-01-02-i1-real-input-candidate11-engineering-1',directory,
    modelCallsEnabled:false,rootEnvRead:false,deployConfiguration:null,defaultComparisonBaseline:'candidate03',candidate11ModelQuality:'NOT_RUN',
    records:roster,assets:paths.map(path=>({path,sha256:sha256(readFileSync(resolve(directory,path)))}))}
  writeFileSync(resolve(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n')
  return manifest
}
export function candidate11Handler(manifest) {
  const assets=new Map(manifest.assets.map(item=>['/'+item.path,readFileSync(resolve(manifest.directory,item.path))]))
  const host=new URL(manifest.origin).host
  return (req,res)=>{
    const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
      'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"}
    if(req.headers.host!==host||(req.headers.origin&&req.headers.origin!==manifest.origin)||(req.headers['sec-fetch-site']&&!['none','same-origin'].includes(req.headers['sec-fetch-site']))){res.writeHead(403,headers);res.end('C11_ORIGIN_REJECTED');return}
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,headers);res.end('C11_MODEL_AND_SERVER_WRITES_DISABLED');return}
    const path=req.url==='/'||req.url==='/?automation=1'?'/index.html':req.url
    const bytes=assets.get(path)
    if(!bytes){res.writeHead(404,headers);res.end('C11_NOT_AVAILABLE');return}
    res.writeHead(200,{...headers,'Content-Type':path.endsWith('.html')?'text/html; charset=utf-8':path.endsWith('.js')?'text/javascript; charset=utf-8':path.endsWith('.css')?'text/css; charset=utf-8':'application/json; charset=utf-8'})
    res.end(req.method==='HEAD'?undefined:bytes)
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const arg=process.argv[2]??'6633'
  if(!/^\d{4,5}$/.test(arg)||Number(arg)>65535)throw Error('C11_PORT')
  const manifest=await buildCandidate11Preview('http://127.0.0.1:'+arg),server=createServer(candidate11Handler(manifest))
  server.once('error',error=>{console.error(error.code==='EADDRINUSE'?'C11_PORT_BUSY_NO_PROCESS_KILLED':'C11_SERVER_FAILED');process.exitCode=1})
  server.listen(Number(arg),'127.0.0.1',()=>console.log(JSON.stringify({url:manifest.origin,database:manifest.database,records:manifest.records.length,modelCallsEnabled:false})))
}
