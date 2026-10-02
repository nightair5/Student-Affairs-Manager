import {build} from 'esbuild'
export async function d25Components(){
  const result=await build({stdin:{contents:`export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11.ts';export {buildCandidate17Request} from './src/experiments/realInput01/candidate17.ts';export {buildCandidate18Request} from './src/experiments/realInput01/candidate18.ts';export {assembleSourceFacts,projectSourceFacts,convertCandidate18Envelope} from './src/experiments/realInput01/sourceFactsV3.ts';export {adaptModelWire,parseModelEnvelope} from './src/experiments/realInput01/modelWire.ts';export {composeSemantics} from './src/experiments/mainline04/semanticComposer.ts';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',logLevel:'silent'})
  return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].contents).toString('base64'))
}
