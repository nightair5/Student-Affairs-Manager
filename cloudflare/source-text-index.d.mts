import type {RecognitionResult} from '../src/recognition/types'
export interface SourceSpan {literal:string;start:number;end:number;rule:string}
export function normalizeSourceWithOffsets(source:string):{text:string;starts:number[];ends:number[]}
export function locateSourceQuote(quote:string|undefined,source:string,options?:{start?:number;end?:number;within?:{start:number;end:number}}):SourceSpan|null
export function alignRecognitionEvidence<T extends Pick<RecognitionResult,'evidence'>>(input:T,source:string):{result:T;decisions:Array<{id:string;rule:string;start:number;end:number}>}
