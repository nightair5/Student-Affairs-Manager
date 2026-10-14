// Thin fixed-recording adapter to the existing ordinary App and save chain.
// No model endpoint, credential loading, or direct database writes.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {createServer} from 'node:http'
import {build} from 'esbuild'
import {execFileSync} from 'node:child_process'
import {productFirst} from './product-dev-evaluation.mjs'
import {sha} from './product-development.mjs'
const port=Number(process.argv[2]??6953),round=Number(process.argv[3]??3)
if(!Number.isInteger(port)||port<6952||port>6999||![1,2,3].includes(round))throw Error('NEW_ISOLATED_PORT_AND_RECORDED_ROUND_REQUIRED')
const root=resolve('.data/autonomous-product-20261013'),dir=join(root,'browser','product-'+port),packet=JSON.parse(readFileSync(join(root,`round-${round}/ROUND.json`))),recordings=[]
mkdirSync(dir,{recursive:true})
for(const b of packet.batches){const bd=resolve(root,b.executionRoot),sources=JSON.parse(readFileSync(join(bd,'SOURCES.json'))),units=JSON.parse(readFileSync(join(bd,'IDENTITIES.json'))).units
 for(let i=0;i<sources.length;i++){const s=sources[i],raw=JSON.parse(readFileSync(join(bd,'raw',String(i+1).padStart(2,'0')+'.json')));let first=null;try{first=await productFirst(raw.rawHttpText,s)}catch{/* failures stay visible in the complete recording selector */}
 recordings.push({ordinal:recordings.length+1,sourceId:s.id,sourceVersionId:s.id+'-v1',candidate:'ProductRecognition',generationContract:'ordinary-product-recording-1',promptVersion:units[i].promptVersion,sourceText:s.text,referenceTime:s.referenceTime,timezone:s.timezone,rawHttpText:raw.rawHttpText,responseSha256:sha(raw.rawHttpText),requestSha256:units[i].requestSha256,serverNormalizedResult:first?.serverNormalized??null,frozenOutcome:first?.result?'后验程序可展示；不等于整份正确':'原契约拒绝，原答保留'})
 }}
writeFileSync(join(dir,'recordings.json'),JSON.stringify(recordings))
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),origin='http://127.0.0.1:'+port
await build({entryPoints:['src/experiments/candidate19Recorded/browser.tsx'],outfile:join(dir,'app.js'),bundle:true,format:'esm',platform:'browser',jsx:'automatic',define:{__C19_RECORDED_CONFIG__:JSON.stringify({database:'rco-mainline-01-02-i1-d27-plan-recorded-product-'+port,build:head,origin,initialOrdinal:1,batchLabel:`产品开发集第${round}轮全部36份固定真实录制；人工前评分与用户最终结果分列`})},logLevel:'silent'})
const html='<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>学生事务管家 · 产品开发集固定录制</title><link rel="stylesheet" href="/app.css"><div id="root"></div><script type="module" src="/app.js"></script></html>'
createServer((req,res)=>{if(req.method!=='GET'){res.writeHead(405);return res.end('MODEL_ROUTE_DISABLED')}const p=new URL(req.url,origin).pathname;if(p==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html)}const names={'/app.js':['app.js','text/javascript'],'/app.css':['app.css','text/css'],'/recordings.json':['recordings.json','application/json']};if(!names[p]){res.writeHead(404);return res.end('NOT_FOUND')}const [name,mime]=names[p];res.setHeader('Content-Type',mime+'; charset=utf-8');res.end(readFileSync(join(dir,name)))}).listen(port,'127.0.0.1',()=>console.log(JSON.stringify({origin,database:'rco-mainline-01-02-i1-d27-plan-recorded-product-'+port,recordings:recordings.length,modelRoute:'DISABLED',build:head})))
