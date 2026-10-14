import {build} from 'esbuild'
import {createServer} from 'node:http'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {resolve,basename} from 'node:path'
import {pathToFileURL} from 'node:url'
import {buildD13Records,digest} from './candidate16-d13-records.mjs'
import {d13Components} from './candidate16-d13-support.mjs'
import {scoreD17} from './score-candidate17-d17.mjs'
import {d8Handler} from './serve-candidate15-d8.mjs'

const read=path=>JSON.parse(readFileSync(path,'utf8'))
export async function buildD19Preview(port='6654',participant='p1'){
  if(!/^\d{4,5}$/.test(port)||Number(port)<6654||Number(port)>65535||!/^p[1-9][0-9]{0,2}$/.test(participant))throw Error('D19_NEW_LOOPBACK_OR_IDENTITY_REQUIRED')
  const scored=await scoreD17()
  if(scored.sent!==24||scored.settled!==24||scored.rawCount!==24)throw Error('D19_D17_RECORDINGS_INCOMPLETE')
  const directory=resolve('.data/d19/source-session-'+participant),origin='http://127.0.0.1:'+port
  const database='rco-mainline-01-02-i1-real-input-d19-source-session-'+participant
  mkdirSync(resolve(directory,'records'),{recursive:true})
  const root='docs/recognition-optimization/candidate17/d16-development'
  const units=read(root+'/PREPARED_REQUEST_IDENTITIES.json').requests
  const sources=read(root+'/SOURCES.json').sources
  const {indexImmutableScopesV11}=await d13Components()
  const recorded=[]
  for(const unit of units){
    const source=sources.find(s=>s.sourceId===unit.sourceId),raw=read('.data/candidate17/d17-execution/raw/'+String(unit.ordinal).padStart(2,'0')+'.json')
    if(!source||raw.ordinal!==unit.ordinal||raw.requestSha256!==unit.requestSha256||digest(raw.rawHttpText)!==raw.responseSha256)throw Error('D19_FROZEN_RECORD_DRIFT')
    const context={index:await indexImmutableScopesV11(source.sourceId,source.sourceVersionId,source.sourceText),referenceTime:source.referenceTime,timezone:source.timezone}
    recorded.push({id:'d19-record-'+String(unit.ordinal).padStart(2,'0'),label:`D17录制 ${unit.sourceId} / ${unit.candidate}`,kind:'RECORDED_MODEL',candidateVersion:unit.candidate==='Candidate03'?'real-input-source-semantics-3':'real-input-source-semantics-17',context,rawHttpText:raw.rawHttpText,responseSha256:raw.responseSha256,requestSha256:unit.requestSha256})
  }
  const originals=(await buildD13Records()).filter(row=>row.kind==='ENGINEERING_FIXTURE')
  const base=originals.find(row=>row.id==='d13-fixture-vague-event')
  if(!base)throw Error('D19_ENGINEERING_BASE_MISSING')
  const source='[D19匿名工程夹具]\n请复核项目成员资料，以页面显示资料复核完成为准。图书馆检索讲座将于10月21日19:00开始，10月21日20:00结束。校园服务台维护将在周三晚进行，结束时间另行通知。'
  const index=await indexImmutableScopesV11('D19-MIXED','D19-MIXED-v1',source)
  const envelope=JSON.parse(base.rawHttpText),wire=JSON.parse(envelope.output.at(-1).content[0].text)
  for(const field of ['tasks','materials','timePoints','events','revisions','conflicts'])wire[field]=[]
  const scope=fragment=>{const hit=index.scopes.find(s=>s.text.includes(fragment));if(!hit)throw Error('D19_FIXTURE_SCOPE_MISSING:'+fragment);return hit.id}
  const taskScope=scope('请复核项目成员资料'),criterionScope=scope('页面显示资料复核完成'),lectureScope=scope('检索讲座'),lectureEndScope=scope('10月21日20:00'),maintenanceScope=scope('周三晚'),unknownEndScope=scope('结束时间另行通知')
  const taskBase=originals.find(row=>row.id==='d13-fixture-task')
  if(!taskBase)throw Error('D19_TASK_FIXTURE_MISSING')
  const taskWire=JSON.parse(JSON.parse(taskBase.rawHttpText).output.at(-1).content[0].text)
  const task=structuredClone(taskWire.tasks[0])
  task.propositionScopeIds=[taskScope,criterionScope]
  task.action.scopeId=taskScope;task.object.scopeId=taskScope
  wire.tasks=[task]
  const point=(tempId,type,rawText,scopeId)=>({tempId,type,rawText,relatedTaskTempIds:[],relatedMaterialTempIds:[],scopeIds:[scopeId],confidence:1})
  wire.timePoints=[point('P1','event_start','10月21日19:00',lectureScope),point('P2','event_end','10月21日20:00',lectureEndScope),point('P3','event_start','周三晚',maintenanceScope),point('P4','event_end','结束时间另行通知',unknownEndScope)]
  const event=(tempId,title,start,end,scopeIds)=>({tempId,title,description:'',startTimePointTempId:start,endTimePointTempId:end,location:null,scopeIds,confidence:1,inferenceLevel:'explicit',relatedTaskTempIds:[]})
  wire.events=[event('E1','检索讲座','P1','P2',[lectureScope]),event('E2','校园服务台维护','P3','P4',[maintenanceScope,unknownEndScope])]
  const covered=new Set([taskScope,criterionScope,lectureScope,lectureEndScope,maintenanceScope,unknownEndScope])
  wire.informationScopeIds=index.scopes.filter(s=>!covered.has(s.id)).map(s=>s.id);wire.unresolvedScopeIds=[]
  envelope.output.at(-1).content[0].text=JSON.stringify(wire)
  const rawHttpText=JSON.stringify(envelope)
  const mixed={...base,id:'d13-fixture-d19-mixed',label:'匿名工程夹具：任务与两个独立事件',context:{...base.context,index},rawHttpText,responseSha256:digest(rawHttpText),requestSha256:digest('D19_ENGINEERING_MIXED_NOT_SENT')}
  const fixtures=[...originals,mixed]
  const manual=fixtures.map(row=>{
    const copy=JSON.parse(row.rawHttpText),blank=JSON.parse(copy.output.at(-1).content[0].text)
    for(const field of ['tasks','materials','timePoints','events','revisions','conflicts'])blank[field]=[]
    blank.informationScopeIds=row.context.index.scopes.map(s=>s.id);blank.unresolvedScopeIds=[]
    copy.output.at(-1).content[0].text=JSON.stringify(blank)
    const text=JSON.stringify(copy),id='d13-fixture-manual-'+row.id.slice('d13-fixture-'.length)
    return {...row,id,label:'空白手动 · '+row.label,rawHttpText:text,responseSha256:digest(text),requestSha256:digest('D19_MANUAL_NO_MODEL:'+id)}
  })
  const records=[...fixtures,...manual,...recorded].map(row=>{const content=JSON.stringify(row);writeFileSync(resolve(directory,'records',row.id+'.json'),content);return {id:row.id,label:row.label,kind:row.kind,sha256:digest(content)}})
  const config={origin,database,records,sourceSession:true,buildLabel:'D19来源级核对'}
  const output=await build({absWorkingDir:process.cwd(),entryPoints:['src/experiments/candidate16/d14-browser.tsx'],bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic',target:'es2022',outdir:'memory',minify:true,define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}',__D14_CONFIG__:JSON.stringify(config)}})
  for(const file of output.outputFiles){const content=file.text.replace(/@import\s+url\("https:\/\/fonts\.googleapis\.com[^;]+;\s*/g,'');writeFileSync(resolve(directory,basename(file.path)),content)}
  writeFileSync(resolve(directory,'index.html'),'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>D19来源级核对 / 匿名工程回放</title><link rel="stylesheet" href="/d14-browser.css"></head><body><div id="root">正在打开 D19 来源级核对…</div><script type="module" src="/d14-browser.js"></script></body></html>')
  const paths=['index.html','d14-browser.js','d14-browser.css',...records.map(row=>'records/'+row.id+'.json')]
  const manifest={version:'d19-source-session-local-1',origin,database,directory,participant,buildLabel:config.buildLabel,records,modelCallsEnabled:false,humanTrial:false,assets:paths.map(path=>({path,sha256:digest(readFileSync(resolve(directory,path)))}))}
  writeFileSync(resolve(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n')
  return manifest
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const manifest=await buildD19Preview(process.argv[2]??'6654',process.argv[3]??'p1'),server=createServer(d8Handler(manifest));server.once('error',error=>{console.error(error.code==='EADDRINUSE'?'D19_PORT_BUSY_NO_PROCESS_KILLED':error.message);process.exitCode=1});server.listen(Number(new URL(manifest.origin).port),'127.0.0.1',()=>console.log(JSON.stringify({origin:manifest.origin,database:manifest.database,records:manifest.records.length,modelCalls:false,humanTrial:false})))}
