import { describe, expect, it, vi } from 'vitest'
import { HttpSyncClient, ServiceClientError, syncErrorMessage } from './syncClient'
import { createWorkspaceData } from './workspace'

describe('HttpSyncClient', () => {
  it('never places the token in the URL or payload', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      revision: 'r1', updatedAt: 'now', conflictResolved: false,
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    const client = new HttpSyncClient('http://127.0.0.1:8787/', 'session-secret', fetcher)
    await client.push(createWorkspaceData([], []))

    const [url, options] = fetcher.mock.calls[0]
    expect(String(url)).not.toContain('session-secret')
    expect(String(options?.body)).not.toContain('session-secret')
    expect((options?.headers as Record<string, string>).authorization).toBe('Bearer session-secret')
  })

  it('maps server conflict state to an explicit client error', () => {
    expect(syncErrorMessage(new ServiceClientError('SYNC_CONFLICT', 'conflict', 409)))
      .toContain('明确覆盖')
  })
})
