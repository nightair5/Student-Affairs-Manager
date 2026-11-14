export interface SourceWeekdayItem {action?:string;object?:string;actionVerb?:string;actionObject?:string;evidence?:string[]}
export function sourceActionWeekday(source:string,item:SourceWeekdayItem):{raw:string;start:number;end:number}|null
export function sourceWeekdayAlternatives(source:string,item:SourceWeekdayItem):{raw:string;days:string[];start:number;end:number}|null
