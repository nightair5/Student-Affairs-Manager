import type { KnowledgeCitation } from './knowledge'

export interface DeepSeekRequest {
  question: string
  context: Array<{ title: string; kind: string; excerpt: string }>
}

export interface DeepSeekResponse {
  answer: string
  citations?: KnowledgeCitation[]
}

export interface DeepSeekService {
  status(): Promise<{ configured: boolean }>
  ask(request: DeepSeekRequest): Promise<DeepSeekResponse>
}

function errorMessage(value: unknown, fallback: string): string {
  if (typeof value !== 'object' || value === null) return fallback
  const message = (value as { message?: unknown }).message
  return typeof message === 'string' && message.trim() ? message : fallback
}

export class ProxyDeepSeekService implements DeepSeekService {
  constructor(private readonly endpoint = '/api/deepseek') {}

  async status(): Promise<{ configured: boolean }> {
    try {
      const response = await fetch(`${this.endpoint}/status`, { headers: { Accept: 'application/json' } })
      if (!response.ok) return { configured: false }
      const data: unknown = await response.json()
      return { configured: typeof data === 'object' && data !== null && (data as { configured?: unknown }).configured === true }
    } catch {
      return { configured: false }
    }
  }

  async ask(request: DeepSeekRequest): Promise<DeepSeekResponse> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(request),
    })
    const data: unknown = await response.json().catch(() => null)
    if (!response.ok) throw new Error(errorMessage(data, 'DeepSeek 服务暂时无法响应'))
    if (typeof data !== 'object' || data === null || typeof (data as { answer?: unknown }).answer !== 'string') {
      throw new Error('DeepSeek 服务返回了无法识别的结果')
    }
    return data as DeepSeekResponse
  }
}
