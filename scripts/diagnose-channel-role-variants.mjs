import {build} from 'esbuild'
import {mkdirSync,writeFileSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
const output=resolve(process.argv[2]??'.data/candidate19/channel-role-variants')
mkdirSync(output,{recursive:true})
await build({stdin:{contents:`export {CHANNEL_ROLE_CASES,createChannelRoleFixture} from './src/experiments/candidate19Recorded/materialChannelFixtures';export {decodeCurrentSourceRecording} from './src/recognition/conditionalNonActionProduct';export {assembleCurrentFirstSuggestion,MATERIAL_CHANNEL_GROUNDING_VERSION} from './src/recognition/materialChannelGrounding'`,resolveDir:process.cwd()},outfile:join(output,'components.mjs'),bundle:true,platform:'node',format:'esm'})
const x=await import(pathToFileURL(join(output,'components.mjs'))),cases=[]
for(const row of x.CHANNEL_ROLE_CASES){
  const f=await x.createChannelRoleFixture(row.id),decoded=x.decodeCurrentSourceRecording(f.rawHttpText,'EngineeringFixture',f.context)
  const first=x.assembleCurrentFirstSuggestion(decoded.result,{sourceText:f.sourceText,referenceTime:f.context.referenceTime,timezone:f.context.timezone})
  const decision=first.materialChannelAudit.decisions[0]
  cases.push({id:row.id,source:f.sourceText,expected:row.expected,wireSha256:createHash('sha256').update(f.rawHttpText).digest('hex'),observed:decision.status,pass:row.expected===decision.status,decision,rawHttpText:f.rawHttpText,firstSuggestion:first.result})
}
const report={role:'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT',version:x.MATERIAL_CHANNEL_GROUNDING_VERSION,modelCalls:0,denominator:cases.length,passed:cases.filter(c=>c.pass).length,cases}
writeFileSync(join(output,'REPORT.json'),JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({report:join(output,'REPORT.json'),version:report.version,passed:report.passed,denominator:report.denominator,cases:cases.map(c=>({id:c.id,expected:c.expected,observed:c.observed,pass:c.pass}))},null,2))
