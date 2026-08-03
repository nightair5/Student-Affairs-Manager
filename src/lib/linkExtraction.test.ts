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

  it('shows a clear error for targets outside the public HTTPS boundary', async () => {
    const fetcher = vi.fn(async () => Response.json(
      { error: 'WEB_PRIVATE_ADDRESS_FORBIDDEN', message: '不允许读取私网地址。' },
      { status: 400 },
    )) as unknown as typeof fetch

    await expect(fetchAuthorizedLinkText('https://127.0.0.1', fetcher))
      .rejects.toThrow('不允许读取私网地址。')
  })
})
