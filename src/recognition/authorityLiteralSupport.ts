import type { WireContext } from '../experiments/realInput01/modelWire'

/** Literal wording may cross punctuation/newline scope boundaries. Every cited
 * scope must contribute to one actual occurrence; unrelated or missing spans
 * cannot acquire support by being concatenated. */
export function hasLiteralScopeSpan(text: string, scopeIds: string[], context: WireContext): boolean {
  const scopes = scopeIds.map(id => context.index.scopes.find(s => s.id === id))
  if (!text.trim() || !scopes.length || scopes.some(s => !s) || new Set(scopeIds).size !== scopeIds.length) return false
  const positions: number[] = [], chars: string[] = []
  for (let i = 0; i < context.index.sourceContent.length; i++) {
    const c = context.index.sourceContent[i]
    if (!/\s/u.test(c)) { chars.push(c); positions.push(i) }
  }
  const source = chars.join(''), literal = text.replace(/\s/gu, '')
  if (!literal) return false
  for (let offset = source.indexOf(literal); offset >= 0; offset = source.indexOf(literal, offset + 1)) {
    const span = positions.slice(offset, offset + literal.length)
    if (scopes.every(s => span.some(p => p >= s!.start && p < s!.end))
      && span.every(p => scopes.some(s => p >= s!.start && p < s!.end))) return true
  }
  return false
}
