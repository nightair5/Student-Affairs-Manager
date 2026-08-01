import type { KnowledgeCitation } from './knowledge'

export interface DeepSeekRequest {
  question: string
  context: Array<{ title: string; kind: string; excerpt: string }>
}

export interface DeepSeekResponse {
  answer: string
  citations?: KnowledgeCitation[]
}

export interface DeepSeekStatus {
  configured: boolean
}

export interface DeepSeekService {
  status(): Promise<DeepSeekStatus>
  ask(request: DeepSeekRequest): Promise<DeepSeekResponse>
}

export class ProxyDeepSeekService implements DeepSeekService {
  constructor(private readonly endpoint = '/api/deepseek') {}

  async status(): Promise<DeepSeekStatus> {
    try {
      const response = await fetch(`${this.endpoint}/status`)
      if (!response.ok) return { configured: false }
      const data: unknown = await response.json()
      return {
        configured: typeof data === 'object' && data !== null && (data as { configured?: unknown }).configured === true,
      }
    } catch {
      return { configured: false }
    }
  }

  async ask(request: DeepSeekRequest): Promise<DeepSeekResponse> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    if (!response.ok) throw new Error('DeepSeek 服务暂时无法响应')
    const data: unknown = await response.json()
    if (typeof data !== 'object' || data === null || typeof (data as { answer?: unknown }).answer !== 'string') {
      throw new Error('DeepSeek 服务返回了无法识别的结果')
    }
    return data as DeepSeekResponse
  }
}
