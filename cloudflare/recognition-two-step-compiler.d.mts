import type{RecognitionResult}from'../src/recognition/types'
export interface TwoStepItem{id:string;kind:'任务'|'活动'|'信息';name:string;quote:string}
export interface TwoStepFact{type:'截止'|'开始'|'结束'|'办理时段'|'地点'|'材料'|'渠道'|'条件'|'取消'|'变更';quote:string;item:string|null}
export interface TwoStepOutput{items:TwoStepItem[];facts:TwoStepFact[];noAction:boolean}
export interface LiteralAlignment{literal:string;start:number;end:number;rule:string}
export function alignTwoStepQuote(quote:unknown,source:string):LiteralAlignment|null
export function compileTwoStep(raw:unknown,context:{source:string;referenceTime:string;timezone?:string;model?:string;version?:string}):{result:RecognitionResult|null;audit:Record<string,unknown>;rootFailure:boolean}
export function mergeTwoStepFacts(samples:TwoStepOutput[],source:string):{raw:TwoStepOutput;audit:Record<string,unknown>}
