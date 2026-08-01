import type { WorkspaceData } from '../types'

export interface ServiceHealth {
  service: string
  status: 'ok'
  capabilities: {
    sync: 'configured' | 'not-configured'
    email: 'configured' | 'not-configured'
    webMonitoring: 'local-compare-only' | 'configured'
    wechat: 'not-connected' | 'configured'
  }
}

export interface RemoteWorkspaceRecord {
  revision: string
  updatedAt: string
  workspace: WorkspaceData
}

export interface PushWorkspaceResult {
  revision: string
  updatedAt: string
  conflictResolved: boolean
}

export class ServiceClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'ServiceClientError'
  }
}

type FetchLike = typeof fetch

async function readResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>
  if (!response.ok) {
    throw new ServiceClientError(
      typeof payload.error === 'string' ? payload.error : 'SERVICE_ERROR',
      typeof payload.message === 'string' ? payload.message : '本地服务请求失败。',
      response.status,
      payload,
    )
  }
  return payload as T
}

export class HttpSyncClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly fetcher: FetchLike = fetch,
  ) {}

  private url(path: string): string {
    return `${this.baseUrl.replace(/\/$/, '')}${path}`
  }

  private authHeaders(): HeadersInit {
    return { authorization: `Bearer ${this.token}` }
  }

  async health(): Promise<ServiceHealth> {
    const response = await this.fetcher(this.url('/api/health'))
    return readResponse<ServiceHealth>(response)
  }

  async pull(): Promise<RemoteWorkspaceRecord> {
    const response = await this.fetcher(this.url('/api/sync/workspace'), {
      headers: this.authHeaders(),
    })
    return readResponse<RemoteWorkspaceRecord>(response)
  }

  async push(
    workspace: WorkspaceData,
    baseRevision?: string,
    resolution: 'fail' | 'replace-remote' = 'fail',
  ): Promise<PushWorkspaceResult> {
    const response = await this.fetcher(this.url('/api/sync/workspace'), {
      method: 'PUT',
      headers: { ...this.authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify({ workspace, baseRevision: baseRevision ?? null, resolution }),
    })
    return readResponse<PushWorkspaceResult>(response)
  }
}

export function syncErrorMessage(error: unknown): string {
  if (!(error instanceof ServiceClientError)) return '无法连接本地服务，请确认服务已启动。'
  const messages: Record<string, string> = {
    SYNC_NOT_CONFIGURED: '服务可达，但服务端尚未配置同步令牌。',
    UNAUTHORIZED: '令牌验证失败；令牌只保留在当前页面内存中。',
    REMOTE_WORKSPACE_EMPTY: '服务端还没有工作区，可先上传本机数据。',
    SYNC_CONFLICT: '远端数据已变化，请选择拉取远端或明确覆盖远端。',
    PAYLOAD_TOO_LARGE: '工作区超过服务端允许的大小。',
    INVALID_WORKSPACE: '服务端拒绝了无效工作区。',
  }
  return messages[error.code] ?? error.message
}
