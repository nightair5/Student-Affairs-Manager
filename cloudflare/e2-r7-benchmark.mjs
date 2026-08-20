import { runE2V4ProBenchmark } from './e2-v4-pro-benchmark.mjs'
import { annotateRecognitionQuality, validateRecognitionQuality } from './recognition-quality.mjs'
import {
  E2_V4_PRO_BENCHMARK_NORMALIZER_VERSION,
  E2_V4_PRO_BENCHMARK_PIPELINE_VERSION,
  E2_V4_PRO_BENCHMARK_PLANNER_VERSION,
  E2_V4_PRO_BENCHMARK_PROMPT_VERSION,
  benchmarkPlannerSystemPrompt,
  normalizeBenchmarkRecognitionResult,
  validateBenchmarkPlannerContract,
} from './e2-v4-pro-benchmark-planner.mjs'

export const E2_R7_PROTOCOL_VERSION = 'e2-9-v4-pro-protocol-3.6.0'
export const E2_R7_BENCHMARK_VERSION = 'e2-v4-pro-benchmark-2.2.0'

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function r7Fetcher(fetcher) {
  return async (url, options = {}) => {
    if (url === 'https://api.deepseek.com/chat/completions' && typeof options.body === 'string') {
      const body = JSON.parse(options.body)
      if (body.max_tokens === 6_000 && Array.isArray(body.messages) && body.messages[0]?.role === 'system') {
        body.messages[0].content = benchmarkPlannerSystemPrompt()
        return fetcher(url, { ...options, body: JSON.stringify(body) })
      }
    }
    return fetcher(url, options)
  }
}

export async function runE2R7Benchmark(request, env, fetcher = fetch) {
  const url = new URL(request.url)
  const generationRequest = url.pathname.endsWith('/generate') && request.method === 'POST'
  const requestBody = generationRequest ? await request.clone().json().catch(() => null) : null
  const baseResponse = await runE2V4ProBenchmark(request, env, r7Fetcher(fetcher))
  if (!generationRequest || baseResponse.status !== 200 || !requestBody) return baseResponse

  const payload = await baseResponse.json()
  let raw
  try { raw = JSON.parse(payload.rawOutput) } catch { return Response.json({ error: 'R7_RAW_OUTPUT_INVALID' }, { status: 502 }) }
  const sourceContent = typeof requestBody.content === 'string' ? requestBody.content.trim().slice(0, 24_000) : ''
  const referenceTime = typeof requestBody.referenceTime === 'string' ? requestBody.referenceTime.trim().slice(0, 80) : ''
  const normalized = normalizeBenchmarkRecognitionResult(raw, sourceContent, referenceTime)
  if (!normalized) return Response.json({ error: 'R7_RESULT_INVALID' }, { status: 502 })
  const plannerIssues = validateBenchmarkPlannerContract(normalized, sourceContent)
  const validation = { ...validateRecognitionQuality(normalized, sourceContent), benchmarkPlannerIssues: plannerIssues }
  const result = {
    ...annotateRecognitionQuality(normalized, validation),
    modelName: payload.execution.returnedModel,
    promptVersion: E2_V4_PRO_BENCHMARK_PROMPT_VERSION,
  }
  const systemPrompt = benchmarkPlannerSystemPrompt()
  return Response.json({
    ...payload,
    benchmarkVersion: E2_R7_BENCHMARK_VERSION,
    result,
    validation,
    execution: {
      ...payload.execution,
      promptVersion: E2_V4_PRO_BENCHMARK_PROMPT_VERSION,
      promptSha256: await sha256(systemPrompt),
      pipelineVersion: E2_V4_PRO_BENCHMARK_PIPELINE_VERSION,
      plannerVersion: E2_V4_PRO_BENCHMARK_PLANNER_VERSION,
      normalizer: E2_V4_PRO_BENCHMARK_NORMALIZER_VERSION,
      resultSha256: await sha256(JSON.stringify(result)),
    },
  }, { headers: { 'cache-control': 'no-store' } })
}
