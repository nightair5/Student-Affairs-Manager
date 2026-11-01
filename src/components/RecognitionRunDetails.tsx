import type {ExtractionDraft,RecognitionRun} from '../domain/v2/types'
import type {RecognitionRequestDiagnostic} from '../recognition/requestDiagnostic'

const reasons:Record<RecognitionRequestDiagnostic['reason'],string>={LOCAL_MODE:'本次选择简单整理',STATUS_UNAVAILABLE:'服务状态查询失败，提取未发送',NOT_CONFIGURED:'服务未配置，提取未发送',AI_RESPONSE:'已收到识别服务响应',HTTP_ERROR:'识别服务返回错误',INVALID_JSON:'服务响应格式错误',SCHEMA_ERROR:'回答未能转换成产品数据',TIMEOUT_OR_NETWORK:'请求超时或网络中断，不能确认上游执行状态',UNOBSERVED:'旧记录或测试路径，未观测实际请求'}
export function RecognitionRunDetails({run,draft}:{run?:RecognitionRun;draft:ExtractionDraft}){
 const value=run?.legacyData?.requestDiagnostic
 const diagnostic=value&&typeof value==='object'&&!Array.isArray(value)&&value.version==='recognition-request-observation-1'?value as unknown as RecognitionRequestDiagnostic:null
 return <div><p>{diagnostic?reasons[diagnostic.reason]:'这条历史记录未保存实际调用状态。'}</p>
  {diagnostic&&<dl><dt>实际返回模型</dt><dd>{diagnostic.actualModels.length?diagnostic.actualModels.join('、'):'未观测'}</dd><dt>生成与编译版本</dt><dd>{[diagnostic.generationMode,diagnostic.compilerVersion].filter(Boolean).join(' · ')||'未观测'}</dd>{diagnostic.responseReuse&&<><dt>本次请求</dt><dd>复用同一请求的已保存响应，未新增模型调用</dd></>}{diagnostic.inputTokens!==null&&<><dt>实际用量</dt><dd>输入 {diagnostic.inputTokens}，输出 {diagnostic.outputTokens??'未观测'}</dd></>}{diagnostic.compilerLossCount!==null&&<><dt>程序转换待补充项</dt><dd>{diagnostic.compilerLossCount}</dd></>}</dl>}
  <details><summary>查看识别记录</summary><pre>{JSON.stringify({request:diagnostic,result:draft.result,audit:draft.legacyData?.directConversion},null,2)}</pre></details>
 </div>
}
