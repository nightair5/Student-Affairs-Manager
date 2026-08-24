import { E2_R10_ENDPOINT_PREFIX, runE2R10Qualification } from './e2-r10-qualification-contract.mjs'

export const E2_R10_QUALIFICATION_WORKER_VERSION = 'e2-r10-qualification-worker-1.1.4'

export default {
  async fetch(request, env) {
    if (!new URL(request.url).pathname.startsWith(E2_R10_ENDPOINT_PREFIX)) {
      return Response.json({ error: 'NOT_FOUND', modelCalls: 0 }, {
        status: 404,
        headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
      })
    }
    return runE2R10Qualification(request, env)
  },
}
