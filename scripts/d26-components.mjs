import {build} from 'esbuild'
export async function d26Components(){
  const built=await build({stdin:{contents:`
    export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11.ts';
    export {buildCandidate17Request} from './src/experiments/realInput01/candidate17.ts';
    export {buildCandidate18Request} from './src/experiments/realInput01/candidate18.ts';
    export {assembleSourceFacts,projectSourceFacts,convertCandidate18Envelope} from './src/experiments/realInput01/sourceFactsV3.ts';
    export {adaptModelWire,parseModelEnvelope} from './src/experiments/realInput01/modelWire.ts';
    export {parseSemanticInput} from './src/experiments/mainline04/semanticContract.ts';
    export {interpretTimeD26} from './src/lib/timeSemanticsD26.ts';
    export {adaptModelWireD26,assembleSemanticFirstSuggestionD26,assembleRecognitionFirstSuggestionD26,bridgeSemanticToRecognitionD26} from './src/recognition/firstSuggestionD26.ts';
    export {createD26SemanticFixture} from './src/experiments/d26/semanticFixture.ts';
  `,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',logLevel:'silent'})
  return import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text+'\n//# sourceURL=d26-components.generated.mjs').toString('base64'))
}
