import type { WorkspaceRecordStore } from '../../domain/v2/repository'
import type { WorkspaceV8 } from '../../domain/v2/types'
import { stableJson } from '../mainline04/semanticContract'

export const D20_SESSION_VERSION = 'd20-review-session-1' as const
export type ReviewField = {
  base: unknown
  mine: unknown
  writer: string
  updatedAt: string
  revision: string
  editId?: string
  conflict?: { latest: unknown; incoming: unknown; incomingWriter: string; incomingEditId?: string }
}
export type ReviewSession = {
  version: typeof D20_SESSION_VERSION
  draftId: string
  sourceId: string
  sourceVersionId: string
  runId: string
  fields: Record<string, ReviewField>
  history: Array<{ id: string; at: string; kind: 'stage' | 'recover' | 'resolve' | 'clear'; field: string; writer: string; editId?: string }>
}

const keyOf = (draftId: string) => `d20-review-session:${draftId}`
const same = (a: unknown, b: unknown) => stableJson(a ?? null) === stableJson(b ?? null)

function identity(workspace: WorkspaceV8, draftId: string) {
  const draft = workspace.extractionDrafts.find(item => item.id === draftId)
  const run = workspace.recognitionRuns.find(item => item.id === draft?.recognitionRunId)
  const version = workspace.sourceVersions.find(item => item.id === run?.sourceVersionId)
  const source = workspace.sources.find(item => item.id === version?.sourceId)
  if (!draft || !run || !source || !run.sourceVersionId || source.currentVersionId !== run.sourceVersionId) throw Error('D20_SOURCE_VERSION_CONFLICT')
  return { draftId, runId: run.id, sourceId: source.id, sourceVersionId: run.sourceVersionId }
}

function parse(raw: unknown, expected: ReturnType<typeof identity>): ReviewSession {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('D20_SESSION_INVALID')
  const session = raw as ReviewSession
  if (session.version !== D20_SESSION_VERSION || session.draftId !== expected.draftId || session.runId !== expected.runId
    || session.sourceId !== expected.sourceId || session.sourceVersionId !== expected.sourceVersionId
    || !session.fields || typeof session.fields !== 'object' || !Array.isArray(session.history)) throw Error('D20_SESSION_IDENTITY_CONFLICT')
  return session
}

/** Unconfirmed UI input lives beside `current` in the same isolated repository store.
 * It is never a WorkspaceV8 fact and cannot create a Task/Project. Every edit is CAS-merged per field. */
export class D20ReviewSessionRepository {
  readonly writer = crypto.randomUUID()
  constructor(private readonly store: WorkspaceRecordStore & { name: string }, private readonly recordEdit?: (draftId:string,field:string)=>Promise<string>) {
    if (!/^rco-mainline-01-02-i1-real-input-d2[01]-review-session-p[1-9][0-9]{0,2}$/.test(store.name)) throw Error('D20_ISOLATED_DATABASE_REQUIRED')
  }
  async load(workspace: WorkspaceV8, draftId: string): Promise<ReviewSession> {
    const id = identity(workspace, draftId)
    const raw = await this.store.read(keyOf(draftId))
    return raw === undefined ? { version: D20_SESSION_VERSION, ...id, fields: {}, history: [] } : parse(raw, id)
  }
  private async mutate(workspace: WorkspaceV8, draftId: string, change: (session: ReviewSession) => ReviewSession) {
    const id = identity(workspace, draftId)
    const key = keyOf(draftId)
    const result = await this.store.transactionMany(['current', key], records => {
      const latest = records.get('current') as WorkspaceV8 | undefined
      if(this.store.name.includes('d21-review-session-')&&!latest)throw Error('D21_CANONICAL_SOURCE_MISSING')
      if (latest) {
        const actual = identity(latest, draftId)
        if (stableJson(actual) !== stableJson(id)) throw Error('D20_SOURCE_VERSION_CONFLICT')
      }
      const raw = records.get(key)
      records.set(key, change(raw === undefined
        ? { version: D20_SESSION_VERSION, ...id, fields: {}, history: [] } : parse(raw, id)))
      // IsolatedTestStore treats an omitted key as deletion. Keep the canonical
      // read-set member byte-for-byte identical while committing the checkpoint.
      return records
    })
    return parse(result.get(key), id)
  }
  async stage(workspace: WorkspaceV8, draftId: string, field: string, base: unknown, mine: unknown, writer: string) {
    if (field.length>1024||!/^(task:.+:(title|deadline|facts)|event:.+:.+|time:.+:.+|relation:.+|material:.+:.+)$/.test(field)) throw Error('D20_FIELD_KEY_INVALID')
    if (!writer || writer.length > 100) throw Error('D20_FIELD_WRITER_INVALID')
    if (stableJson(mine).length > 100_000) throw Error('D20_FIELD_VALUE_TOO_LARGE')
    const observed=(await this.load(workspace,draftId)).fields[field]
    const editId=observed?.writer===writer?observed.editId:await this.recordEdit?.(draftId,field)
    return this.mutate(workspace, draftId, session => {
      const previous = session.fields[field], at = new Date().toISOString()
      if (previous?.conflict) throw Error('D20_FIELD_CONFLICT_UNRESOLVED')
      if (previous && (!same(previous.base, base) || previous.writer !== writer && !same(previous.mine, mine))) {
        return { ...session, fields: { ...session.fields, [field]: { ...previous,
          revision: crypto.randomUUID(), conflict: { latest: previous.mine, incoming: mine, incomingWriter: writer, incomingEditId:editId } } },
          history: [...session.history, { id: crypto.randomUUID(), at, kind: 'stage', field, writer, editId }] }
      }
      return { ...session, fields: { ...session.fields, [field]: { base, mine, writer, updatedAt: at, revision: crypto.randomUUID(), editId:previous?.editId??editId } },
        history: [...session.history, { id: crypto.randomUUID(), at, kind: 'stage', field, writer, editId:previous?.editId??editId }] }
    })
  }
  async recover(workspace: WorkspaceV8, draftId: string, writer: string, expected: Record<string, string>) {
    return this.mutate(workspace, draftId, session => {
      const fields = { ...session.fields }
      for (const [key, revision] of Object.entries(expected)) {
        const previous = fields[key]
        if (!previous || previous.revision !== revision) throw Error('D20_FIELD_STALE')
        if (!previous.conflict) fields[key] = { ...previous, writer, revision: crypto.randomUUID() }
      }
      return { ...session, fields,
        history: [...session.history, { id: crypto.randomUUID(), at: new Date().toISOString(), kind: 'recover', field: '*', writer }] }
    })
  }
  async resolve(workspace: WorkspaceV8, draftId: string, field: string, choice: 'latest' | 'incoming', writer: string, expectedRevision: string) {
    return this.mutate(workspace, draftId, session => {
      const previous = session.fields[field]
      if (!previous?.conflict) throw Error('D20_FIELD_CONFLICT_MISSING')
      if (previous.revision !== expectedRevision) throw Error('D20_FIELD_STALE')
      const mine = choice === 'latest' ? previous.conflict.latest : previous.conflict.incoming
      const editId=choice==='incoming'?previous.conflict.incomingEditId:previous.editId
      return { ...session, fields: { ...session.fields, [field]: { base: previous.base, mine, writer, updatedAt: new Date().toISOString(), revision: crypto.randomUUID(), editId } },
        history: [...session.history, { id: crypto.randomUUID(), at: new Date().toISOString(), kind: 'resolve', field, writer, editId }] }
    })
  }
  async clear(workspace: WorkspaceV8, draftId: string, field: string, writer: string, expectedRevision: string) {
    return this.mutate(workspace, draftId, session => {
      const previous = session.fields[field]
      if (!previous || previous.revision !== expectedRevision || previous.conflict) throw Error('D20_FIELD_STALE')
      if (previous.writer !== writer) throw Error('D20_FIELD_OWNED_BY_OTHER_TAB')
      const fields = { ...session.fields }; delete fields[field]
      return { ...session, fields, history: [...session.history, { id: crypto.randomUUID(), at: new Date().toISOString(), kind: 'clear', field, writer, editId:previous.editId }] }
    })
  }
}
