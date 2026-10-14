import {build} from 'esbuild'
import {createServer} from 'node:http'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {resolve,basename} from 'node:path'
import {pathToFileURL} from 'node:url'
import {buildD13Records,digest} from './candidate16-d13-records.mjs'
import {d8Handler} from './serve-candidate15-d8.mjs'

export async function buildD13Preview(port='6646'){
  if(!/^\d{4,5}$/.test(port)||Number(port)<6643||Number(port)>65535)throw Error('D13_NEW_LOOPBACK_PORT_REQUIRED')
  const directory=resolve('.data/candidate16/d13-preview'),origin='http://127.0.0.1:'+port,database='rco-mainline-01-02-i1-real-input-candidate16-d13-engineering-2'
  mkdirSync(resolve(directory,'records'),{recursive:true})
  const records=(await buildD13Records()).map(r=>{const text=JSON.stringify(r);writeFileSync(resolve(directory,'records',r.id+'.json'),text);return {id:r.id,label:r.label,kind:r.kind,sha256:digest(text)}})
  const config={origin,database,records},output=await build({absWorkingDir:process.cwd(),entryPoints:['src/experiments/candidate16/browser.tsx'],bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic',target:'es2022',outdir:'memory',minify:true,define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}',__D13_CONFIG__:JSON.stringify(config)}})
  for(const file of output.outputFiles){const text=file.text.replace(/@import\s+url\("https:\/\/fonts\.googleapis\.com[^;]+;\s*/g,'');writeFileSync(resolve(directory,basename(file.path)),text)}
  writeFileSync(resolve(directory,'index.html'),'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>D13工程回放 / 非真人试用</title><link rel="stylesheet" href="/browser.css"></head><body><div id="root">正在打开独立工程回放…</div><script type="module" src="/browser.js"></script></body></html>')
  const paths=['index.html','browser.js','browser.css',...records.map(r=>'records/'+r.id+'.json')]
  const manifest={version:'candidate16-d13-local-replay-1',origin,database,directory,records,modelCallsEnabled:false,humanTrial:false,assets:paths.map(path=>({path,sha256:digest(readFileSync(resolve(directory,path)))}))}
  writeFileSync(resolve(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');return manifest
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const port=process.argv[2]??'6646',manifest=await buildD13Preview(port),server=createServer(d8Handler(manifest));server.once('error',e=>{console.error(e.code==='EADDRINUSE'?'D13_PORT_BUSY_NO_PROCESS_KILLED':e.message);process.exitCode=1});server.listen(Number(port),'127.0.0.1',()=>console.log(JSON.stringify({origin:manifest.origin,database:manifest.database,records:manifest.records.length,modelCalls:false})))}
