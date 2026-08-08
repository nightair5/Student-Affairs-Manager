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
})
