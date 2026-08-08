export const MODEL_GATEWAY_VERSION = 'model-gateway-1.0.0'
export const RECOGNITION_PIPELINE_VERSION = 'recognition-pipeline-2.0.0'

export type ModelOperation = 'recognize' | 'repair' | 'extractFacts'

export interface ModelRequest {
  systemPrompt: string
  userPrompt: string
  maxTokens: number
  temperature: number
}

export interface ModelOperationResult {
  operation: ModelOperation
  ok: boolean
  provider: string
  model: string
  status: number | null
  transportStatus: string
  errorCode: string | null
  content: string | null
  tokenUsage: { input: number; output: number } | null
  durationMs: number
  attempts: number
}

export interface RecognitionModelProvider {
  readonly name: string
  readonly model: string
  recognize(request: ModelRequest): Promise<ModelOperationResult>
  repair(request: ModelRequest): Promise<ModelOperationResult>
  extractFacts(request: ModelRequest): Promise<ModelOperationResult>
}

export type RecognitionTransport = (operation: ModelOperation, request: ModelRequest) => Promise<ModelOperationResult>

export class DeepSeekProvider implements RecognitionModelProvider {
  readonly name = 'deepseek'

  constructor(readonly model: string, private readonly transport: RecognitionTransport) {}

  recognize(request: ModelRequest) { return this.transport('recognize', request) }
  repair(request: ModelRequest) { return this.transport('repair', request) }
  extractFacts(request: ModelRequest) { return this.transport('extractFacts', request) }
}

export class MockRecognitionProvider implements RecognitionModelProvider {
  readonly name = 'mock'
  readonly model = 'mock'
  readonly operations: ModelOperation[] = []

  constructor(private readonly responses: ModelOperationResult[]) {}

  private async next(operation: ModelOperation): Promise<ModelOperationResult> {
    this.operations.push(operation)
    return this.responses.shift() ?? { operation, ok: false, provider: this.name, model: this.model, status: null, transportStatus: 'mock_empty', errorCode: 'MOCK_EMPTY', content: null, tokenUsage: null, durationMs: 0, attempts: 1 }
  }

  recognize() { return this.next('recognize') }
  repair() { return this.next('repair') }
  extractFacts() { return this.next('extractFacts') }
}

export class ModelGateway {
  private readonly operationResults: ModelOperationResult[] = []

  constructor(private readonly provider: RecognitionModelProvider) {}

  private async run(operation: ModelOperation, request: ModelRequest): Promise<ModelOperationResult> {
    const result = await this.provider[operation](request)
    this.operationResults.push(result)
    return result
  }

  recognize(request: ModelRequest) { return this.run('recognize', request) }
  repair(request: ModelRequest) { return this.run('repair', request) }
  extractFacts(request: ModelRequest) { return this.run('extractFacts', request) }

  executionMetadata(versions: Record<string, string>) {
    const knownUsage = this.operationResults.every((item) => item.tokenUsage !== null)
    return {
      gatewayVersion: MODEL_GATEWAY_VERSION,
      pipelineVersion: RECOGNITION_PIPELINE_VERSION,
      provider: this.provider.name,
      model: this.provider.model,
      ...versions,
      attempts: this.operationResults.reduce((sum, item) => sum + item.attempts, 0),
      durationMs: this.operationResults.reduce((sum, item) => sum + item.durationMs, 0),
      tokenUsage: knownUsage
        ? this.operationResults.reduce((total, item) => ({ input: total.input + (item.tokenUsage?.input ?? 0), output: total.output + (item.tokenUsage?.output ?? 0) }), { input: 0, output: 0 })
        : null,
      operations: this.operationResults.map((item) => ({
        operation: item.operation,
        ok: item.ok,
        provider: item.provider,
        model: item.model,
        status: item.status,
        transportStatus: item.transportStatus,
        errorCode: item.errorCode,
        tokenUsage: item.tokenUsage,
        durationMs: item.durationMs,
        attempts: item.attempts,
      })),
    }
  }
}
