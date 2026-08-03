export interface LinkExtractionResult {
  finalUrl: string
  title: string
  text: string
  fetchedAt: string
}

interface LinkExtractionErrorPayload {
  error?: unknown
  message?: unknown
}

function errorMessage(payload: LinkExtractionErrorPayload | null, status: number): string {
  if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message
  if (status === 400) return '该链接不是可读取的公网 HTTPS 网页。'
  if (status === 429) return '网页读取请求过于频繁，请稍后再试。'
  if (status === 503) return '网页读取服务暂时不可用。'
  return '网页正文读取失败，请粘贴正文后继续。'
}

export async function fetchAuthorizedLinkText(
  url: string,
  fetcher: typeof fetch = fetch,
): Promise<LinkExtractionResult> {
  const response = await fetcher('/api/source/fetch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ url }),
  })
  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new Error(errorMessage(data as LinkExtractionErrorPayload | null, response.status))
  if (!data || typeof data !== 'object') throw new Error('网页读取服务返回了无法识别的结果。')
  const result = data as Partial<LinkExtractionResult>
  if (
    typeof result.finalUrl !== 'string'
    || typeof result.title !== 'string'
    || typeof result.text !== 'string'
    || !result.text.trim()
    || typeof result.fetchedAt !== 'string'
  ) {
    throw new Error('网页正文为空或格式不受支持，请粘贴正文后继续。')
  }
  return {
    finalUrl: result.finalUrl,
    title: result.title,
    text: result.text,
    fetchedAt: result.fetchedAt,
  }
}
