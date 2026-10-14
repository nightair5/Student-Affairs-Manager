/** Preserve future material status tokens. They are not evidence of readiness. */
export const knownMaterialStatuses=['missing','preparing','ready','submitted','verified','not_required'] as const
export type CompatibleMaterialStatus=typeof knownMaterialStatuses[number] | (string & Record<never,never>)
export function isCompatibleMaterialStatus(value:unknown):value is CompatibleMaterialStatus {
  return typeof value==='string'&&/^[a-z][a-z0-9_]{0,39}$/u.test(value)
}
export function isKnownMaterialStatus(value:string){return knownMaterialStatuses.some(status=>status===value)}
