import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync,readFileSync,readdirSync,renameSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {atomicStateWriter} from './scoped-state-writer-v2.mjs'

test('transient Windows replacement failures retry only the local rename',async()=>{
 const root=mkdtempSync(join(tmpdir(),'scope-state-v2-')),path=join(root,'STATE.json'),oldTemp=path+'.new'
 writeFileSync(path,'old-state');writeFileSync(oldTemp,'historical-temp')
 let attempts=0
 await atomicStateWriter(path,{replace:(from,to)=>{attempts++;if(attempts<3){const e=Error('locked');e.code='EPERM';throw e}renameSync(from,to)},wait:async()=>{}})({status:'SENDING'})
 assert.equal(attempts,3);assert.equal(JSON.parse(readFileSync(path,'utf8')).status,'SENDING')
 assert.equal(readFileSync(oldTemp,'utf8'),'historical-temp')
})

test('persistent replacement failure preserves the previous state and new forensic temporary file',async()=>{
 const root=mkdtempSync(join(tmpdir(),'scope-state-v2-')),path=join(root,'STATE.json')
 writeFileSync(path,'old-state');let attempts=0
 const replace=()=>{attempts++;const e=Error('locked');e.code='EPERM';throw e}
 await assert.rejects(atomicStateWriter(path,{replace,wait:async()=>{}})({status:'SENDING'}),{code:'EPERM'})
 assert.equal(attempts,4);assert.equal(readFileSync(path,'utf8'),'old-state')
 assert.equal(readdirSync(root).filter(name=>name.startsWith('STATE.json.')&&name.endsWith('.new')).length,1)
})
