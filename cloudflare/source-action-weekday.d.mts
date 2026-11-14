export interface SourceWeekdayItem {action?:string;object?:string;actionVerb?:string;actionObject?:string;evidence?:string[];times?:{role?:string;raw?:string}[];assignment?:{actor?:string}}
export function sourceActionWeekday(source:string,item:SourceWeekdayItem):{raw:string;start:number;end:number}|null
export function sourceWeekdayAlternatives(source:string,item:SourceWeekdayItem):{raw:string;days:string[];start:number;end:number}|null
export function formatSourceWeekdayAlternatives(source:string,choice:{raw:string;days:string[];start:number;end:number},items:SourceWeekdayItem[],referenceTime:string,timezone:string):string|null
export function sourceUnassignedWeekdayAlternative(source:string,summary:string,unresolved:string[]|undefined,represented:string[]):{raw:string;days:string[];start:number;end:number;quote:string;startQuote:number}|null
