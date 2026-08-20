import { runE2R6Harness } from './e2-r6-harness.mjs'

const PREFIX = '/api/experiments/e2-9/r6/harness/'

export default {
  async fetch(request, env) {
    if (!new URL(request.url).pathname.startsWith(PREFIX)) {
      return Response.json({ error: 'NOT_FOUND' }, { status: 404, headers: { 'cache-control': 'no-store' } })
    }
    return runE2R6Harness(request, env)
  },
}
