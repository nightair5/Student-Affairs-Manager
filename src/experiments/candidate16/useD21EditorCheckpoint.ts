import { useEffect, useRef, useState } from 'react'
import type { WorkspaceV8 } from '../../domain/v2/types'
import { stableJson } from '../mainline04/semanticContract'
import type { D20ReviewSessionRepository, ReviewField } from './d20ReviewSession'

type Phase = 'loading' | 'ready' | 'saving' | 'saved' | 'foreign' | 'conflict' | 'failed'

/** An editor owns one source-bound field in the same review session as the task card. */
export function useD21EditorCheckpoint<T>({ repo, workspace, draftId, field, base, value, active, restore, edited=true }: {
  repo?: D20ReviewSessionRepository; workspace: WorkspaceV8; draftId: string; field: string;
  base: unknown; value: T; active: boolean; restore: (value: T) => void; edited?:boolean
}) {
  const [phase, setPhase] = useState<Phase>(repo ? 'loading' : 'ready')
  const [entry, setEntry] = useState<ReviewField | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const last = useRef('')
  const scheduled = useRef('')
  const latest = useRef('')
  const revision = useRef('')
  const queue = useRef(Promise.resolve())
  const restoreRef = useRef(restore)
  const workspaceAtMount = useRef(workspace)
  const serialized = active ? stableJson(value) : ''
  useEffect(()=>{restoreRef.current=restore},[restore])
  useEffect(()=>{latest.current=serialized},[serialized])

  useEffect(() => {
    if (!repo) return
    let live = true
    void repo.load(workspaceAtMount.current, draftId).then(session => {
      if (!live) return
      const stored = session.fields[field]
      if (stored) {
        restoreRef.current(stored.mine as T)
        last.current = stableJson(stored.mine); scheduled.current = last.current
        revision.current = stored.revision
        setEntry(stored)
        setPhase(stored.conflict ? 'conflict' : stored.writer === repo.writer ? 'saved' : 'foreign')
      } else setPhase('ready')
    }).catch(cause => { if (live) { setError(String(cause)); setPhase('failed') } })
    return () => { live = false }
  }, [repo, draftId, field]) // one mount per source/editor; changes to the workspace do not discard local input

  useEffect(() => {
    if (!repo || !active || ['loading', 'foreign', 'conflict'].includes(phase) || phase === 'failed' && retry === 0) return
    if (serialized === scheduled.current && retry === 0) return
    setPhase('saving'); setError('')
    const submitted = serialized
    scheduled.current = submitted
    queue.current = queue.current.catch(() => undefined).then(async () => {
      const saved = await repo.stage(workspace, draftId, field, base, value, repo.writer,edited)
      const current = saved.fields[field]
      setEntry(current)
      revision.current = current.revision
      if (current.conflict) { setPhase('conflict'); return }
      if (submitted === latest.current) {
        last.current = submitted
        setPhase('saved')
        setRetry(0)
      }
    }).catch(cause => { setError(String(cause)); setPhase('failed'); setRetry(0) })
  }, [repo, workspace, draftId, field, base, value, active, phase, serialized, retry,edited])

  const takeOver = async () => {
    if (!repo || !entry) return
    try {
      const saved = await repo.recover(workspace, draftId, repo.writer, { [field]: entry.revision })
      revision.current = saved.fields[field].revision
      setEntry(saved.fields[field]); setPhase('saved'); setError('')
    } catch (cause) { setError(String(cause)); setPhase('failed') }
  }
  const resolve = async (choice: 'latest' | 'incoming') => {
    if (!repo || !entry) return
    try {
      const saved = await repo.resolve(workspace, draftId, field, choice, repo.writer, entry.revision)
      const current = saved.fields[field]
      revision.current = current.revision
      restoreRef.current(current.mine as T)
      last.current = stableJson(current.mine); scheduled.current = last.current
      setEntry(current); setPhase('saved'); setError('')
    } catch (cause) { setError(String(cause)); setPhase('conflict') }
  }
  const clear = async () => {
    if (!repo) return
    await queue.current
    const current = (await repo.load(workspace, draftId)).fields[field]
    if (!current) { setEntry(null); setPhase('ready'); last.current = ''; scheduled.current = ''; revision.current=''; return }
    if (current.conflict || current.writer !== repo.writer || current.revision!==revision.current || stableJson(current.mine) !== scheduled.current) throw Error('D21_CHECKPOINT_STALE')
    await repo.clear(workspace, draftId, field, repo.writer, revision.current)
    setEntry(null); setPhase('ready'); last.current = ''; scheduled.current = ''; revision.current=''
  }
  return { phase, entry, error, takeOver, resolve, clear, retry: () => setRetry(number => number + 1),
    withFresh:<R,>(action:()=>Promise<R>)=>repo&&active
      ?repo.withFreshField(workspace,draftId,field,repo.writer,revision.current,value,action):action(),
    readyToSave: !repo || !active || phase === 'saved' }
}
