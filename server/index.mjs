import { createServer } from 'node:http'
import { createRequestHandler } from './app.mjs'
import { loadServerConfig } from './config.mjs'
import { FileWorkspaceStore } from './workspace-store.mjs'
import { createEmailProvider, FileEmailQueue } from './email-service.mjs'
import { createWebFetcher } from './web-fetch-service.mjs'

const config = loadServerConfig()
const store = new FileWorkspaceStore(config.workspaceFile)
const emailQueue = new FileEmailQueue(config.emailQueueFile)
const emailProvider = createEmailProvider(config)
const webFetcher = createWebFetcher(config)
const server = createServer(createRequestHandler(config, store, emailQueue, emailProvider, webFetcher))

const emailTimer = setInterval(() => {
  void emailQueue.processDue(emailProvider).catch(() => undefined)
}, 30_000)
emailTimer.unref()

server.listen(config.port, config.host, () => {
  const syncState = config.syncConfigured ? 'configured' : 'not configured'
  console.log(`Student Affairs local service: http://${config.host}:${config.port} (sync ${syncState})`)
})
