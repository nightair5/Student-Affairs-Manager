import {build} from 'esbuild'
import {createServer} from 'node:http'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {resolve,basename} from 'node:path'
import {pathToFileURL} from 'node:url'
import {buildD13Records,digest} from './candidate16-d13-records.mjs'
import {d8Handler} from './serve-candidate15-d8.mjs'

export async function buildD14Preview(port='6647'){
  if(!/^\d{4,5}$/.test(port)||Number(port)<6647||Number(port)>65535)throw Error('D14_NEW_LOOPBACK_PORT_REQUIRED')
  const directory=resolve('.data/candidate16/d14-preview'),origin='http://127.0.0.1:'+port,database='rco-mainline-01-02-i1-real-input-candidate16-d14-trial-1'
  mkdirSync(resolve(directory,'records'),{recursive:true})
  const originals=await buildD13Records(),manual=originals.filter(r=>r.kind==='ENGINEERING_FIXTURE').map(r=>{
    const envelope=JSON.parse(r.rawHttpText),wire=JSON.parse(envelope.output.at(-1).content[0].text)
    for(const field of ['tasks','materials','timePoints','events','revisions','conflicts'])wire[field]=[]
    wire.informationScopeIds=r.context.index.scopes.map(s=>s.id);wire.unresolvedScopeIds=[]
    envelope.output.at(-1).content[0].text=JSON.stringify(wire)
    const rawHttpText=JSON.stringify(envelope),id='d13-fixture-manual-'+r.id.slice('d13-fixture-'.length)
    return {...r,id,label:'空白手动 · '+r.label,rawHttpText,responseSha256:digest(rawHttpText),requestSha256:digest('MANUAL_NO_MODEL:'+id)}
  })
  const records=[...originals,...manual].map(r=>{const content=JSON.stringify(r);writeFileSync(resolve(directory,'records',r.id+'.json'),content);return {id:r.id,label:r.label,kind:r.kind,sha256:digest(content)}})
  const config={origin,database,records}
  const output=await build({absWorkingDir:process.cwd(),entryPoints:['src/experiments/candidate16/d14-browser.tsx'],bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic',target:'es2022',outdir:'memory',minify:true,define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}',__D14_CONFIG__:JSON.stringify(config)}})
  for(const file of output.outputFiles){const content=file.text.replace(/@import\s+url\("https:\/\/fonts\.googleapis\.com[^;]+;\s*/g,'');writeFileSync(resolve(directory,basename(file.path)),content)}
  writeFileSync(resolve(directory,'index.html'),'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>D14隔离试次 / 匿名工程回放</title><link rel="stylesheet" href="/d14-browser.css"></head><body><div id="root">正在打开 D14 隔离试次…</div><script type="module" src="/d14-browser.js"></script></body></html>')
  const paths=['index.html','d14-browser.js','d14-browser.css',...records.map(r=>'records/'+r.id+'.json')]
  const manifest={version:'candidate16-d14-local-trial-1',origin,database,directory,records,modelCallsEnabled:false,humanTrial:false,assets:paths.map(path=>({path,sha256:digest(readFileSync(resolve(directory,path)))}))}
  writeFileSync(resolve(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n')
  return manifest
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const port=process.argv[2]??'6647',manifest=await buildD14Preview(port),server=createServer(d8Handler(manifest));server.once('error',e=>{console.error(e.code==='EADDRINUSE'?'D14_PORT_BUSY_NO_PROCESS_KILLED':e.message);process.exitCode=1});server.listen(Number(port),'127.0.0.1',()=>console.log(JSON.stringify({origin:manifest.origin,database:manifest.database,records:manifest.records.length,modelCalls:false,humanTrial:false})))}
