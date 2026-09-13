import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import {runInNewContext} from 'node:vm'
import ts from 'typescript'
import worker from '../cloudflare/real-input-preview.mjs'
import {buildPreview} from './build-real-input-preview.mjs'

test('preview accepts only the two approved HTTPS origins and the explicit local profile',()=>{
  const source=readFileSync(new URL('../src/experiments/realInput01/browser.tsx',import.meta.url),'utf8')
  const tree=ts.createSourceFile('browser.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  const fn=tree.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text==='previewOriginAllowed')
  const compiled=ts.transpileModule(fn.getText(tree)+';previewOriginAllowed',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  const allowed=runInNewContext(compiled)
  const old='https://student-affairs-real-input-preview.nightsdell.workers.dev',alias='https://preview.student-affairs.site'
  const profile={origin:old,allowedOrigins:[old,alias]}
  assert.equal(allowed(profile,old,'https:'),true)
  assert.equal(allowed(profile,alias,'https:'),true)
  for(const origin of ['https://student-affairs.site','https://evil.example','http://preview.student-affairs.site']){
    assert.equal(allowed({...profile,allowedOrigins:[origin]},origin,new URL(origin).protocol),false)
  }
  assert.equal(allowed(profile,alias,'http:'),false)
  const local={origin:'http://127.0.0.1:6632',localOnly:true,allowedOrigins:[alias]}
  assert.equal(allowed(local,local.origin,'http:'),true)
  assert.equal(allowed(local,alias,'https:'),false)
})

test('published bootstrap and assets load while model, private files and unapproved routes stay blocked',async()=>{
  const manifest=await buildPreview()
  const config=JSON.parse(readFileSync(manifest.configuration,'utf8'))
  assert.deepEqual(config.routes,[{pattern:'preview.student-affairs.site',custom_domain:true}])
  assert.equal(config.name,'student-affairs-real-input-preview')
  assert.equal(config.workers_dev,true)
  assert.equal(manifest.modelCallsEnabled,false)
  const env={ASSETS:{fetch:async request=>{
    const path=new URL(request.url).pathname.slice(1)
    const entry=manifest.assets.find(a=>a.path===path)
    return new Response(entry?readFileSync(manifest.directory+'/assets/'+path):null,{status:entry?200:404})
  }}}
  for(const item of manifest.assets){
    const response=await worker.fetch(new Request('https://preview.student-affairs.site/'+item.path),env)
    assert.equal(response.status,200,item.path)
    assert.equal(response.headers.get('Cache-Control'),'no-store')
  }
  for(const path of ['/api/recognize','/.env','/package.json','/recorded/R11-03.json','/?new=1']){
    assert.equal((await worker.fetch(new Request('https://preview.student-affairs.site'+path),env)).status,404)
  }
  assert.equal((await worker.fetch(new Request('https://preview.student-affairs.site/api/recognize',{method:'POST'}),env)).status,405)
  const html=await (await worker.fetch(new Request('https://preview.student-affairs.site/'),env)).text()
  assert.match(html,/role="status"/)
  assert.match(html,/src="\/boot.js"/)
  assert.match(html,/<noscript>/)
})
