import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const testPath = 'src/recognition/taskFormationB4Dataset.test.ts'
const freezePath = 'docs/recognition-optimization/RCO-5-007-B4_DATA_FREEZE.json'
const outputPath = resolve(root, 'docs/recognition-optimization/RCO-5-007-P2-E1_TYPE_CORRECTION.json')
const beforeFragment = "revisionRefs: []; expectedDefaultSelected: boolean"
const afterFragment = "revisionRefs: ScopeReferenceDirective['revisionRefs']; expectedDefaultSelected: boolean"
const sha = (value) => createHash('sha256').update(value).digest('hex')
const freezeBytes = await readFile(resolve(root, freezePath))
const freeze = JSON.parse(freezeBytes.toString('utf8'))
const afterSource = await readFile(resolve(root, testPath), 'utf8')
if (!afterSource.includes(afterFragment) || afterSource.includes(beforeFragment)) throw new Error('E1_TYPE_PATCH_NOT_EXACT')
const beforeSource = afterSource.replace(afterFragment, beforeFragment)
if (beforeSource === afterSource || beforeSource.includes(afterFragment)) throw new Error('E1_TYPE_PATCH_RECONSTRUCTION_FAILED')
const beforeSourceSha256 = sha(beforeSource)
const afterSourceSha256 = sha(afterSource)
if (beforeSourceSha256 !== freeze.componentSha256[testPath]) throw new Error('E1_RECONSTRUCTED_BEFORE_HASH_MISMATCH')
const transpile = (source) => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, verbatimModuleSyntax: true }, fileName: testPath }).outputText
const beforeJavaScriptSha256 = sha(transpile(beforeSource))
const afterJavaScriptSha256 = sha(transpile(afterSource))
if (beforeJavaScriptSha256 !== afterJavaScriptSha256) throw new Error('E1_RUNTIME_OUTPUT_CHANGED')
const drift = []
for (const path of freeze.componentPaths) {
  const current = sha(await readFile(resolve(root, path)))
  if (current !== freeze.componentSha256[path]) drift.push({ path, frozenSha256: freeze.componentSha256[path], currentSha256: current })
}
if (drift.length !== 1 || drift[0].path !== testPath || drift[0].currentSha256 !== afterSourceSha256) throw new Error(`E1_UNEXPECTED_FROZEN_DRIFT:${JSON.stringify(drift)}`)
const output = { schemaVersion: 'rco-5-007-p2-e1-type-correction-1.0.0', authorizationId: 'RCO-5-007-P2-E1/B5', classification: 'TYPE_ONLY_CORRECTION_ON_SEEN_B4_FIXTURE', recordedAt: '2026-09-04T20:20:00+08:00', originalFreezePath: freezePath, originalFreezeSha256: sha(freezeBytes), correctedPath: testPath, beforeFragment, afterFragment, beforeSourceSha256, afterSourceSha256, beforeJavaScriptSha256, afterJavaScriptSha256, runtimeEquivalent: true, frozenDriftCount: 1, frozenDrift: drift, protectedUnchanged: freeze.componentPaths.filter((path) => path !== testPath), b4Status: 'SEEN_REGRESSION_ONLY', modelCalls: 0, networkRequests: 0, secretAccess: 'NONE' }
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output: outputPath, beforeSourceSha256, afterSourceSha256, runtimeEquivalent: output.runtimeEquivalent, frozenDriftCount: output.frozenDriftCount }))
