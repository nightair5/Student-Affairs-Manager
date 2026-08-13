import path from 'node:path'

const PROTOCOL_VERSION = 'e2-9-v4-pro-protocol-3.3.0'
const DEFAULT_RUN_KEY = 'e29r5-20260813-a'

const RUNS = Object.freeze({
  'e29r5-20260813-a': Object.freeze({
    runId: 'e29r5-run-20260813-a',
    runLabel: 'e29r5-20260813-a',
    seed: 'e2-9-r5-interleave-20260813-a',
    nested: false,
  }),
  'e29r5-20260813-b': Object.freeze({
    runId: 'e29r5-run-20260813-b',
    runLabel: 'e29r5-20260813-b',
    seed: 'e2-9-r5-interleave-20260813-b',
    nested: true,
  }),
})

function option(name, argv) {
  const prefix = `--${name}=`
  return argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? ''
}

export function resolveR5RunContext({ root = process.cwd(), argv = process.argv } = {}) {
  const runKey = option('run', argv) || DEFAULT_RUN_KEY
  const preset = RUNS[runKey]
  if (!preset) throw new Error(`Unsupported R5 run namespace: ${runKey}`)
  const schemaDocs = path.join(root, 'docs', 'e2-v4-pro-benchmark-r5')
  const docs = preset.nested ? path.join(schemaDocs, 'runs', runKey) : schemaDocs
  const protocolCache = path.join(root, '.evaluation-cache', 'e2-9-r5', 'protocol-3.3.0')
  const cache = preset.nested ? path.join(protocolCache, runKey) : protocolCache
  const labels = Object.freeze({
    readiness: `${runKey.replace('e29r5-', 'e29r5-readiness-')}`,
    smoke: `${runKey.replace('e29r5-', 'e29r5-smoke-')}`,
    screening: `${runKey.replace('e29r5-', 'e29r5-screening-')}`,
    scoring: `${runKey.replace('e29r5-', 'e29r5-scoring-')}`,
    adjudication: `${runKey.replace('e29r5-', 'e29r5-adjudication-')}`,
  })
  return Object.freeze({
    protocolVersion: PROTOCOL_VERSION,
    runKey,
    runId: preset.runId,
    runLabel: preset.runLabel,
    seed: preset.seed,
    labels,
    docs,
    schemaDocs,
    cache,
  })
}
