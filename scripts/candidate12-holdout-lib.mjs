import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'

export const CANDIDATE12_FREEZE_COMMIT = 'c03368054ff8c357f055658c2d2d39b45bbcb761'
export const CANDIDATE12_BUNDLE_SHA = '880488f038cec55763276f525c1847638533fe95d79a64599e9585dc8d92296a'
export const SOURCE_IDS = Array.from({length: 12}, (_, index) => `C12-H${String(index + 1).padStart(2, '0')}`)
export const REQUIRED_COVERAGE = [
  'single_task', 'multi_task', 'condition_true', 'condition_false', 'condition_unknown', 'shared_material',
  'precise_time', 'vague_time', 'completion_standard', 'dependency', 'forbidden_non_task', 'multi_endpoint_revision',
]
export const OVERLAP_THRESHOLD = 0.42
export const AUTHORITY_LEDGER = resolve('C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl')
export const EXPECTED_LEDGER = {
  rows: 693,
  bytes: 572913,
  sha256: '2051d8e775123579c3fa262f671a757e690983f64bc5945d692faaeb24b5322e',
  tail: '13b520d270d26335072f99920e47a4443e8bc586365eb20cda61c4122d7ab3bd',
}

export const sha256 = value => createHash('sha256').update(value).digest('hex')
export const canonicalJson = value => JSON.stringify(sortValue(value))
export const sortValue = value => Array.isArray(value) ? value.map(sortValue) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sortValue(value[key])])) : value
export const normalizeText = value => value.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '')

export function ngrams(value, width = 3) {
  const normalized = normalizeText(value)
  const grams = new Set()
  if (normalized.length < width) { if (normalized) grams.add(normalized); return grams }
  for (let index = 0; index <= normalized.length - width; index++) grams.add(normalized.slice(index, index + width))
  return grams
}

export function jaccard(left, right) {
  const a = ngrams(left), b = ngrams(right)
  if (!a.size && !b.size) return 1
  let intersection = 0
  for (const gram of a) if (b.has(gram)) intersection++
  return intersection / (a.size + b.size - intersection)
}

export function readLedgerState() {
  const bytes = readFileSync(AUTHORITY_LEDGER)
  const rows = bytes.toString('utf8').trimEnd().split('\n').map(JSON.parse)
  return {rows: rows.length, bytes: bytes.length, sha256: sha256(bytes), tail: rows.at(-1).hash}
}

export function detectPersonalData(text) {
  const findings = []
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu.test(text)) findings.push('EMAIL')
  if (/(?:\+?86[- ]?)?1[3-9]\d{9}/u.test(text)) findings.push('PHONE')
  if (/(?:\d{17}[\dXx]|\d{15})/u.test(text)) findings.push('NATIONAL_ID_LIKE')
  if (/\b(?:QQ|微信|群号|学号)\s*[:：]?\s*[A-Za-z0-9_-]{5,}\b/iu.test(text)) findings.push('ACCOUNT_OR_STUDENT_ID_LIKE')
  return findings
}

export function validateAuthorityLedger() {
  const actual = readLedgerState()
  if (canonicalJson(actual) !== canonicalJson(EXPECTED_LEDGER)) throw Error('C12_AUTHORITY_LEDGER_DRIFT')
  return actual
}
