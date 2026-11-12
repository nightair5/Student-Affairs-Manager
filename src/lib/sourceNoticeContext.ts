import {directBatch} from '../domain/v2/directIntake'
import type {WorkspaceV8} from '../domain/v2/types'

import {extractSourceNoticeContext} from './noticeExcerpts'
import type {SourceNoticeContext} from './noticeExcerpts'
export {extractSourceNoticeContext} from './noticeExcerpts'
export type {SourceNoticeContext} from './noticeExcerpts'

/** Read the current immutable source for exactly one active direct batch.
 * Multiple batches, stale versions and missing records are not guessed. */
export function sourceNoticeContextForEntity(workspace:WorkspaceV8|null|undefined,kind:'task'|'event',id:string,knownText='',missingEnd=false):SourceNoticeContext|null {
  if(!workspace)return null
  if(kind==='task'?!workspace.tasks.some(item=>item.id===id):!workspace.events.some(item=>item.id===id))return null
  const owners=workspace.extractionDrafts.flatMap(draft=>{
    const batch=directBatch(draft)
    return batch?.status==='active'&&batch.draftId===draft.id&&batch.items.some(item=>item.kind===kind&&item.id===id)?[{draft,batch}]:[]
  })
  if(owners.length!==1)return null
  const {draft,batch}=owners[0],run=workspace.recognitionRuns.find(item=>item.id===draft.recognitionRunId)
  const version=workspace.sourceVersions.find(item=>item.id===run?.sourceVersionId)
  const source=workspace.sources.find(item=>item.id===version?.sourceId)
  if(!run||!version?.rawText||!source||source.currentVersionId!==version.id||batch.sourceId!==source.id)return null
  // A source-wide excerpt cannot safely be attributed to one of several
  // activities. Keep their existing details and the full source accessible.
  if(batch.items.filter(item=>item.kind==='event'&&workspace.events.some(event=>event.id===item.id)).length>1)return {sections:[],omitted:false,sourceText:version.rawText}
  return extractSourceNoticeContext(version.rawText,kind,knownText,missingEnd)
}
