import { defineSecret } from 'firebase-functions/params'
import { onRequest } from 'firebase-functions/v2/https'
import { createDeepSeekHandler } from './deepseek-handler.mjs'

const deepSeekApiKey = defineSecret('DEEPSEEK_API_KEY')
const handler = createDeepSeekHandler({ getApiKey: () => deepSeekApiKey.value() })

export const deepseek = onRequest({
  region: 'asia-east1',
  secrets: [deepSeekApiKey],
  timeoutSeconds: 60,
  memory: '256MiB',
  maxInstances: 1,
  concurrency: 20,
}, handler)
