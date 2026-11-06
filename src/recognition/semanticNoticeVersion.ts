/** Versions explicitly mapped through the semantic notice adapter. New prompt
 * contracts must opt in here instead of silently falling back to legacy rules. */
const supportedSemanticNoticeVersions = new Set([
  'recognition-semantic-notice-3.0.0',
  'recognition-semantic-notice-3.0.1',
  'recognition-semantic-notice-3.0.2',
  'recognition-semantic-notice-3.0.3',
  'recognition-semantic-notice-3.0.4',
  'recognition-semantic-notice-3.0.5',
  'recognition-semantic-notice-3.1.0',
  'recognition-semantic-notice-3.2.0',
  'recognition-semantic-notice-3.3.0',
  'recognition-semantic-notice-3.4.0',
  'recognition-semantic-notice-3.5.0',
  'recognition-semantic-notice-3.6.0',
  'recognition-semantic-notice-3.7.0',
])

export function isSemanticNoticeVersion(version: string): boolean {
  return supportedSemanticNoticeVersions.has(version)
}
