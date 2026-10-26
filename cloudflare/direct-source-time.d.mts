import type {ChineseTimeAst,ChineseTimeAstOptions} from '../src/lib/timeSemantics'
export const DIRECT_SOURCE_TIME_VERSION:string
export function parseDirectSourceTime(raw:string,options:ChineseTimeAstOptions):ChineseTimeAst&{formatRule:string|null}
