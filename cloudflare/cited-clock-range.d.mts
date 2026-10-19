import type {RecognitionResult,TimePointSuggestionV2} from '../src/recognition/types'
export const CITED_CLOCK_RANGE_VERSION: 'cited-clock-range-role-1.3.0'
export interface CitedClockRangeDecision {pointId:string;rawText:string;role:string;ownerIds:string[];evidenceIds:string[];quote:string;before:{normalizedValue:string|null;needsConfirmation:boolean;selected:boolean};after:{normalizedValue:string|null;needsConfirmation:boolean;selected:boolean};endpoint:string|null;reason:string;blocked:boolean}
export function projectCitedClockRanges<T>(input:T,source:string,referenceTime:string,timezone?:string):{result:T;audit:{version:typeof CITED_CLOCK_RANGE_VERSION;decisions:CitedClockRangeDecision[]}}
export function citedAcademicFirstOccurrence(point:TimePointSuggestionV2,input:RecognitionResult,source:string,referenceTime:string,timezone:string):{next:TimePointSuggestionV2;decision:CitedClockRangeDecision}|null
