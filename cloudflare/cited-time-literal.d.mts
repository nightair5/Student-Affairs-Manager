export interface CitedTimeLiteralAudit {
  version: 'cited-time-literal-projection-1.0.0'
  inferredFacts: 0
  decisions: Array<{ pointId: string; before: string; after: string; start: number; end: number; evidenceIds: string[]; rule: 'UNIQUE_TIME_LITERAL_INSIDE_OWN_CITATION' }>
}
export const CITED_TIME_LITERAL_VERSION: 'cited-time-literal-projection-1.0.0'
export function projectCitedTimeLiterals<T>(input: T, source: string): { result: T; audit: CitedTimeLiteralAudit }
