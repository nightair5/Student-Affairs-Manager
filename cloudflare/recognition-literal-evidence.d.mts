export const LITERAL_EVIDENCE_PROJECTION_VERSION: 'literal-source-citation-projection-1.2.0'
export function resolveLiteralSourceSpan(text: string, source: string): { literal: string; start: number; end: number } | null
export function projectLiteralSourceEvidence<T>(input: T, source: string): { result: T; audit: { version: typeof LITERAL_EVIDENCE_PROJECTION_VERSION; role: string; inferredFacts: 0; decisions: Array<{ evidenceId: string; before: string; after: string; start: number; end: number; rule: string }> } }
