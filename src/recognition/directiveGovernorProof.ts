export const DIRECTIVE_GOVERNOR_PROOF_VERSION = 'directive-governor-proof-1.0.0-rco-5-010-e1' as const

export interface DirectiveGovernorProof {
  policyVersion: typeof DIRECTIVE_GOVERNOR_PROOF_VERSION
  governed: boolean
  markerSurface: string | null
  markerStartInPrefix: number | null
  bridgeSurface: string | null
  proof: 'MULTI_CHARACTER_GOVERNOR' | 'SINGLE_CHARACTER_POSITIVE_GRAMMAR' | 'NOT_PROVEN'
}

const MULTI_CHARACTER_GOVERNOR_RE = /可以自行|可自行|不需要|务必|必须|应当|应该|需要|不得|禁止|无需|不用|可以|自愿|按需|只需|要求/gu
const SINGLE_CHARACTER_GOVERNORS = ['请', '须', '应'] as const
const CLAUSE_BOUNDARY_RE = /[，,。；;！？!?：:]/u
const LEFT_SUBJECT_RE = /^(?:(?:各位|全体|相关)?(?:同学|老师|成员|人员|学生|用户|申请人|参与者|获批者|负责人|联系人)|大家|学院|部门|主办方|承办方|辅导员|系统|平台|服务器|机器人|管理员|供应商)$/u
const BRIDGE_ADDRESSEE_RE = /^(?:你|您|(?:(?:各位|全体|相关)?(?:同学|老师|成员|人员|学生|用户|申请人|参与者|获批者|负责人|联系人))|大家)/u
const BRIDGE_TIME_OR_PLACE_RE = /^(?:于|在|自|从)[^，,。；;！？!?：:\s]{1,12}?(?:前|后|内|时|中|上|下|起)/u
const BRIDGE_MANNER_RE = /^(?:及时|认真地?|仔细地?|尽快|按时|先|再|再次|立即|统一|逐一)/u

export function containsDirectiveGovernorMarker(prefix: string): boolean {
  return [...prefix.matchAll(MULTI_CHARACTER_GOVERNOR_RE)].length > 0
    || SINGLE_CHARACTER_GOVERNORS.some((marker) => prefix.includes(marker))
}

function leftContextIsProvedSubject(value: string): boolean {
  const normalized = value.replace(/\s+/gu, '')
  return normalized.length === 0 || LEFT_SUBJECT_RE.test(normalized)
}

function bridgeIsFullyControlled(value: string): boolean {
  let remaining = value.replace(/\s+/gu, '')
  for (const segment of [BRIDGE_ADDRESSEE_RE, BRIDGE_TIME_OR_PLACE_RE, BRIDGE_MANNER_RE]) {
    const match = remaining.match(segment)
    if (match) remaining = remaining.slice(match[0].length)
  }
  return remaining.length === 0
}

function markerOccurrences(prefix: string, markerSurface: string): Array<{ markerSurface: string; markerStartInPrefix: number }> {
  const occurrences: Array<{ markerSurface: string; markerStartInPrefix: number }> = []
  let markerStartInPrefix = prefix.indexOf(markerSurface)
  while (markerStartInPrefix >= 0) {
    occurrences.push({ markerSurface, markerStartInPrefix })
    markerStartInPrefix = prefix.indexOf(markerSurface, markerStartInPrefix + markerSurface.length)
  }
  return occurrences
}

function positiveGrammarProof(
  prefix: string,
  markers: readonly string[],
  proof: DirectiveGovernorProof['proof'],
): DirectiveGovernorProof | null {
  const candidates = markers
    .flatMap((markerSurface) => markerOccurrences(prefix, markerSurface))
    .sort((left, right) => right.markerStartInPrefix - left.markerStartInPrefix)
  for (const candidate of candidates) {
    const left = prefix.slice(0, candidate.markerStartInPrefix)
    const bridgeSurface = prefix.slice(candidate.markerStartInPrefix + candidate.markerSurface.length)
    if (!leftContextIsProvedSubject(left) || !bridgeIsFullyControlled(bridgeSurface)) continue
    return {
      policyVersion: DIRECTIVE_GOVERNOR_PROOF_VERSION,
      governed: true,
      markerSurface: candidate.markerSurface,
      markerStartInPrefix: candidate.markerStartInPrefix,
      bridgeSurface,
      proof,
    }
  }
  return null
}

export function proveDirectDirectiveGovernor(prefix: string): DirectiveGovernorProof {
  if (CLAUSE_BOUNDARY_RE.test(prefix)) return {
    policyVersion: DIRECTIVE_GOVERNOR_PROOF_VERSION,
    governed: false,
    markerSurface: null,
    markerStartInPrefix: null,
    bridgeSurface: null,
    proof: 'NOT_PROVEN',
  }
  const multiCharacterMarkers = [...new Set([...prefix.matchAll(MULTI_CHARACTER_GOVERNOR_RE)].map((match) => match[0]))]
  return positiveGrammarProof(prefix, multiCharacterMarkers, 'MULTI_CHARACTER_GOVERNOR')
    ?? positiveGrammarProof(prefix, SINGLE_CHARACTER_GOVERNORS, 'SINGLE_CHARACTER_POSITIVE_GRAMMAR')
    ?? {
    policyVersion: DIRECTIVE_GOVERNOR_PROOF_VERSION,
    governed: false,
    markerSurface: null,
    markerStartInPrefix: null,
    bridgeSurface: null,
    proof: 'NOT_PROVEN',
  }
}
