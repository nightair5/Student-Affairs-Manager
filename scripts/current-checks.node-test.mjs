import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync,writeFileSync,readFileSync,mkdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {checkEnvironment,assertNoEnvironmentFiles,testFileGroups,prepareCarriers,inspectHistoricalFiles,historicalArtifactEntries,historicalTestNames,historicalTestPattern} from './current-checks-support.mjs'
import {validateEngineeringFont,fontGlyphs,ENGINEERING_FONT} from './engineering-font.mjs'
import {generateRecognitionContract} from './generate-recognition-contract.mjs'
import {generateTimeAst} from './generate-time-ast.mjs'

test('both requested timezones reach actual child Date computations; credentials are never read',()=>{
  for(const [TZ,offset] of [['UTC',0],['Asia/Shanghai',-480]]) {
    const source={PATH:process.env.PATH,TZ,REAL_INPUT_CARRIERS_MANIFEST:'untrusted-old-carriers',NODE_OPTIONS:'untrusted-loader',GRANT_ID:'not-authorized'}
    Object.defineProperty(source,'DEEPSEEK_API_KEY',{enumerable:true,get(){throw Error('SECRET_GETTER_READ')}})
    const env=checkEnvironment(source)
    assert.deepEqual(Object.keys(env).sort(),['CI','NO_COLOR','PATH','TZ'])
    const child=spawnSync(process.execPath,['-e','console.log(JSON.stringify({TZ:process.env.TZ,offset:new Date("2026-01-15T00:00:00Z").getTimezoneOffset()}))'],{env,encoding:'utf8'})
    assert.equal(child.status,0,child.stderr);assert.deepEqual(JSON.parse(child.stdout),{TZ,offset})
  }
})
test('environment files fail before contents are opened, including Worker dev vars',()=>{
  for(const name of ['.env.local','.dev.vars']) {const dir=mkdtempSync(join(tmpdir(),'checks-env-'));writeFileSync(join(dir,name),'ANONYMOUS_TEST_PLACEHOLDER');assert.throws(()=>assertNoEnvironmentFiles(dir),/ENV_FILE_PRESENT_NO_LOAD/)}
})
test('carrier preparation failure still records dependent NOT_RUN and permits independent groups',async()=>{
  const rows=[];let dependent=0
  await prepareCarriers(async()=>{throw Error('TEST_MISSING_FONT')},()=>{dependent++},row=>rows.push(row))
  rows.push({label:'independent-server',outcome:'PASS'})
  assert.equal(dependent,0);assert.deepEqual(rows.map(r=>r.outcome),['FAIL','NOT_RUN','PASS'])
  const success=[];await prepareCarriers(async()=>'fresh-manifest',manifest=>success.push(manifest),()=>{})
  assert.deepEqual(success,['fresh-manifest'])
})
test('test inventory partitions every TypeScript suite once; carrier suite is not silently omitted',()=>{
  const groups=testFileGroups(process.cwd()),all=Object.values(groups).flat()
  assert.equal(new Set(all).size,all.length)
  assert.deepEqual(groups.carriers,['src/experiments/realInput01/acceptance.test.tsx'])
  assert.ok(groups.product.includes('src/lib/timeSemantics.test.ts'))
  assert.ok(groups.safety.includes('src/experiments/candidate11/runtime.test.tsx'))
  assert.equal(groups.historical.length,6)
  assert.deepEqual(groups.mixed,['src/experiments/realInput01/runtime.test.ts'])
})
test('mixed legacy suites have complementary selectors and every historical selector still exists',()=>{
  const groups=testFileGroups(process.cwd())
  for(const group of ['carriers','mixed']) {
    const source=readFileSync(groups[group][0],'utf8'),historic=new RegExp(historicalTestPattern(group,true)),current=new RegExp(historicalTestPattern(group,false))
    for(const title of [...historicalTestNames[group],'a new independent regression must still run']) {
      if(title!=='a new independent regression must still run')assert.ok(source.includes(title),'Stale selector: '+title)
      assert.notEqual(historic.test(title),current.test(title))
    }
    assert.equal(current.test('a new independent regression must still run'),true)
  }
})
test('missing originals cannot hide a later tampered file; LF normalization is explicit only',()=>{
  const dir=mkdtempSync(join(tmpdir(),'checks-history-')),sha=bytes=>createHash('sha256').update(bytes).digest('hex')
  writeFileSync(join(dir,'changed'),'wrong');writeFileSync(join(dir,'text'),'one\r\ntwo\r\n')
  const rows=[{path:'missing',sha256:sha('original')},{path:'changed',sha256:sha('original')},{path:'text',sha256:sha('one\ntwo\n'),mode:'lf'}]
  const result=inspectHistoricalFiles(dir,rows)
  assert.equal(result.outcome,'FAIL');assert.deepEqual(result.results.map(row=>row.outcome),['NOT_AVAILABLE','FAIL','PASS'])
  assert.equal(inspectHistoricalFiles(dir,[{...rows[2],mode:'raw'}]).outcome,'FAIL')
})
test('a rewritten historical manifest cannot bless tampered originals by changing expectations',()=>{
  const dir=mkdtempSync(join(tmpdir(),'checks-manifest-'))
  mkdirSync(join(dir,'docs/governance'),{recursive:true})
  writeFileSync(join(dir,'docs/governance/GOVERNANCE_BASELINE_V2.json'),JSON.stringify({protectedFiles:[],frozenFiles:[],archives:[]}))
  const result=inspectHistoricalFiles(dir,historicalArtifactEntries(dir))
  assert.equal(result.outcome,'FAIL')
  assert.equal(result.results.find(row=>row.path.endsWith('GOVERNANCE_BASELINE_V2.json')).reason,'IMMUTABLE_ORIGINAL_CHANGED')
  assert.equal(result.results.find(row=>row.path.endsWith('MANIFEST.json')).outcome,'NOT_AVAILABLE')
})
test('generated contracts are identical across checkout line endings but semantic changes fail equality',()=>{
  for(const [path,generate] of [['src/recognition/schema.ts',generateRecognitionContract],['src/lib/timeSemantics.ts',generateTimeAst]]) {
    const source=readFileSync(path,'utf8').replace(/\r\n/g,'\n'),lf=generate(source)
    assert.equal(generate(source.replace(/\n/g,'\r\n')),lf)
    assert.notEqual(generate(source+'\nexport const engineeringDrift = true\n'),lf)
  }
})
test('bundled font covers the exact old engineering notices; missing glyphs fail instead of fallback',()=>{
  const source=readFileSync('src/experiments/mainline01/fixtures.ts','utf8'),text=source.slice(source.indexOf('export const notices:'),source.indexOf('export function emptyWorkspace'))
  const coverage=validateEngineeringFont(text)
  assert.ok(coverage.cjkCharacters>40)
  assert.throws(()=>validateEngineeringFont(String.fromCodePoint(0x10ffff)),/MISSING_GLYPHS/)
  assert.notEqual(fontGlyphs(readFileSync(ENGINEERING_FONT),'请交')[0].glyph,fontGlyphs(readFileSync(ENGINEERING_FONT),'请交')[1].glyph)
})
