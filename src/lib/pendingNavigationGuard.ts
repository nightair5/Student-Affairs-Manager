/** Protect changes that have started but have not yet reached durable storage. */
export interface PendingNavigationState {
  writes: number
  taskActions: number
  eventActions: number
  taskDrafts: number
  materialDrafts: number
  eventDrafts: number
}

export function protectPendingNavigation(
  event: Pick<BeforeUnloadEvent, 'preventDefault' | 'returnValue'>,
  state: PendingNavigationState,
): boolean {
  if (!Object.values(state).some((count) => count > 0)) return false
  event.preventDefault()
  event.returnValue = ''
  return true
}
