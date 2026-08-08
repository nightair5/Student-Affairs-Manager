import { describe, expect, it } from 'vitest'
import { DeepSeekProvider, MockRecognitionProvider, ModelGateway, type ModelOperationResult } from './modelGateway'

function result(operation: ModelOperationResult['operation'], usage: ModelOperationResult['tokenUsage']): ModelOperationResult {
  return { operation, ok: true, provider: 'mock', model: 'mock', status: 200, transportStatus: 'ok', errorCode: null, content: '{}', tokenUsage: usage, durationMs: 12, attempts: 1 }
}

describe('Recognition ModelGateway', () => {
  it('routes recognition, repair and fact extraction through a replaceable provider', async () => {
    const provider = new MockRecognitionProvider([result('recognize', { input: 10, output: 20 }), result('repair', { input: 30, output: 40 }), result('extractFacts', { input: 5, output: 8 })])
    const gateway = new ModelGateway(provider)
    const request = { systemPrompt: 'system', userPrompt: 'data', maxTokens: 100, temperature: 0 }
    await gateway.recognize(request)
    await gateway.repair(request)
    await gateway.extractFacts(request)
    expect(provider.operations).toEqual(['recognize', 'repair', 'extractFacts'])
    expect(gateway.executionMetadata({ promptVersion: 'test' })).toMatchObject({ attempts: 3, durationMs: 36, tokenUsage: { input: 45, output: 68 } })
  })

  it('keeps token usage null unless every provider operation reports real usage', async () => {
    const provider = new MockRecognitionProvider([result('recognize', null)])
    const gateway = new ModelGateway(provider)
    await gateway.recognize({ systemPrompt: '', userPrompt: '', maxTokens: 1, temperature: 0 })
    expect(gateway.executionMetadata({}).tokenUsage).toBeNull()
  })

  it('keeps DeepSeek transport injected so browser code never owns a key', async () => {
    const calls: string[] = []
    const provider = new DeepSeekProvider('deepseek-v4-flash', async (operation) => {
      calls.push(operation)
      return { ...result(operation, null), provider: 'deepseek', model: 'deepseek-v4-flash' }
    })
    await new ModelGateway(provider).recognize({ systemPrompt: '', userPrompt: '', maxTokens: 1, temperature: 0 })
    expect(calls).toEqual(['recognize'])
  })

  it('retries retryable transport failures once with deterministic backoff', async () => {
    const calls: number[] = []
    const delays: number[] = []
    const provider = new DeepSeekProvider('deepseek-v4-flash', async (operation) => {
      calls.push(calls.length + 1)
      if (calls.length === 1) return { ...result(operation, null), ok: false, status: 503, transportStatus: 'http_503', errorCode: 'UPSTREAM_503', content: null }
      return { ...result(operation, { input: 10, output: 5 }), provider: 'deepseek', model: 'deepseek-v4-flash' }
    }, { maxRetries: 1, sleep: async (delay) => { delays.push(delay) }, random: () => 0 })
    const operation = await provider.recognize({ systemPrompt: '', userPrompt: '', maxTokens: 1, temperature: 0 })
    expect(calls).toHaveLength(2)
    expect(delays).toEqual([250])
    expect(operation).toMatchObject({ ok: true, attempts: 2 })
  })

  it('does not retry invalid 400 requests or successful semantic output', async () => {
    let calls = 0
    const provider = new DeepSeekProvider('deepseek-v4-flash', async (operation) => {
      calls += 1
      return { ...result(operation, null), ok: false, status: 400, transportStatus: 'http_400', errorCode: 'UPSTREAM_400', content: null }
    })
    const operation = await provider.recognize({ systemPrompt: '', userPrompt: '', maxTokens: 1, temperature: 0 })
    expect(calls).toBe(1)
    expect(operation.attempts).toBe(1)
  })
})
