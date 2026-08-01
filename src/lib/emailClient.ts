import { ServiceClientError } from './syncClient'

export type EmailJobStatus =
  | 'queued'
  | 'blocked-not-configured'
  | 'failed'
  | 'failed-final'
  | 'sent'

export interface EmailQueueJob {
  id: string
  taskId: string
  recipient: string
  subject: string
  scheduledAt: string
  status: EmailJobStatus
  attempts: number
  maxAttempts: number
  nextAttemptAt: string
  lastErrorCode?: string
  sentAt?: string
  createdAt: string
  updatedAt: string
}

export interface EmailJobInput {
  recipient: string
  taskId: string
  taskTitle: string
  nextAction: string
  deadline: string
  scheduledAt: string
}

type FetchLike = typeof fetch

async function parse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>
  if (!response.ok) {
    throw new ServiceClientError(
      typeof payload.error === 'string' ? payload.error : 'EMAIL_SERVICE_ERROR',
      typeof payload.message === 'string' ? payload.message : '邮件服务请求失败。',
      response.status,
      payload,
    )
  }
  return payload as T
}

export class HttpEmailClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly fetcher: FetchLike = fetch,
  ) {}

  private url(path: string): string {
    return `${this.baseUrl.replace(/\/$/, '')}${path}`
  }

  private options(method = 'GET', body?: unknown): RequestInit {
    return {
      method,
      headers: {
        authorization: `Bearer ${this.token}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }
  }

  async status(): Promise<{ provider: string; configured: boolean; state: 'configured' | 'not-configured' }> {
    return parse(await this.fetcher(this.url('/api/email/status'), this.options()))
  }

  async jobs(): Promise<EmailQueueJob[]> {
    const result = await parse<{ jobs: EmailQueueJob[] }>(
      await this.fetcher(this.url('/api/email/jobs'), this.options()),
    )
    return result.jobs
  }

  async enqueue(input: EmailJobInput): Promise<EmailQueueJob> {
    const result = await parse<{ job: EmailQueueJob }>(
      await this.fetcher(this.url('/api/email/jobs'), this.options('POST', input)),
    )
    return result.job
  }

  async retry(jobId: string): Promise<EmailQueueJob> {
    const result = await parse<{ job: EmailQueueJob }>(
      await this.fetcher(this.url(`/api/email/jobs/${encodeURIComponent(jobId)}/retry`), this.options('POST')),
    )
    return result.job
  }

  async process(): Promise<EmailQueueJob[]> {
    const result = await parse<{ jobs: EmailQueueJob[] }>(
      await this.fetcher(this.url('/api/email/process'), this.options('POST')),
    )
    return result.jobs
  }
}

export function emailJobStatusLabel(status: EmailJobStatus): string {
  const labels: Record<EmailJobStatus, string> = {
    queued: '等待发送',
    'blocked-not-configured': '因未配置而阻塞',
    failed: '发送失败，可重试',
    'failed-final': '重试已用完',
    sent: '服务端已确认发送',
  }
  return labels[status]
}
