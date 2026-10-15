export interface CitedSequencePoint {tempId:string;type:string;rawText:string;evidenceIds?:string[]}
export interface CitedSequenceEvent {tempId:string;startTimePointTempId:string|null;endTimePointTempId:string|null;evidenceIds?:string[]}
export function citedEventSequence(point:CitedSequencePoint,events:CitedSequenceEvent[],points:CitedSequencePoint[],evidence:Array<{id:string;quote?:string}>,source:string):null|{dateLiteral:string;endpoint:string;context:string;evidenceIds:string[];rule:string}
