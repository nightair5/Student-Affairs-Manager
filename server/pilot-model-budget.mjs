import { AsyncLocalStorage } from 'node:async_hooks'
import { flashInputLimit, flashOutputLimit, flashPeakCostMicroCny, reserveModelCost, settleModelCost } from './pilot-store.mjs'

const endpoint = 'https://api.deepseek.com/chat/completions'
const flashModels = new Set(['deepseek-flash', 'deepseek-v4-flash', 'deepseek-v4-flash-vision-exp'])

function requestOutputLimit(init) {
  try {
    const body = JSON.parse(init?.body)
    if (!flashModels.has(body.model) || !Array.isArray(body.messages) || body.tools !== undefined ||
        body.stream === true || (body.n !== undefined && body.n !== 1) ||
        !Number.isSafeInteger(body.max_tokens) || body.max_tokens < 1 || body.max_tokens > flashOutputLimit) return null
    return body.max_tokens
  } catch {
    return null
  }
}

function observedUpperCost(usage) {
  const input = usage?.prompt_tokens
  const output = usage?.completion_tokens
  if (![input, output].every((value) => Number.isSafeInteger(value) && value >= 0 && value <= 2 * flashInputLimit)) return null
  return flashPeakCostMicroCny(input, output)
}

// The bound is based on the provider's Flash context/output limits and the
// published uncached peak rates. No model request, prompt or key is logged.
export function createPilotModelBudget(file, fetcher) {
  const sessions = new AsyncLocalStorage()
  return {
    withSession: (token, run) => sessions.run(token, run),
    async fetch(input, init) {
      const target = new URL(input)
      if (target.hostname !== 'api.deepseek.com') return fetcher(input, init)
      if (target.href !== endpoint || init?.method !== 'POST') return new Response(null, { status: 403 })

      const maxOutput = requestOutputLimit(init)
      if (maxOutput === null) return new Response(null, { status: 403 })
      let reservation
      try {
        reservation = reserveModelCost(file, sessions.getStore(), flashPeakCostMicroCny(flashInputLimit, maxOutput))
      } catch {
        return new Response(null, { status: 503 })
      }
      if (!reservation) return new Response(null, { status: 429 })

      const response = await fetcher(input, init)
      try {
        const cost = observedUpperCost((await response.clone().json())?.usage)
        if (cost !== null) settleModelCost(file, reservation, cost)
      } catch {
        // A missing receipt keeps the full reservation. Returning the response
        // still lets the existing worker show its own safe error or result.
      }
      return response
    },
  }
}
