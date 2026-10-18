import type { RecognitionResult } from '../src/recognition/types'
export const LOCAL_ISOLATION_VERSION:'recognition-local-isolation-1.1.0'
export const LOCAL_ISOLATION_NOTE_PREFIX:string
export interface LocalIsolationAudit {version:typeof LOCAL_ISOLATION_VERSION;inferredFacts:0;quarantined:Array<{kind:string;path:string;id:string|null;reason:string;original:unknown}>;structure:Array<{path:string;original:unknown}>;relations:Array<{ownerId:string;field:string;original:unknown}>}
export function hasLocalIsolationPending(result:RecognitionResult):boolean
export function unanchoredAcademicWeek(text:string):boolean
export function retainUnanchoredWeekTimes(result:RecognitionResult):RecognitionResult
export function isolateRecognitionItems(input:unknown,sourceText:string,options?:{sourceId?:string;structural?:boolean;allowNoUsableSubset?:boolean}):{result:RecognitionResult|null;audit:LocalIsolationAudit;rootFailure:boolean}
