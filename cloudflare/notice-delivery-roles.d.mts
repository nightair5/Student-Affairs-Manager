import type {SourceSpan} from './source-text-index.mjs'
export function documentFormats(text:string):string[]
export interface DeliverySection {text:string;body:string;role:string;start:number;end:number}
export interface DeliveryGroup {delivery:{object:string;verb:string;title:string;channel:string;formats:string[];rawObject:string;span:Omit<SourceSpan,'rule'>};requirements:DeliverySection[];conditions:DeliverySection[];sections:DeliverySection[]}
export function noticeDeliveryRoles(source:string):DeliveryGroup|null
