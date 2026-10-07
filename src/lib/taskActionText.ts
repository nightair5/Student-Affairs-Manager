/** Preserve a complete literal predicate without duplicating its exact object.
 * Partial word overlap is deliberately not shortened. No fact is paraphrased. */
export function taskActionText(action: string, object: string) {
  return object && action.includes(object) ? action : action + object
}
