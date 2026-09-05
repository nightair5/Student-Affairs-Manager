import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { build } from 'esbuild'
import { basename } from 'node:path'

const bundle=await build({entryPoints:['src/experiments/mainline02/browser.tsx'],bundle:true,write:false,
  outdir:'memory',platform:'browser',format:'esm',jsx:'automatic',loader:{'.svg':'dataurl'},
  define:{'process.env.NODE_ENV':'"test"','import.meta.env':'{}'}})
const assets=new Map(bundle.outputFiles.map(file=>['/'+basename(file.path),file.contents]))
const js=[...assets.keys()].find(name=>name.endsWith('.js')),css=[...assets.keys()].find(name=>name.endsWith('.css'))
const html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>MAINLINE-02-I1 真实App隔离验收</title><meta name="viewport" content="width=device-width,initial-scale=1">'+(css?'<link rel="stylesheet" href="'+css+'">':'')+'<div id="root"></div><script type="module" src="'+js+'"></script></html>'
const server=createServer((request,response)=>{
  const path=new URL(request.url,'http://127.0.0.1').pathname
  response.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
  response.setHeader('Cache-Control','no-store')
  if(request.method!=='GET'||(path!=='/'&&!assets.has(path))){response.writeHead(404);response.end();return}
  response.setHeader('Content-Type',path==='/'?'text/html; charset=utf-8':path.endsWith('.css')?'text/css':'text/javascript')
  response.end(path==='/'?html:assets.get(path))
})
server.listen(0,'127.0.0.1',()=>console.log('MAINLINE_I1_URL=http://127.0.0.1:'+server.address().port+'/?run='+randomUUID()+'&new=1'))
