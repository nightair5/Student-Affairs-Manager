import {build} from 'esbuild'
import {createServer} from 'node:http'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {resolve,basename} from 'node:path'
import {pathToFileURL} from 'node:url'
import {buildD13Records,digest} from './candidate16-d13-records.mjs'
import {d8Handler} from './serve-candidate15-d8.mjs'
import {d13Components} from './candidate16-d13-support.mjs'

// These synthetic stimuli never enter the D13 frozen Development comparison.
export async function buildD15Preview(port='6648',participant='p1'){
  if(!/^\d{4,5}$/.test(port)||Number(port)<6648||Number(port)>65535||!/^p[1-9][0-9]{0,2}$/.test(participant))throw Error('D15_ISOLATED_ORIGIN_REQUIRED')
  const directory=resolve('.data/candidate16/d15-preview-'+participant),origin='http://127.0.0.1:'+port
  const database='rco-mainline-01-02-i1-real-input-candidate16-d15-trial-'+participant
  mkdirSync(resolve(directory,'records'),{recursive:true})
  const originals=await buildD13Records(),base=originals.find(r=>r.id==='d13-fixture-vague-event')
  if(!base)throw Error('D15_BASE_FIXTURE_MISSING')
  const source='[D15匿名工程夹具]\n请复核项目成员资料，以页面显示资料复核完成为准。图书馆将在10月21日19:00至20:00举办检索讲座。校园服务台将在周三晚进行维护，结束时间另行通知。'
  const {indexImmutableScopesV11}=await d13Components(),index=await indexImmutableScopesV11('D15-MIXED','D15-MIXED-v1',source)
  const envelope=JSON.parse(base.rawHttpText),wire=JSON.parse(envelope.output.at(-1).content[0].text)
  for(const field of ['tasks','materials','timePoints','events','revisions','conflicts'])wire[field]=[]
  wire.informationScopeIds=index.scopes.map(s=>s.id);wire.unresolvedScopeIds=[]
  envelope.output.at(-1).content[0].text=JSON.stringify(wire)
  const rawHttpText=JSON.stringify(envelope),mixed={...base,id:'d13-fixture-d15-mixed',label:'匿名工程夹具：任务与两个独立事件',context:{...base.context,index},rawHttpText,responseSha256:digest(rawHttpText),requestSha256:digest('D15_ENGINEERING_FIXTURE_MIXED_NOT_SENT')}
  const manual=[...originals,mixed].filter(r=>r.kind==='ENGINEERING_FIXTURE').map(r=>{
    const copy=JSON.parse(r.rawHttpText),blank=JSON.parse(copy.output.at(-1).content[0].text)
    for(const field of ['tasks','materials','timePoints','events','revisions','conflicts'])blank[field]=[]
    blank.informationScopeIds=r.context.index.scopes.map(s=>s.id);blank.unresolvedScopeIds=[]
    copy.output.at(-1).content[0].text=JSON.stringify(blank)
    const text=JSON.stringify(copy),id='d13-fixture-manual-'+r.id.slice('d13-fixture-'.length)
    return {...r,id,label:'空白手动 · '+r.label,rawHttpText:text,responseSha256:digest(text),requestSha256:digest('MANUAL_NO_MODEL:'+id)}
  })
  const records=[...originals,mixed,...manual].map(r=>{const content=JSON.stringify(r);writeFileSync(resolve(directory,'records',r.id+'.json'),content);return {id:r.id,label:r.label,kind:r.kind,sha256:digest(content)}})
  const config={origin,database,records}
  const output=await build({absWorkingDir:process.cwd(),entryPoints:['src/experiments/candidate16/d14-browser.tsx'],bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic',target:'es2022',outdir:'memory',minify:true,define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}',__D14_CONFIG__:JSON.stringify(config)}})
  for(const file of output.outputFiles){const content=file.text.replace(/@import\s+url\("https:\/\/fonts\.googleapis\.com[^;]+;\s*/g,'');writeFileSync(resolve(directory,basename(file.path)),content)}
  writeFileSync(resolve(directory,'index.html'),'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>D15隔离试次 / 匿名工程回放</title><link rel="stylesheet" href="/d14-browser.css"></head><body><div id="root">正在打开 D15 隔离试次…</div><script type="module" src="/d14-browser.js"></script></body></html>')
  const paths=['index.html','d14-browser.js','d14-browser.css',...records.map(r=>'records/'+r.id+'.json')]
  const manifest={version:'candidate16-d15-local-trial-1',origin,database,participant,directory,records,modelCallsEnabled:false,humanTrial:false,assets:paths.map(path=>({path,sha256:digest(readFileSync(resolve(directory,path)))}))}
  writeFileSync(resolve(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n')
  return manifest
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const manifest=await buildD15Preview(process.argv[2]??'6648',process.argv[3]??'p1'),server=createServer(d8Handler(manifest));server.once('error',e=>{console.error(e.code==='EADDRINUSE'?'D15_PORT_BUSY_NO_PROCESS_KILLED':e.message);process.exitCode=1});server.listen(Number(new URL(manifest.origin).port),'127.0.0.1',()=>console.log(JSON.stringify({origin:manifest.origin,database:manifest.database,records:manifest.records.length,modelCalls:false,humanTrial:false})))}
