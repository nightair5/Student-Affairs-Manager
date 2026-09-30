export const D22_PENDING_READBACK_KEY = 'd22-pending-readback'

export interface PendingReadback {
  version: 'd22-pending-readback-1'
  id: string
  commits: Array<{ draftId: string; commitId: string; operationIds: string[]; disposition?: 'confirmed' | 'partial' | 'no_task' }>
}

export class CommittedReadbackPendingError extends Error {
  constructor() {
    super('已提交，读回尚未验证；请重新读回，勿重复提交。')
    this.name = 'CommittedReadbackPendingError'
  }
}
