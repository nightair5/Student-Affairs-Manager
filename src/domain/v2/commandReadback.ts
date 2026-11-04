import type {WorkspaceV8} from './types'

/** Retry this read after a confirmed commit; never repeat the write. */
export async function readCommandReceipt(reader:{load():Promise<WorkspaceV8|null>},receipt:{kind:'task'|'material'|'event';operationId:string;entityId:string;changed:boolean}):Promise<WorkspaceV8>{
 const workspace=await reader.load()
 const entities=receipt.kind==='task'?workspace?.tasks:receipt.kind==='material'?workspace?.materials:workspace?.events
 if(!workspace||!entities?.some(entity=>entity.id===receipt.entityId))throw Error('COMMAND_READBACK_PENDING')
 if(receipt.changed&&!workspace.historyRecords.some(record=>record.id.startsWith(`${receipt.kind}-command:${receipt.operationId}:`)&&record.entityId===receipt.entityId))throw Error('COMMAND_READBACK_PENDING')
 return workspace
}

/** A committed batch may need a second projection read. Retrying this helper
 * performs reads only; the caller must never resubmit the committed batch. */
export async function readCommittedBatch(reader:{load():Promise<WorkspaceV8|null>},refresh:()=>Promise<void>,contains:(workspace:WorkspaceV8)=>boolean):Promise<void>{
 const workspace=await reader.load()
 if(!workspace||!contains(workspace))throw Error('DIRECT_READBACK_PENDING')
 await refresh()
}
