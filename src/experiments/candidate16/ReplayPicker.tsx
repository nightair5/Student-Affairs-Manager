import {useState} from 'react'
import type {D13ReplayRecord} from './replay'

export interface D13ReplayChoice {id:string;label:string;kind:D13ReplayRecord['kind']}

export function D13ReplayPicker({choices,open,sourceSession=false}:{choices:readonly D13ReplayChoice[];open:(id:string)=>Promise<void>;sourceSession?:boolean}){
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  return <section aria-label={sourceSession?'D19来源级工程回放':'D13工程回放'}><p><strong>{sourceSession?'工程回放 / D17录制回答与匿名夹具 / 非真人试用':'工程回放 / D11录制回答与匿名夹具 / 非真人试用'}</strong></p><p>首次回答、程序适配和你的修改分别保留。没有新模型请求，自动化记录不计入真人指标。</p>
    {choices.map(c=><button className="secondary-button" key={c.id} disabled={busy} onClick={()=>{setBusy(true);setError('');void open(c.id).catch(e=>setError(e instanceof Error?e.message:'回放失败')).finally(()=>setBusy(false))}}>{c.label}</button>)}
    {error&&<p role="alert">{error}。来源和已有草稿保留。</p>}</section>
}
