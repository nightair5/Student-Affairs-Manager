import {build} from 'esbuild'
export async function publicNoticeComponents(){
  const b=await build({stdin:{contents:`export * from './src/experiments/candidate19Recorded/publicNotices';export {buildCandidate19Request} from './src/experiments/realInput01/candidate19';export {decodeCurrentSourceRecording} from './src/recognition/conditionalNonActionProduct';export {assembleCurrentFirstSuggestion,groundMaterialChannels} from './src/recognition/materialChannelGrounding';export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11';`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'})
  return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'))
}
