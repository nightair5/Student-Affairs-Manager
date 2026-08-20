import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

const root = process.cwd()
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.jsx', '.md', '.mjs', '.ts', '.tsx', '.txt', '.xml', '.yml', '.yaml'])
const ignoredParts = new Set(['.git', 'node_modules', 'coverage'])
const allowedPlaceholder = /example|placeholder|replace[-_ ]?me|your[-_ ]|server-only-test-key|test-key-for-worker-only|test[-_ ]?only|invalid|changeme|<[^>]+>/i
const rules = [
  { name: 'private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'DeepSeek-style API key', pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { name: 'assigned server secret', pattern: /\b(?:DEEPSEEK_API_KEY|CLOUDFLARE_API_TOKEN|FIREBASE_TOKEN|SAM_SYNC_TOKEN|SAM_EMAIL_PROVIDER_TOKEN|E2_R5_BENCHMARK_TOKEN|E2_R5_PATH_MASK_REVEAL_SECRET|E2_R6_BENCHMARK_TOKEN|E2_R6_PATH_MASK_REVEAL_SECRET)\s*[:=]\s*["']?[^\s"']{12,}/i },
  { name: 'service account private key', pattern: /"private_key"\s*:\s*"-----BEGIN/i },
]

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean)
}

function distFiles(directory) {
  if (!existsSync(directory)) return []
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    const relativePath = relative(root, path)
    if (ignoredParts.has(name)) return []
    return statSync(path).isDirectory() ? distFiles(path) : [relativePath]
  })
}

const files = [...new Set([...trackedFiles(), ...distFiles(join(root, 'dist'))])]
const findings = []

for (const file of files) {
  const path = join(root, file)
  if (!existsSync(path) || statSync(path).size > 5 * 1024 * 1024 || !textExtensions.has(extname(path).toLowerCase())) continue
  const lines = readFileSync(path, 'utf8').split(/\r?\n/)
  lines.forEach((line, index) => {
    for (const rule of rules) {
      if (!rule.pattern.test(line)) continue
      if (rule.name !== 'private key' && allowedPlaceholder.test(line)) continue
      findings.push(`${file}:${index + 1} (${rule.name})`)
    }
  })
}

if (findings.length) {
  console.error('Potential secrets detected. Values are intentionally hidden:')
  findings.forEach((finding) => console.error(`- ${finding}`))
  process.exit(1)
}

console.log(`Secret scan passed across ${files.length} source/build files.`)
