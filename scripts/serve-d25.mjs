import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {resolve,basename} from 'node:path'
import {createServer} from 'node:http'
import {execFileSync} from 'node:child_process'
import {pathToFileURL} from 'node:url'
import {build} from 'esbuild'
import {makeD25,sha,verifyD25,D25_ROOT} from './prepare-d25.mjs'
import {d25Components} from './d25-components.mjs'
import {buildD13Records} from './candidate16-d13-records.mjs'
import {d8Handler} from './serve-candidate15-d8.mjs'
export async function buildD25Preview(port='6750',instance='accuracy01'){
  if(!/^\d{4,5}$/.test(port)||Number(port)<6745||Number(port)>65535||!/^[a-z0-9]{2,18}$/.test(instance))throw Error('D25_ISOLATED_LOOPBACK_REQUIRED')
  const directory=resolve('.data/d25/'+instance),origin='http://127.0.0.1:'+port,database='rco-mainline-01-02-i1-real-input-d23-study-engineering-d25-'+instance
  mkdirSync(resolve(directory,'records'),{recursive:true})
  const frozen=existsSync(resolve(D25_ROOT,'MANIFEST.json'));if(frozen)verifyD25()
  const data=frozen?Object.fromEntries(['SOURCES.json','LEGAL_WIRE_ORACLES.json'].map(p=>[p,JSON.parse(readFileSync(resolve(D25_ROOT,p),'utf8'))])):await makeD25(),sources=data['SOURCES.json'].sources,oracles=data['LEGAL_WIRE_ORACLES.json'].oracles,x=await d25Components(),records=[]
  for(const [i,s] of sources.entries()){
    const context={index:await x.indexImmutableScopesV11(s.sourceId,s.sourceVersionId,s.sourceText),referenceTime:s.referenceTime,timezone:s.timezone},facts=oracles[i].rawFacts
    const rawHttpText=JSON.stringify({id:'d25-engineering-oracle-no-provider-call',status:'completed',error:null,model:'deepseek-flash',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(facts)}]}],usage:{input_tokens:0,output_tokens:0}})
    records.push({id:'d13-fixture-d25-'+String(i+1).padStart(2,'0'),label:'D25工程正例 '+s.target+' / Candidate18机制（非模型输出）',kind:'ENGINEERING_FIXTURE',candidateVersion:'real-input-source-semantics-18',context,rawHttpText,responseSha256:sha(rawHttpText),requestSha256:sha('D25_ENGINEERING_NOT_SENT:'+s.sourceId)})
  }
  const old='docs/recognition-optimization/candidate17/d16-development',oldSources=JSON.parse(readFileSync(old+'/SOURCES.json')).sources,units=JSON.parse(readFileSync(old+'/PREPARED_REQUEST_IDENTITIES.json')).requests
  for(const number of [5,6,9]){
    const s=oldSources[number-1],unit=units.find(u=>u.sourceId===s.sourceId&&u.candidate==='Candidate17'),raw=JSON.parse(readFileSync('.data/candidate17/d17-execution/raw/'+String(unit.ordinal).padStart(2,'0')+'.json'))
    if(sha(raw.rawHttpText)!==raw.responseSha256||raw.requestSha256!==unit.requestSha256)throw Error('D25_OLD_RAW_DRIFT')
    records.push({id:'d21-record-'+String(unit.ordinal).padStart(2,'0'),label:'D17原回答 '+s.sourceId+' / Candidate17（只读）',kind:'RECORDED_MODEL',candidateVersion:'real-input-source-semantics-17',context:{index:await x.indexImmutableScopesV11(s.sourceId,s.sourceVersionId,s.sourceText),referenceTime:s.referenceTime,timezone:s.timezone},rawHttpText:raw.rawHttpText,responseSha256:raw.responseSha256,requestSha256:raw.requestSha256})
  }
  records.push((await buildD13Records()).find(r=>r.id==='d13-fixture-partial-revision'))
  const roster=records.map(r=>{const text=JSON.stringify(r);writeFileSync(resolve(directory,'records',r.id+'.json'),text);return {id:r.id,label:r.label,kind:r.kind,sha256:sha(text)}})
  const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),paths=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','src','scripts'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(p=>/\.(tsx?|m?js)$/.test(p)).sort(),sourceSha256=sha(paths.map(p=>p+':'+sha(readFileSync(p))).join('\n'))
  const config={origin,database,records:roster,buildIdentity:head.slice(0,12)+' / source '+sourceSha256.slice(0,12)},output=await build({absWorkingDir:process.cwd(),entryPoints:['src/experiments/candidate18/d25-browser.tsx'],bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic',target:'es2022',outdir:'memory',minify:true,define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}',__D25_CONFIG__:JSON.stringify(config)}})
  for(const f of output.outputFiles)writeFileSync(resolve(directory,basename(f.path)),f.text.replace(/@import\s+url\("https:\/\/fonts\.googleapis\.com[^;]+;\s*/g,''))
  writeFileSync(resolve(directory,'index.html'),'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>D25 首次建议机制工程验收</title><link rel="stylesheet" href="/d25-browser.css"></head><body><div id="root">正在打开…</div><script type="module" src="/d25-browser.js"></script></body></html>')
  const assets=['index.html','d25-browser.js','d25-browser.css',...roster.map(r=>'records/'+r.id+'.json')]
  const manifest={version:'d25-isolated-preview-1',origin,database,directory,gitHead:head,sourceSha256,modelCallsEnabled:false,humanTrial:false,records:roster,assets:assets.map(path=>({path,sha256:sha(readFileSync(resolve(directory,path)))}))}
  writeFileSync(resolve(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');return manifest
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const m=await buildD25Preview(process.argv[2]??'6750',process.argv[3]??'accuracy01'),server=createServer(d8Handler(m));server.once('error',e=>{console.error(e.message);process.exitCode=1});server.listen(Number(new URL(m.origin).port),'127.0.0.1',()=>console.log(JSON.stringify({origin:m.origin,database:m.database,build:m.sourceSha256,modelCalls:0,human:false}))) }
