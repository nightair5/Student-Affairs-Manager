import { defineConfig } from 'vitest/config'

// No .env files, service proxy, paid runner or existing evaluation cache.
export default defineConfig({ envDir: false, test: { cache: false, environment: 'node' } })
