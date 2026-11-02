/** Versions explicitly mapped through the semantic notice adapter. New prompt
 * contracts must opt in here instead of silently falling back to legacy rules. */
const supportedSemanticNoticeVersions = new Set([
  'recognition-semantic-notice-3.0.0',
  'recognition-semantic-notice-3.0.1',
  'recognition-semantic-notice-3.0.2',
  'recognition-semantic-notice-3.0.3',
  'recognition-semantic-notice-3.0.4',
])

export function isSemanticNoticeVersion(version: string): boolean {
  return supportedSemanticNoticeVersions.has(version)
}
