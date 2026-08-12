import {
  RECOGNITION_PROMPT_VERSION,
  RECOGNITION_SCHEMA_VERSION,
  normalizeRecognitionResult,
  recognitionSystemPrompt,
} from './recognition.mjs'
import {
  RECOGNITION_VALIDATOR_VERSION,
  annotateRecognitionQuality,
  validateRecognitionQuality,
} from './recognition-quality.mjs'
import { RECOGNITION_PIPELINE_VERSION } from './model-gateway.mjs'

export const E2_V4_PRO_BENCHMARK_VERSION = 'e2-v4-pro-benchmark-1.0.0'
export const E2_V4_PRO_BENCHMARK_PROMPT_SHA256 = 'c925f1dc27971e4fcaf7ad185b729f016fa7af966cd7992337d9eaa94c97e6fd'
export const E2_V4_PRO_BENCHMARK_MAX_TOKENS = 6_000

const CHAT_COMPLETIONS_ENDPOINT = 'https://api.deepseek.com/chat/completions'
const MODELS_ENDPOINT = 'https://api.deepseek.com/models'
const TIMEOUT_MS = 45_000
const MAX_BODY_BYTES = 100_000
const RETRYABLE_STATUS = new Set([429, 502, 503])
const REQUEST_FIELDS = new Set(['modelAlias', 'sourceType', 'sourceTitle', 'content', 'referenceTime', 'timezone'])
const MODEL_BY_ALIAS = Object.freeze({ flash: 'deepseek-v4-flash', pro: 'deepseek-v4-pro' })

function safeText(value, limit) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, '').trim().slice(0, limit)
    : ''
}

function json(value, status = 200) {
  return Response.json(value, { status, headers: { 'cache-control': 'no-store' } })
}

function failure(error, status, details = {}) {
  return json({ error, ...details }, status)
}

function onlyFields(value, fields) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
    && Object.keys(value).every((key) => fields.has(key))
}

function isPreviewAuthorized(request, env) {
  const url = new URL(request.url)
  if (env.E2_V4_PRO_BENCHMARK_ENABLED !== 'true' || !url.hostname.includes('preview')) return 'NOT_FOUND'
  const origin = request.headers.get('origin') ?? ''
  if (origin !== url.origin) return 'ORIGIN_NOT_ALLOWED'
  const expected = safeText(env.E2_V4_PRO_BENCHMARK_TOKEN, 512)
  const supplied = safeText(request.headers.get('authorization'), 600)
  if (expected.length < 32 || supplied !== `Bearer ${expected}`) return 'UNAUTHORIZED'
  if (safeText(env.DEEPSEEK_API_KEY, 512).length < 20) return 'DEEPSEEK_NOT_CONFIGURED'
  return null
}

function validateRequest(body) {
  if (!onlyFields(body, REQUEST_FIELDS)) return 'GENERATION_FIREWALL_REJECTED'
  if (!Object.hasOwn(MODEL_BY_ALIAS, body.modelAlias)) return 'MODEL_ALIAS_INVALID'
  if (!['text', 'file', 'image', 'link'].includes(body.sourceType)) return 'SOURCE_TYPE_INVALID'
  if (typeof body.content !== 'string' || !body.content.trim() || body.content.length > 24_000) return 'CONTENT_INVALID'
  if (body.sourceTitle !== undefined && (typeof body.sourceTitle !== 'string' || body.sourceTitle.length > 160)) return 'SOURCE_TITLE_INVALID'
  if (typeof body.referenceTime !== 'string' || body.referenceTime.length > 80 || Number.isNaN(new Date(body.referenceTime).getTime())) return 'REFERENCE_TIME_INVALID'
  if (body.timezone !== undefined && (typeof body.timezone !== 'string' || body.timezone.length > 80)) return 'TIMEZONE_INVALID'
  return null
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function usageFrom(payload) {
  const prompt = payload?.usage?.prompt_tokens
  const completion = payload?.usage?.completion_tokens
  const total = payload?.usage?.total_tokens
  if (![prompt, completion, total].every(Number.isFinite)) return null
  return { input: prompt, output: completion, total }
}

function retryAfterMs(response) {
  if (response.status !== 429) return null
  const raw = response.headers.get('retry-after')
  if (!raw) return null
  const seconds = Number(raw)
  if (Number.isFinite(seconds)) return Math.max(0, Math.min(30_000, seconds * 1_000))
  const date = Date.parse(raw)
  return Number.isNaN(date) ? null : Math.max(0, Math.min(30_000, date - Date.now()))
}

async function callChat({ fetcher, apiKey, model, systemPrompt, userPrompt, maxTokens, sleep }) {
  const attempts = []
  const startedAt = Date.now()
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const attemptStartedAt = Date.now()
    try {
      const response = await fetcher(CHAT_COMPLETIONS_ENDPOINT, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          thinking: { type: 'disabled' },
          temperature: 0,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
          stream: false,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      const durationMs = Date.now() - attemptStartedAt
      if (!response.ok) {
        attempts.push({ attempt, status: response.status, transportStatus: `http_${response.status}`, durationMs })
        if (attempt < 2 && RETRYABLE_STATUS.has(response.status)) {
          await sleep(retryAfterMs(response) ?? 250)
          continue
        }
        return { ok: false, error: `UPSTREAM_${response.status}`, status: response.status, attempts, durationMs: Date.now() - startedAt }
      }
      const payload = await response.json()
      const content = typeof payload?.choices?.[0]?.message?.content === 'string' ? payload.choices[0].message.content : ''
      const returnedModel = safeText(payload?.model, 100)
      const systemFingerprint = safeText(payload?.system_fingerprint, 200)
      const finishReason = safeText(payload?.choices?.[0]?.finish_reason, 80)
      const usage = usageFrom(payload)
      attempts.push({ attempt, status: response.status, transportStatus: 'ok', durationMs })
      if (!content) return { ok: false, error: 'EMPTY_RESPONSE', status: 502, attempts, durationMs: Date.now() - startedAt }
      if (returnedModel !== model) return { ok: false, error: 'MODEL_FALLBACK_DETECTED', status: 502, requestedModel: model, returnedModel, attempts, durationMs: Date.now() - startedAt }
      if (!systemFingerprint) return { ok: false, error: 'SYSTEM_FINGERPRINT_MISSING', status: 502, requestedModel: model, returnedModel, attempts, durationMs: Date.now() - startedAt }
      if (!usage) return { ok: false, error: 'TOKEN_USAGE_MISSING', status: 502, requestedModel: model, returnedModel, systemFingerprint, attempts, durationMs: Date.now() - startedAt }
      return { ok: true, content, requestedModel: model, returnedModel, systemFingerprint, finishReason, usage, attempts, durationMs: Date.now() - startedAt }
    } catch (error) {
      const durationMs = Date.now() - attemptStartedAt
      const timeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
      attempts.push({ attempt, status: null, transportStatus: timeout ? 'timeout' : 'network_error', durationMs })
      if (attempt < 2) {
        await sleep(250)
        continue
      }
      return { ok: false, error: timeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_NETWORK_ERROR', status: timeout ? 504 : 502, attempts, durationMs: Date.now() - startedAt }
    }
  }
  return { ok: false, error: 'UPSTREAM_UNAVAILABLE', status: 502, attempts, durationMs: Date.now() - startedAt }
}

async function handleModels(env, fetcher, sleep) {
  const modelsResponse = await fetcher(MODELS_ENDPOINT, {
    method: 'GET',
    headers: { authorization: `Bearer ${env.DEEPSEEK_API_KEY}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!modelsResponse.ok) return failure(`MODELS_UPSTREAM_${modelsResponse.status}`, 502)
  const modelsPayload = await modelsResponse.json()
  const modelIds = Array.isArray(modelsPayload?.data)
    ? modelsPayload.data.map((item) => safeText(item?.id, 100)).filter(Boolean)
    : []
  const requiredModels = Object.values(MODEL_BY_ALIAS)
  if (!requiredModels.every((model) => modelIds.includes(model))) {
    return failure('REQUIRED_MODELS_UNAVAILABLE', 412, { requiredModels, availableRequiredModels: requiredModels.filter((model) => modelIds.includes(model)) })
  }
  const compatibility = await callChat({
    fetcher,
    apiKey: env.DEEPSEEK_API_KEY,
    model: MODEL_BY_ALIAS.pro,
    systemPrompt: 'Return one JSON object only. Do not include personal or user data.',
    userPrompt: 'Return {"ok":true}.',
    maxTokens: 32,
    sleep,
  })
  if (!compatibility.ok) return failure(compatibility.error, compatibility.status ?? 502, { compatibility })
  let parsed
  try { parsed = JSON.parse(compatibility.content) } catch { return failure('MINIMUM_PRO_JSON_INVALID', 502) }
  return json({
    benchmarkVersion: E2_V4_PRO_BENCHMARK_VERSION,
    requiredModels,
    availableRequiredModels: requiredModels,
    compatibility: {
      requestedModel: compatibility.requestedModel,
      returnedModel: compatibility.returnedModel,
      systemFingerprint: compatibility.systemFingerprint,
      finishReason: compatibility.finishReason,
      usage: compatibility.usage,
      attempts: compatibility.attempts,
      durationMs: compatibility.durationMs,
      validJsonObject: Boolean(parsed && typeof parsed === 'object' && !Array.isArray(parsed)),
      rawOutputSha256: await sha256(compatibility.content),
    },
  })
}

async function handleGenerate(request, env, fetcher, sleep) {
  if (!/^application\/json(?:\s*;|$)/iu.test(request.headers.get('content-type') ?? '')) return failure('INVALID_CONTENT_TYPE', 415)
  const declaredSize = Number(request.headers.get('content-length'))
  if (Number.isFinite(declaredSize) && declaredSize > MAX_BODY_BYTES) return failure('INPUT_TOO_LARGE', 413)
  const rawBody = await request.text()
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) return failure('INPUT_TOO_LARGE', 413)
  let body
  try { body = JSON.parse(rawBody) } catch { return failure('INVALID_REQUEST', 400) }
  const validationError = validateRequest(body)
  if (validationError) return failure(validationError, 400)

  const sourceContent = safeText(body.content, 24_000)
  const sourceTitle = safeText(body.sourceTitle, 160)
  const referenceTime = safeText(body.referenceTime, 80)
  const timezone = safeText(body.timezone, 80) || 'Asia/Shanghai'
  const model = MODEL_BY_ALIAS[body.modelAlias]
  const systemPrompt = recognitionSystemPrompt()
  const userPrompt = `参考时间：${referenceTime}\n时区：${timezone}\n来源类型：${body.sourceType}\n来源标题：${sourceTitle || '未提供'}\n可选已有项目（仅供匹配建议）：[]\n已有未完成任务（仅供重复检测）：[]\n来源正文：\n${sourceContent}`
  const completion = await callChat({ fetcher, apiKey: env.DEEPSEEK_API_KEY, model, systemPrompt, userPrompt, maxTokens: E2_V4_PRO_BENCHMARK_MAX_TOKENS, sleep })
  if (!completion.ok) return failure(completion.error, completion.status ?? 502, { execution: completion })

  let parsed
  try { parsed = JSON.parse(completion.content) } catch { return failure('INVALID_AI_RESPONSE_JSON', 502, { execution: completion }) }
  const normalized = normalizeRecognitionResult(parsed, sourceContent, referenceTime)
  if (!normalized) return failure('INVALID_AI_RESPONSE_SCHEMA', 502, { execution: completion })
  const validation = validateRecognitionQuality(normalized, sourceContent)
  const result = annotateRecognitionQuality(normalized, validation)
  return json({
    benchmarkVersion: E2_V4_PRO_BENCHMARK_VERSION,
    rawOutput: completion.content,
    result,
    validation,
    execution: {
      provider: 'deepseek',
      requestedModel: completion.requestedModel,
      returnedModel: completion.returnedModel,
      systemFingerprint: completion.systemFingerprint,
      finishReason: completion.finishReason,
      tokenUsage: completion.usage,
      attempts: completion.attempts,
      durationMs: completion.durationMs,
      promptVersion: RECOGNITION_PROMPT_VERSION,
      promptSha256: E2_V4_PRO_BENCHMARK_PROMPT_SHA256,
      schemaVersion: RECOGNITION_SCHEMA_VERSION,
      pipelineVersion: RECOGNITION_PIPELINE_VERSION,
      validatorVersion: RECOGNITION_VALIDATOR_VERSION,
      router: 'BYPASSED',
      repair: 'DISABLED',
      normalizer: 'DISABLED',
      temperature: 0,
      maxTokens: E2_V4_PRO_BENCHMARK_MAX_TOKENS,
      thinking: 'disabled',
      sourceSha256: await sha256(sourceContent),
      rawOutputSha256: await sha256(completion.content),
      resultSha256: await sha256(JSON.stringify(result)),
    },
  })
}

export async function runE2V4ProBenchmark(request, env, fetcher = fetch, sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay))) {
  const authorizationError = isPreviewAuthorized(request, env)
  if (authorizationError === 'NOT_FOUND') return failure(authorizationError, 404)
  if (authorizationError === 'ORIGIN_NOT_ALLOWED') return failure(authorizationError, 403)
  if (authorizationError === 'UNAUTHORIZED') return failure(authorizationError, 401)
  if (authorizationError) return failure(authorizationError, 503)

  const path = new URL(request.url).pathname
  if (path.endsWith('/models')) {
    if (request.method !== 'GET') return failure('METHOD_NOT_ALLOWED', 405)
    return handleModels(env, fetcher, sleep)
  }
  if (path.endsWith('/generate')) {
    if (request.method !== 'POST') return failure('METHOD_NOT_ALLOWED', 405)
    return handleGenerate(request, env, fetcher, sleep)
  }
  return failure('NOT_FOUND', 404)
}
