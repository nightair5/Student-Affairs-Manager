import { describe, expect, it, vi } from 'vitest'
import { HttpWebMonitorClient, webFetchErrorMessage } from './webMonitorClient'

describe('HttpWebMonitorClient', () => {
  it('sends only the authorized URL and in-memory service token', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ finalUrl: 'https://example.edu/', text: '通知', fetchedAt: 'now' }), { status: 200 }))
    const result = await new HttpWebMonitorClient('http://127.0.0.1:8787/', 'session-token', fetcher as typeof fetch).fetchText('https://example.edu/')
    expect(result.text).toBe('通知')
    expect(fetcher).toHaveBeenCalledWith('http://127.0.0.1:8787/api/web/fetch', expect.objectContaining({
      body: JSON.stringify({ url: 'https://example.edu/' }),
      headers: expect.objectContaining({ authorization: 'Bearer session-token' }),
    }))
  })

  it('explains the disabled server state', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: 'WEB_FETCH_NOT_CONFIGURED' }), { status: 503 }))
    await expect(new HttpWebMonitorClient('/api', 'token', fetcher as typeof fetch).fetchText('https://example.edu'))
      .rejects.toMatchObject({ code: 'WEB_FETCH_NOT_CONFIGURED' })
    try {
      await new HttpWebMonitorClient('/api', 'token', fetcher as typeof fetch).fetchText('https://example.edu')
    } catch (error) {
      expect(webFetchErrorMessage(error)).toContain('尚未启用')
    }
  })
})
