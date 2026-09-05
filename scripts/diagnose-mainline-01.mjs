import { build } from 'esbuild'

// Pure local observation, stdout only. Never loads old data, Expected, runners or credentials.
const output = await build({ entryPoints: ['src/experiments/mainline01/fidelity.ts'], bundle: true,
  write: false, platform: 'node', format: 'esm' })
const module = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`)
const control = await module.observeFidelity(false)
const client = await module.observeFidelity(true)
console.log(JSON.stringify({ kind: 'engineering-fidelity-not-model-accuracy', control, client }, null, 2))
