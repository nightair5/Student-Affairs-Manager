import { describe, expect, it, vi } from 'vitest'
import { emailJobStatusLabel, HttpEmailClient } from './emailClient'

describe('HttpEmailClient', () => {
  it('keeps service token in the authorization header', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      provider: 'disabled', configured: false, state: 'not-configured',
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    const client = new HttpEmailClient('http://localhost:8787', 'session-only', fetcher)
    await client.status()
    const [url, options] = fetcher.mock.calls[0]
    expect(String(url)).not.toContain('session-only')
    expect((options?.headers as Record<string, string>).authorization).toBe('Bearer session-only')
  })

  it('does not describe blocked jobs as sent', () => {
    expect(emailJobStatusLabel('blocked-not-configured')).toContain('阻塞')
    expect(emailJobStatusLabel('blocked-not-configured')).not.toContain('发送成功')
  })
})
