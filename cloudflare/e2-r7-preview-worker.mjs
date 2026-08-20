import { runE2R7Benchmark } from './e2-r7-benchmark.mjs'

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname
    if (!path.startsWith('/api/experiments/e2-9/v4-pro-benchmark/')) {
      return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
    }
    return runE2R7Benchmark(request, env)
  },
}
