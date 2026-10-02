import type {ModelWire} from '../src/experiments/realInput01/modelWire'
import type {SourceFacts} from '../src/experiments/realInput01/sourceFactsV3'
export interface D25Source {sourceId:string;sourceVersionId:string;sourceText:string;sourceSha256:string;referenceTime:string;timezone:string;target:string}
export interface D25Artifacts {
  'SOURCES.json':{sources:D25Source[]}
  'LEGAL_WIRE_ORACLES.json':{oracles:Array<{sourceId:string;wire:ModelWire;rawFacts:SourceFacts;role:string}>}
}
export function makeD25():Promise<D25Artifacts>
export function sha(value:string|Uint8Array):string
