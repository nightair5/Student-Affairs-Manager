export interface CitedSequencePoint {tempId:string;type:string;rawText:string;evidenceIds?:string[]}
export interface CitedSequenceEvent {tempId:string;startTimePointTempId:string|null;endTimePointTempId:string|null;evidenceIds?:string[]}
export function citedEventSequence(point:CitedSequencePoint,events:CitedSequenceEvent[],points:CitedSequencePoint[],evidence:Array<{id:string;quote?:string}>,source:string):null|{dateLiteral:string;endpoint:string;context:string;evidenceIds:string[];rule:string}
export const citedSplitEventRange: typeof citedEventSequence

export function citedTaskDateRange(point:Parameters<typeof citedEventSequence>[0],tasks:Array<{tempId:string;timePointTempIds:string[];evidenceIds:string[]}>,points:Parameters<typeof citedEventSequence>[2],evidence:Parameters<typeof citedEventSequence>[3],source:string):ReturnType<typeof citedEventSequence>
