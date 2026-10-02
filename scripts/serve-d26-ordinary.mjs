import {build} from 'esbuild'
import {readdirSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {resolve,basename} from 'node:path'
import {createServer} from 'node:http'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
const [port='6760',instance='accept01']=process.argv.slice(2)
if(!/^\d{4,5}$/.test(port)||+port<6755||+port>65535||!/^[a-z0-9-]{2,32}$/.test(instance))throw Error('D26_NEW_LOOPBACK_INSTANCE_REQUIRED')
const dir=resolve('.data/d26/ordinary-'+instance),origin='http://127.0.0.1:'+port,database='rco-mainline-01-02-i1-d26-ordinary-'+instance
mkdirSync(dir,{recursive:true})
const sourceHash=createHash('sha256');for(const f of execFileSync('git',['ls-files','--cached','--others','--exclude-standard','src','scripts/serve-d26-ordinary.mjs'],{encoding:'utf8'}).trim().split('\n').sort())sourceHash.update(f).update(readFileSync(f));const buildIdentity=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim().slice(0,12)+' / source '+sourceHash.digest('hex').slice(0,12)
if(readdirSync(dir).length)throw Error('D26_INSTANCE_ALREADY_BUILT')
const output=await build({entryPoints:['src/experiments/d26/browser.tsx'],bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic',target:'es2022',outdir:'memory',define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}',__D26_ORDINARY_CONFIG__:JSON.stringify({origin,database,build:buildIdentity})}})
const sha=v=>createHash('sha256').update(v).digest('hex')
const files=output.outputFiles.map(f=>{const name=basename(f.path),text=f.text.replace(/@import\s+url\("https:\/\/fonts\.googleapis\.com[^;]+;\s*/g,'');writeFileSync(resolve(dir,name),text);return {name,sha256:sha(text)}})
writeFileSync(resolve(dir,'index.html'),'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>D26 普通产品入口 · 匿名工程输入</title><link rel="stylesheet" href="/browser.css"></head><body><div id="root"></div><script type="module" src="/browser.js"></script></body></html>')
writeFileSync(resolve(dir,'manifest.json'),JSON.stringify({origin,database,build:buildIdentity,role:'ENGINEERING_REPLAY',files,modelCalls:0},null,2)+'\n')
const server=createServer((req,res)=>{const p=new URL(req.url,origin).pathname;if(!['/','/browser.js','/browser.css','/manifest.json'].includes(p)){res.writeHead(403);res.end('D26_MODEL_AND_EXTERNAL_ROUTES_DISABLED');return}res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript; charset=utf-8':p.endsWith('.css')?'text/css; charset=utf-8':p.endsWith('.json')?'application/json':'text/html; charset=utf-8');res.end(readFileSync(resolve(dir,p==='/'?'index.html':p.slice(1))))})
server.listen(+port,'127.0.0.1',()=>console.log(JSON.stringify({origin,database,modelCalls:0})))
