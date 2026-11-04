// The deployed Worker exposes only the handler; worker.mjs keeps named exports
// for deterministic unit tests and offline diagnostics.
export { default } from './worker.mjs'
