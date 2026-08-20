import { E2_R7_BENCHMARK_VERSION, E2_R7_PROTOCOL_VERSION, runE2R7Benchmark } from './e2-r7-benchmark.mjs'

function contractResponse(request, env) {
  const url = new URL(request.url)
  if (env.E2_V4_PRO_BENCHMARK_ENABLED !== 'true' || !url.hostname.includes('preview')) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
  if ((request.headers.get('origin') ?? '') !== url.origin) return Response.json({ error: 'ORIGIN_NOT_ALLOWED' }, { status: 403 })
  const expected = typeof env.E2_V4_PRO_BENCHMARK_TOKEN === 'string' ? env.E2_V4_PRO_BENCHMARK_TOKEN.trim() : ''
  if (expected.length < 32 || request.headers.get('authorization') !== `Bearer ${expected}`) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const deploymentVersion = typeof env.CF_VERSION_METADATA?.id === 'string' ? env.CF_VERSION_METADATA.id : ''
  if (!/^[a-f0-9-]{36}$/u.test(deploymentVersion)) return Response.json({ error: 'DEPLOYMENT_VERSION_UNAVAILABLE' }, { status: 503 })
  return Response.json({ protocolVersion: E2_R7_PROTOCOL_VERSION, benchmarkVersion: E2_R7_BENCHMARK_VERSION, deploymentVersion, enabled: true, modelCalls: 0 }, { headers: { 'cache-control': 'no-store' } })
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname
    if (path.endsWith('/contract')) {
      if (request.method !== 'GET') return Response.json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 })
      return contractResponse(request, env)
    }
    if (!path.startsWith('/api/experiments/e2-9/v4-pro-benchmark/')) {
      return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
    }
    return runE2R7Benchmark(request, env)
  },
}
