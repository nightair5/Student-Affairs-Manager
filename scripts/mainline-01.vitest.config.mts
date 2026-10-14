import { defineConfig } from 'vitest/config'

// No .env files, service proxy, paid runner or existing evaluation cache.
// Node's *.test.mjs suites are run by node --test; Vitest collects TypeScript suites only.
export default defineConfig({ envDir: false, test: { cache: false, environment: 'node', include: ['src/**/*.{test,spec}.{ts,tsx}', 'scripts/**/*.{test,spec}.{ts,tsx}'] } })
