import {readFileSync} from 'node:fs'
import {build} from 'esbuild'
export const D13='docs/recognition-optimization/candidate16/d13-development'
export const readJson=path=>JSON.parse(readFileSync(path,'utf8'))
export async function d13Components(){
  const output=await build({stdin:{contents:"export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11.ts';export {adaptCandidate14CommonWire} from './src/experiments/candidate14/commonAdapter.ts';export {buildCandidate03Request} from './src/experiments/realInput01/candidate03.ts';export {buildCandidate16Request} from './src/experiments/realInput01/candidate16.ts';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',logLevel:'silent'})
  return import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].contents).toString('base64'))
}
export async function d13Oracles(){
  const x=await d13Components(), sources=readJson('docs/recognition-optimization/candidate15/d8-development/SOURCES.json').sources
  const old=readJson('docs/recognition-optimization/candidate15/d9-development/LEGAL_WIRE_ORACLES.json').oracles
  return Promise.all(sources.map(async source=>{
    const context={index:await x.indexImmutableScopesV11(source.sourceId,source.sourceVersionId,source.sourceText),referenceTime:source.referenceTime,timezone:source.timezone}
    const wire=structuredClone(old.find(row=>row.sourceId===source.sourceId).wire)
    if(source.sourceId.endsWith('04')){wire.tasks=[];wire.informationScopeIds=context.index.scopes.map(s=>s.id)}
    return {source,context,wire,result:x.adaptCandidate14CommonWire(wire,context).adapted}
  }))
}
