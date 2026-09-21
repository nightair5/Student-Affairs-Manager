import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {candidate11Handler,buildCandidate11Preview} from './serve-candidate11.mjs'

const directory=mkdtempSync(join(tmpdir(),'c11-static-tests-'))
writeFileSync(join(directory,'index.html'),'<html>C11</html>')
const handler=candidate11Handler({origin:'http://127.0.0.1:6633',directory,assets:[{path:'index.html'}]})
function request(url='/',headers={},method='GET'){
  const result={}
  handler({url,method,headers:{host:'127.0.0.1:6633',...headers}},
    {writeHead:(status,h)=>{result.status=status;result.headers=h},end:b=>{result.body=b?.toString()}})
  return result
}
test('only the named loopback static origin serves the actual application',()=>{
  assert.equal(request().status,200);assert.equal(request('/?automation=1').status,200)
  assert.equal(request('/',{},'HEAD').body,undefined)
  assert.match(request().headers['Content-Security-Policy'],/connect-src 'self'/)
})
test('host, origin and cross-site requests fail closed',()=>{
  for(const headers of [{host:'attacker.invalid'},{origin:'https://other.invalid'},{'sec-fetch-site':'cross-site'}])
    assert.equal(request('/',headers).status,403)
})
test('model paths, unlisted files, traversal and server writes are unavailable',()=>{
  for(const path of ['/api/deepseek','/manifest.json','/../.env','/.env','/?other=1'])assert.equal(request(path).status,404)
  for(const method of ['POST','PUT','DELETE','OPTIONS'])assert.equal(request('/',{},method).status,405)
})
test('old origins and public addresses cannot build C11',async()=>{
  for(const origin of ['http://127.0.0.1:6632','http://127.0.0.1:6631','http://0.0.0.0:6633','https://preview.student-affairs.site'])
    await assert.rejects(()=>buildCandidate11Preview(origin),/C11_PREVIEW_ORIGIN/)
})
test('launcher is isolated from dotenv and deployment configuration',()=>{
  const source=readFileSync('scripts/serve-candidate11.mjs','utf8')
  assert.doesNotMatch(source,/import.*(?:dotenv|wrangler)/)
  assert.match(source,/server.listen\(Number\(arg\),'127\.0\.0\.1'/)
})
