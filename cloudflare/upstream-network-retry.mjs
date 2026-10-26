/** One bounded network-only retry. HTTP, schema and semantic failures never
 * cause a second paid request. Failed sends have unknown upstream usage. */
export function boundedNetworkRetry(fetcher,{enabled=false,budgetMs=45000,attemptMs=15000,now=Date.now}={}){
 const attempts=[]
 const send=async(url,init)=>{
  const deadline=now()+budgetMs
  for(let attempt=1;attempt<=(enabled?2:1);attempt++){
   const started=now(),remaining=deadline-started
   if(remaining<=0)throw new DOMException('Upstream budget expired','TimeoutError')
   try{const response=await fetcher(url,{...init,signal:enabled?AbortSignal.timeout(Math.max(1,Math.min(attemptMs,remaining))):init.signal});attempts.push({attempt,status:response.status,error:null,elapsedMs:now()-started,usage:'REPORTED_BY_RESPONSE'});return response}
   catch(error){const code=error?.name==='TimeoutError'||error?.name==='AbortError'?'UPSTREAM_TIMEOUT':'UPSTREAM_UNAVAILABLE';attempts.push({attempt,status:null,error:code,elapsedMs:now()-started,usage:'NOT_OBSERVABLE'});if(!enabled||attempt===2||!(error instanceof TypeError||['TimeoutError','AbortError'].includes(error?.name)))throw error}
  }
 }
 return {fetcher:send,attempts}
}
