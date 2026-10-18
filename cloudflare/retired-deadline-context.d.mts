import type{RecognitionResult,TimePointSuggestionV2}from'../src/recognition/types'
export const RETIRED_DEADLINE_CONTEXT_VERSION:'retired-deadline-context-1.0.0'
export function retiredDeadlineContext(point:TimePointSuggestionV2,result:RecognitionResult,evidence:RecognitionResult['evidence'],source:string):boolean
