import{connect}from'node:tls'
import{createBoundaryPinnedProxyFetch}from'./scoped-transport-boundary-diagnostics.mjs'
export const RELIABLE_RELAY_VERSION='pre-post-tls-reconnect-1.0.0'
/** A second connection is allowed only before the POST API is entered. This
 * does not resend a POST, recover an old uncertain unit or weaken TLS checks. */
export function createReliableRelayFetch(observation,{routeFactory=createBoundaryPinnedProxyFetch,secureConnect=connect,onAttempt=()=>{},...options}={}){
 let used=false
 return async(url,init)=>{
  if(used)throw Error('RELIABLE_RELAY_ONCE_ONLY');used=true
  for(let attempt=1;attempt<=2;attempt++){
   let phase=null,postEntered=false,tlsCode=null
   const watched={...observation,boundarySync:p=>{observation.boundarySync(p);phase=p;if(p==='POST_REQUEST_API_ENTER')postEntered=true}}
   const fetcher=routeFactory(watched,{...options,secureConnect:(...args)=>{const socket=secureConnect(...args);socket.once('error',e=>{tlsCode=typeof e?.code==='string'?e.code:null});return socket}})
   try{const response=await fetcher(url,init);onAttempt({attempt,phase,postEntered,result:'RESPONSE_HEADERS'});return response}
   catch(error){const certificateFailure=tlsCode&&/CERT|CERTIFICATE|SELF_SIGNED|ISSUER|ALTNAME|VERIFY|SIGNATURE|DEPTH/u.test(tlsCode),retry=attempt===1&&phase==='TLS_API_ENTER'&&!postEntered&&!init.signal.aborted&&!certificateFailure;onAttempt({attempt,phase,postEntered,tlsCode,result:retry?'RECONNECT_BEFORE_POST':'STOP_NO_POST_RETRY'});if(!retry)throw error}
  }
 }
}
