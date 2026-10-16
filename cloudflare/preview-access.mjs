const COOKIE = '__Host-student-preview'
const ACCESS_PATH = '/_preview/access'
const TTL_SECONDS = 8 * 60 * 60
const encoder = new TextEncoder()
const base64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
const decode = text => Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0))
const keyFor = code => crypto.subtle.importKey('raw', encoder.encode(code), {name:'HMAC',hash:'SHA-256'}, false, ['sign','verify'])

// Verification uses WebCrypto's fixed-length MAC comparison, not string ===,
// an early-return character loop or a password/token embedded in the cookie.
export async function constantTimeCodeEqual(actual, expected) {
  const key=await keyFor('student-preview-code-comparison-v1')
  const signature=await crypto.subtle.sign('HMAC',key,encoder.encode(expected))
  return crypto.subtle.verify('HMAC',key,signature,encoder.encode(actual))
}

function denied(message,status=401,api=false) {
  const headers={'cache-control':'no-store','content-type':api?'application/json; charset=utf-8':'text/html; charset=utf-8','referrer-policy':'no-referrer'}
  if(api)return Response.json({error:'PREVIEW_ACCESS_REQUIRED',message},{status,headers})
  return new Response(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>学生事务管家 · 测试版</title><body><main><h1>学生事务管家 · 限制访问测试版</h1><p>${message}</p>${status===503?'':'<form method="post" action="/_preview/access"><label for="access-code">访问口令</label><input id="access-code" name="code" type="password" autocomplete="off" maxlength="512" required><button type="submit">进入测试版</button></form>'}<p>数据仅保存在当前浏览器；测试地址与正式站点的数据互相独立。</p></main></body></html>`,{status,headers})
}

async function validSession(request,code,now) {
  const cookies=(request.headers.get('cookie')??'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(COOKIE+'='))
  if(cookies.length!==1)return false
  const value=cookies[0].slice(COOKIE.length+1)
  if(value.length>512)return false
  const [expires,nonce,signature,...extra]=value.split('.')
  if(extra.length||!/^\d{10,13}$/u.test(expires)||!/^[-\w]{20,64}$/u.test(nonce??'')||!/^[-\w]{43}$/u.test(signature??''))return false
  const seconds=Math.floor(now()/1000),until=Number(expires)
  if(until<=seconds||until>seconds+TTL_SECONDS)return false
  const payload=`preview-session-v1\n${new URL(request.url).origin}\n${expires}\n${nonce}`
  try{return await crypto.subtle.verify('HMAC',await keyFor(code),decode(signature),encoder.encode(payload))}catch{return false}
}

/** Return null only when the request may reach the ordinary Worker/ASSETS. */
export async function previewAccess(request,env,{isLimited,now=Date.now}) {
  if(env.PREVIEW_ACCESS_REQUIRED!=='true')return null
  const url=new URL(request.url),api=url.pathname.startsWith('/api/'),code=env.PREVIEW_ACCESS_CODE
  if(typeof code!=='string'||code.length<1||code.length>512)return denied('测试版访问尚未配置，请联系负责人。',503,api)
  if(url.pathname!==ACCESS_PATH)return await validSession(request,code,now)?null:denied('请输入负责人提供的访问口令。',401,api)
  if(request.method==='GET')return denied('请输入负责人提供的访问口令。')
  if(request.method!=='POST')return denied('请通过口令表单进入。',405,api)
  if(request.headers.get('origin')!==url.origin)return denied('请在本测试地址中提交口令。',403,api)
  if(isLimited(request.headers.get('cf-connecting-ip')??'unknown'))return denied('尝试次数较多，请15分钟后再试。',429,api)
  if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))return denied('口令表单格式不正确。',415,api)
  if(Number(request.headers.get('content-length'))>2048)return denied('口令表单过大。',413,api)
  const reader=request.body?.getReader();let bytes=0,text=''
  if(reader){const decoder=new TextDecoder();while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>2048){await reader.cancel();return denied('口令表单过大。',413,api)}text+=decoder.decode(value,{stream:true})}text+=decoder.decode()}
  const values=new URLSearchParams(text).getAll('code')
  if(values.length!==1||values[0].length>512||!await constantTimeCodeEqual(values[0],code))return denied('口令不正确，请重试。',401,api)
  const expires=String(Math.floor(now()/1000)+TTL_SECONDS),nonce=base64url(crypto.getRandomValues(new Uint8Array(18)))
  const payload=`preview-session-v1\n${url.origin}\n${expires}\n${nonce}`
  const signature=base64url(await crypto.subtle.sign('HMAC',await keyFor(code),encoder.encode(payload)))
  return new Response(null,{status:303,headers:{location:'/', 'cache-control':'no-store',
    'set-cookie':`${COOKIE}=${expires}.${nonce}.${signature}; Path=/; Max-Age=${TTL_SECONDS}; HttpOnly; Secure; SameSite=Strict`}})
}
