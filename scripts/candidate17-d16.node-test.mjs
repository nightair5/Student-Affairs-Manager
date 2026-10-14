import {test} from 'node:test'
import {strict as assert} from 'node:assert'
import {mkdtempSync,readFileSync,writeFileSync,cpSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {verifyD16FrozenPackage,assertD16DispatchAllowed} from './candidate17-d16-guard.mjs'

const source='docs/recognition-optimization/candidate17/d16-development'
test('the 24 frozen identities are balanced and remain unsent',()=>{
  assert.deepEqual(verifyD16FrozenPackage(),{status:'ZERO_CALL_FROZEN',units:24,order:{AB:6,BA:6},dispatchAuthorized:false})
  assert.throws(()=>assertD16DispatchAllowed({dispatchAuthorized:false},null),/D16_DISPATCH_NOT_AUTHORIZED/)
})
test('tampered request, duplicate identity, and manifest drift are blocked',()=>{
  const temporary=mkdtempSync(join(tmpdir(),'d16-guard-'))
  try{
    cpSync(source,temporary,{recursive:true})
    const file=join(temporary,'PREPARED_REQUEST_IDENTITIES.json'),text=readFileSync(file,'utf8')
    writeFileSync(file,text.replace('"NOT_RUN"','"SENT"'))
    assert.throws(()=>verifyD16FrozenPackage(temporary),/D16_ARTIFACT_DRIFT/)
  }finally{rmSync(temporary,{recursive:true,force:true})}
})
test('a rehashed artifact cannot hide a duplicate identity or changed request body',()=>{
  for(const mutation of ['duplicate','request']){
    const temporary=mkdtempSync(join(tmpdir(),'d16-guard-'))
    try{
      cpSync(source,temporary,{recursive:true})
      const file=join(temporary,'PREPARED_REQUEST_IDENTITIES.json'),prepared=JSON.parse(readFileSync(file,'utf8'))
      if(mutation==='duplicate')prepared.requests[1].unitIdentitySha256=prepared.requests[0].unitIdentitySha256
      else prepared.requests[0].body.max_output_tokens=8191
      const bytes=JSON.stringify(prepared,null,2)+'\n';writeFileSync(file,bytes)
      const manifestFile=join(temporary,'MANIFEST.json'),manifest=JSON.parse(readFileSync(manifestFile,'utf8'))
      manifest.artifacts.find(row=>row.path==='PREPARED_REQUEST_IDENTITIES.json').sha256=createHash('sha256').update(bytes).digest('hex')
      writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n')
      assert.throws(()=>verifyD16FrozenPackage(temporary),mutation==='duplicate'?/D16_IDENTITY_DRIFT/:/D16_REQUEST_DRIFT/)
    }finally{rmSync(temporary,{recursive:true,force:true})}
  }
})
