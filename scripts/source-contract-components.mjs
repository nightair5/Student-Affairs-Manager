import { build } from 'esbuild'
export async function sourceContractComponents() {
  const built = await build({ stdin: { contents: `export * from './src/recognition/sourceContractV4.ts';export * from './src/experiments/d26Recorded/contractFixtures.ts';export * from './src/experiments/d26Recorded/generationFixtures.ts';export * from './src/experiments/realInput01/candidate19.ts';export {buildCandidate17Request} from './src/experiments/realInput01/candidate17.ts';export {adaptModelWireD26,assembleSemanticFirstSuggestionD26} from './src/recognition/firstSuggestionD26.ts';export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11.ts';export {sourceReviewProblem,sourceEventProblem} from './src/domain/v2/sourceReviewD26.ts';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' })
  return import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'))
}
