import { createServer } from 'node:http'
import { createRequestHandler } from './app.mjs'
import { loadServerConfig } from './config.mjs'
import { FileWorkspaceStore } from './workspace-store.mjs'

const config = loadServerConfig()
const store = new FileWorkspaceStore(config.workspaceFile)
const server = createServer(createRequestHandler(config, store))

server.listen(config.port, config.host, () => {
  const syncState = config.syncConfigured ? 'configured' : 'not configured'
  console.log(`Student Affairs local service: http://${config.host}:${config.port} (sync ${syncState})`)
})
