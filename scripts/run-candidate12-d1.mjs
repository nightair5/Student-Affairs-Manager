import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {loadD1Api, verifyD1Outputs} from './prepare-candidate12-d1.mjs'

/**
 * D1 deliberately has no model client, Secret reader, budget writer, raw writer,
 * retry loop, repair path or verifier path. A future authorized phase must add a
 * separate grant-bound launcher; this file remains the zero-call denial proof.
 */
export async function runCandidate12D1(root = process.cwd()) {
  const outputs = await verifyD1Outputs(root)
  const api = await loadD1Api(root)
  await api.denyCandidate12D1Dispatch(outputs.preparedPackage.requests[0].prepared)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.slice(2).length !== 1 || process.argv[2] !== '--dispatch') throw Error('C12_D1_USAGE: --dispatch')
  await runCandidate12D1()
}
