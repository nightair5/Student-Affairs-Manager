import {adaptModelWire,type ModelWire,type WireContext} from '../realInput01/modelWire'
import {parseSemanticInput} from '../mainline04/semanticContract'
import {normalizeCandidate14Time,CANDIDATE14_TIME_POLICY_VERSION} from './timePolicy'

export const CANDIDATE14_COMMON_ADAPTER_VERSION='candidate14-common-adapter-1.0.0' as const

/** Shared by both future arms; prompt quality cannot take credit for this local policy. */
export function adaptCandidate14CommonWire(input:unknown,context:WireContext){
  const base=adaptModelWire(input,context)
  const timePoints=base.adapted.timePoints.map(point=>{
    const projected=normalizeCandidate14Time(point.rawText,point.type,context.referenceTime,context.timezone)
    return {...point,normalizedValue:projected.normalizedValue,timezone:context.timezone,isAllDay:projected.isAllDay,precision:projected.precision,needsConfirmation:projected.needsConfirmation}
  })
  return {wire:base.wire as ModelWire,adapted:parseSemanticInput({...base.adapted,timePoints}),adapterVersion:CANDIDATE14_COMMON_ADAPTER_VERSION,timePolicyVersion:CANDIDATE14_TIME_POLICY_VERSION}
}
