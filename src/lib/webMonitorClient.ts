import { ServiceClientError } from './syncClient'

interface WebFetchResult {
  finalUrl: string
  text: string
  fetchedAt: string
}

type FetchLike = typeof fetch

export class HttpWebMonitorClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly fetcher: FetchLike = fetch,
  ) {}

  async fetchText(url: string): Promise<WebFetchResult> {
    const response = await this.fetcher(`${this.baseUrl.replace(/\/$/, '')}/api/web/fetch`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>
    if (!response.ok) {
      throw new ServiceClientError(
        typeof payload.error === 'string' ? payload.error : 'SERVICE_ERROR',
        typeof payload.message === 'string' ? payload.message : '网页读取请求失败。',
        response.status,
      )
    }
    return payload as unknown as WebFetchResult
  }
}

export function webFetchErrorMessage(error: unknown): string {
  if (!(error instanceof ServiceClientError)) return '无法连接本地服务，请确认服务已启动。'
  const messages: Record<string, string> = {
    SERVICE_AUTH_NOT_CONFIGURED: '服务端访问令牌未配置。',
    UNAUTHORIZED: '令牌验证失败；令牌只保留在当前页面。',
    WEB_FETCH_NOT_CONFIGURED: '服务端网页读取尚未启用；仍可粘贴新版本进行本地比较。',
    WEB_URL_INVALID: '链接格式无效。',
    WEB_HTTPS_REQUIRED: '服务端只读取 HTTPS 链接。',
    WEB_CREDENTIALS_FORBIDDEN: '链接中不得包含用户名或密码。',
    WEB_PRIVATE_ADDRESS_FORBIDDEN: '服务端拒绝读取本机或私有网络地址。',
    WEB_DNS_FAILED: '无法确认目标网页的公网地址。',
    WEB_FETCH_TIMEOUT: '目标网页读取超时，请稍后重试。',
    WEB_PORT_FORBIDDEN: '服务端只读取标准 443 端口的 HTTPS 网页。',
    WEB_REDIRECT_INVALID: '目标站点返回了无效重定向。',
    WEB_REDIRECT_LIMIT: '目标站点重定向次数过多。',
    WEB_FETCH_FAILED: '目标站点读取失败，可能需要登录或限制自动访问。',
    WEB_CONTENT_TYPE_UNSUPPORTED: '目标不是可比较的 HTML 或纯文本。',
    WEB_RESPONSE_TOO_LARGE: '目标内容超过服务端读取上限。',
  }
  return messages[error.code] ?? error.message
}
