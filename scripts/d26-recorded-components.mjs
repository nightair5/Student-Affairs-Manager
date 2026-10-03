import { build } from 'esbuild'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
export async function recordedComponents() {
  const compiled = await build({ stdin: { contents: "export * from './src/recognition/recordedProjectionD26.ts';export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11.ts';", resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm', target: 'node22' })
  const output = join(mkdtempSync(join(tmpdir(), 'd26-recorded-components-')), 'components.mjs')
  writeFileSync(output, compiled.outputFiles[0].text)
  return import(pathToFileURL(output).href)
}
