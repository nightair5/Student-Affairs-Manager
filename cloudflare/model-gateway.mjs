export const MODEL_GATEWAY_VERSION = 'model-gateway-1.0.0'
export const RECOGNITION_PIPELINE_VERSION = 'recognition-pipeline-2.1.2'
export const RECOGNITION_RETRY_POLICY_VERSION = 'recognition-retry-1.0.0'
const RETRYABLE_STATUS = new Set([429, 502, 503])

function usageFrom(payload) {
  if (!Number.isFinite(payload?.usage?.prompt_tokens) || !Number.isFinite(payload?.usage?.completion_tokens)) return null
  return { input: payload.usage.prompt_tokens, output: payload.usage.completion_tokens }
}

export function createDeepSeekProvider({ fetcher, endpoint, apiKey, model, timeoutMs, maxRetries = 1, sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay)), random = Math.random }) {
  const executeAttempt = async (operation, input) => {
    const startedAt = Date.now()
    try {
      const response = await fetcher(endpoint, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          thinking: { type: 'disabled' },
          temperature: input.temperature,
          max_tokens: input.maxTokens,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: input.systemPrompt },
            { role: 'user', content: input.userPrompt },
          ],
        }),
        signal: AbortSignal.timeout(timeoutMs),
      })
      const durationMs = Date.now() - startedAt
      if (!response.ok) return { operation, ok: false, provider: 'deepseek', model, status: response.status, transportStatus: `http_${response.status}`, errorCode: `UPSTREAM_${response.status}`, content: null, tokenUsage: null, durationMs, attempts: 1 }
      const payload = await response.json()
      const content = typeof payload?.choices?.[0]?.message?.content === 'string' ? payload.choices[0].message.content : null
      return { operation, ok: Boolean(content), provider: 'deepseek', model, status: response.status, transportStatus: 'ok', errorCode: content ? null : 'EMPTY_RESPONSE', content, tokenUsage: usageFrom(payload), durationMs, attempts: 1 }
    } catch (error) {
      const timeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
      return { operation, ok: false, provider: 'deepseek', model, status: null, transportStatus: timeout ? 'timeout' : 'network_error', errorCode: timeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_NETWORK_ERROR', content: null, tokenUsage: null, durationMs: Date.now() - startedAt, attempts: 1 }
    }
  }
  const execute = async (operation, input) => {
    const startedAt = Date.now()
    let attempts = 0
    let result
    while (attempts <= maxRetries) {
      attempts += 1
      result = await executeAttempt(operation, input)
      const retryable = !result.ok && (result.status === null || RETRYABLE_STATUS.has(result.status))
      if (!retryable || attempts > maxRetries) break
      const delay = 250 * (2 ** (attempts - 1)) + Math.floor(random() * 100)
      await sleep(delay)
    }
    return { ...result, attempts, durationMs: Date.now() - startedAt }
  }
  return {
    name: 'deepseek', model,
    recognize: (input) => execute('recognize', input),
    repair: (input) => execute('repair', input),
    extractFacts: (input) => execute('extractFacts', input),
  }
}

export function createMockProvider(responses = []) {
  const queue = [...responses]
  const execute = async (operation) => queue.shift() ?? { operation, ok: false, provider: 'mock', model: 'mock', status: null, transportStatus: 'mock_empty', errorCode: 'MOCK_EMPTY', content: null, tokenUsage: null, durationMs: 0, attempts: 1 }
  return { name: 'mock', model: 'mock', recognize: () => execute('recognize'), repair: () => execute('repair'), extractFacts: () => execute('extractFacts') }
}

export function createModelGateway(provider) {
  const operations = []
  const run = async (method, input) => {
    const result = await provider[method](input)
    operations.push(result)
    return result
  }
  return {
    recognize: (input) => run('recognize', input),
    repair: (input) => run('repair', input),
    extractFacts: (input) => run('extractFacts', input),
    executionMetadata(versions) {
      const knownUsage = operations.every((item) => item.tokenUsage !== null)
      return {
        gatewayVersion: MODEL_GATEWAY_VERSION,
        retryPolicyVersion: RECOGNITION_RETRY_POLICY_VERSION,
        pipelineVersion: RECOGNITION_PIPELINE_VERSION,
        provider: provider.name,
        model: provider.model,
        ...versions,
        attempts: operations.reduce((sum, item) => sum + item.attempts, 0),
        durationMs: operations.reduce((sum, item) => sum + item.durationMs, 0),
        tokenUsage: knownUsage ? operations.reduce((total, item) => ({ input: total.input + item.tokenUsage.input, output: total.output + item.tokenUsage.output }), { input: 0, output: 0 }) : null,
        operations: operations.map((item) => ({ operation: item.operation, ok: item.ok, provider: item.provider, model: item.model, status: item.status, transportStatus: item.transportStatus, errorCode: item.errorCode, tokenUsage: item.tokenUsage, durationMs: item.durationMs, attempts: item.attempts })),
      }
    },
  }
}
