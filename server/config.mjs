import path from 'node:path'

function numberFromEnv(value, fallback) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export function loadServerConfig(env = process.env, cwd = process.cwd()) {
  const syncToken = env.SAM_SYNC_TOKEN?.trim() ?? ''
  const dataDirectory = path.resolve(cwd, env.SAM_DATA_DIR?.trim() || '.data')
  const emailProvider = env.SAM_EMAIL_PROVIDER?.trim() || 'disabled'
  const emailWebhookUrl = env.SAM_EMAIL_WEBHOOK_URL?.trim() || ''
  const emailWebhookToken = env.SAM_EMAIL_WEBHOOK_TOKEN?.trim() || ''
  const emailFrom = env.SAM_EMAIL_FROM?.trim() || ''
  const webAllowedHosts = (env.SAM_WEB_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean)
  const webFetchConfigured = env.SAM_WEB_FETCH_ENABLED === 'true' && webAllowedHosts.length > 0
  const deepSeekApiKey = env.DEEPSEEK_API_KEY?.trim() ?? ''
  const deepSeekApiUrl = env.DEEPSEEK_API_URL?.trim() || 'https://api.deepseek.com/chat/completions'
  const deepSeekModel = env.DEEPSEEK_MODEL?.trim() || 'deepseek-chat'
  const deepSeekConfigured = deepSeekApiKey.length >= 20 && deepSeekApiUrl.startsWith('https://')
  const emailConfigured = emailProvider === 'webhook' && Boolean(
    emailWebhookUrl.startsWith('https://') && emailWebhookToken.length >= 20 && emailFrom,
  )
  return {
    host: env.SAM_SERVICE_HOST?.trim() || '127.0.0.1',
    port: numberFromEnv(env.SAM_SERVICE_PORT, 8787),
    allowedOrigin: env.SAM_ALLOWED_ORIGIN?.trim() || 'http://localhost:4173',
    syncToken,
    syncConfigured: syncToken.length >= 20,
    dataDirectory,
    workspaceFile: path.join(dataDirectory, 'workspace.json'),
    emailQueueFile: path.join(dataDirectory, 'email-queue.json'),
    emailProvider,
    emailWebhookUrl,
    emailWebhookToken,
    emailFrom,
    emailConfigured,
    webAllowedHosts,
    webFetchConfigured,
    deepSeekApiKey,
    deepSeekApiUrl,
    deepSeekModel,
    deepSeekConfigured,
    maxBodyBytes: 2 * 1024 * 1024,
  }
}
