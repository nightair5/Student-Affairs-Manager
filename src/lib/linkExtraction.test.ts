import { describe, expect, it, vi } from 'vitest'
import { fetchAuthorizedLinkText } from './linkExtraction'

describe('fetchAuthorizedLinkText', () => {
  it('returns bounded server-extracted text', async () => {
    const fetcher = vi.fn(async () => Response.json({
      finalUrl: 'https://notice.example/item',
      title: '学院通知',
      text: '8月10日18:00提交报名表',
      fetchedAt: '2026-08-03T00:00:00.000Z',
    })) as unknown as typeof fetch

    await expect(fetchAuthorizedLinkText('https://notice.example/item', fetcher)).resolves.toMatchObject({
      title: '学院通知',
      text: '8月10日18:00提交报名表',
    })
  })

  it('keeps a clear closed state for hosts outside the allowlist', async () => {
    const fetcher = vi.fn(async () => Response.json(
      { error: 'WEB_HOST_NOT_ALLOWED', message: '这个域名尚未获准读取。' },
      { status: 403 },
    )) as unknown as typeof fetch

    await expect(fetchAuthorizedLinkText('https://blocked.example', fetcher))
      .rejects.toThrow('这个域名尚未获准读取。')
  })
})
