import { buildModelRequest, type WireContext } from './modelWire'
import { sha256Text } from './inputReceipt'
import { plainJson } from '../mainline04/semanticContract'

export type ModelExecutor = (context: WireContext) => Promise<string>
export interface PublicCallUnit { unitId: string; requestSha: string }
/** Capability is loopback session authorization, NOT an upstream service credential.
 * Only pre-bound units are sent; no arbitrary body, URL, tool or file field. */
export function createModelClient(config: { origin: string; capability: string; units: PublicCallUnit[] }, transport: typeof fetch = fetch): ModelExecutor {
  const options = plainJson(config), origin = new URL(options.origin)
  if (origin.protocol !== 'http:' || origin.hostname !== '127.0.0.1' || origin.origin !== options.origin
    || !/^[a-f0-9]{64}$/.test(options.capability)) throw Error('REAL_INPUT_CLIENT_CONFIG')
  let busy = false
  const attempted = new Set<string>()
  return async context => {
    if (busy) throw Error('REAL_INPUT_CLIENT_BUSY')
    busy = true
    try {
      const request = await buildModelRequest(context), requestSha = await sha256Text(request.serialized)
      const unit = options.units.find(u => u.requestSha === requestSha && !attempted.has(u.unitId))
      if (!unit) throw Error('本次输入或候选未绑定获准调用单元；未发送模型请求。')
      attempted.add(unit.unitId)
      const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 60000)
      try {
        const response = await transport(options.origin + '/api/real-input/recognize', { method: 'POST', redirect: 'error', cache: 'no-store',
          credentials: 'omit', signal: controller.signal, headers: { 'content-type': 'application/json', 'x-real-input-capability': options.capability },
          body: JSON.stringify({ unitId: unit.unitId, requestSha }) })
        if (!response.ok) throw Error('本次模型请求未完成；未自动重试，未知请求仍保留预算。')
        const value: unknown = await response.json()
        if (!value || typeof value !== 'object' || !('unitId' in value) || value.unitId !== unit.unitId
          || !('requestSha' in value) || value.requestSha !== requestSha || !('rawHttpText' in value)
          || typeof value.rawHttpText !== 'string' || new TextEncoder().encode(value.rawHttpText).length > 524288) throw Error('REAL_INPUT_RESPONSE_BINDING')
        return value.rawHttpText
      } finally { clearTimeout(timeout) }
    } finally { busy = false }
  }
}
