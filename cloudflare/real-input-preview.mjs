// No Secret, external fetch, database or model bindings. Only approved public assets.
const staticPaths = new Set(['/', '/index.html', '/boot.js', '/browser.js', '/browser.css', '/recorded/Q01-06.json', '/recorded/Q07-06.json', '/recorded/R11-07.json', '/recorded/R12-07.json', '/recorded/U11-09.json', '/recorded/V02-09.json', '/recorded/L01-A.json', '/recorded/L02-A.json', '/recorded/L04-A.json'])
const headers = {
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self'; worker-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow',
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if(!['GET','HEAD'].includes(request.method))return new Response('模型与写入接口关闭',{status:405,headers})
    if(url.pathname==='/api/status')return Response.json({experiment:'real-input-https-preview-1',modelCallsEnabled:false,
      storage:'browser-only-new-origin',records:['Q01-06','Q07-06','R11-07','R12-07','U11-09','V02-09','L01-A','L02-A','L04-A'],candidateAdopted:false},{headers})
    if(url.search||!staticPaths.has(url.pathname))return new Response('NOT_AVAILABLE_IN_PREVIEW',{status:404,headers})
    const response=await env.ASSETS.fetch(new Request(new URL(url.pathname==='/'?'/index.html':url.pathname,url.origin),{method:request.method}))
    return new Response(response.body,{status:response.status,headers:{...Object.fromEntries(response.headers),...headers}})
  },
}
