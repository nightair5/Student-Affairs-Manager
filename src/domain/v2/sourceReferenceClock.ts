import type {SourceVersion} from './types'

/** New captures persist their original clock; older versions remain readable
 * using their existing timestamp and the caller's current workspace timezone. */
export function sourceReferenceClock(version:SourceVersion,fallbackTimezone:string):{referenceTime:string;timezone:string} {
 const stored=version.legacyData?.sourceReferenceClockV1
 if(stored!==undefined&&(stored===null||typeof stored!=='object'||Array.isArray(stored)||stored.version!=='source-reference-clock-1.0.0'||typeof stored.referenceTime!=='string'||typeof stored.timezone!=='string'))throw Error('SOURCE_REFERENCE_CLOCK_INVALID')
 const clock=stored&&typeof stored==='object'&&!Array.isArray(stored)?stored:null
 const referenceTime=typeof clock?.referenceTime==='string'?clock.referenceTime:version.createdAt
 const timezone=typeof clock?.timezone==='string'?clock.timezone:fallbackTimezone
 if(!Number.isFinite(Date.parse(referenceTime)))throw Error('SOURCE_REFERENCE_TIME_INVALID')
 try{new Intl.DateTimeFormat('en',{timeZone:timezone}).format(0)}catch{throw Error('SOURCE_REFERENCE_TIMEZONE_INVALID')}
 return {referenceTime,timezone}
}
