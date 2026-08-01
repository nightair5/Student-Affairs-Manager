import { createServer } from 'node:http'

const port = Number(process.env.DEEPSEEK_PROXY_PORT ?? 8787)
const apiKey = process.env.DEEPSEEK_API_KEY

function json(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(data))
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      body += chunk
      if (body.length > 100_000) reject(new Error('请求过大'))
    })
    request.on('end', () => {
      try {
        resolve(JSON.parse(body))
      } catch {
        reject(new Error('请求格式无效'))
      }
    })
    request.on('error', reject)
  })
}

function validRequest(value) {
  return typeof value === 'object' && value !== null && typeof value.question === 'string' && Array.isArray(value.context)
}

createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/api/deepseek/status') {
    json(response, 200, { configured: Boolean(apiKey) })
    return
  }
  if (request.method !== 'POST' || request.url !== '/api/deepseek') {
    json(response, 404, { error: 'Not found' })
    return
  }
  if (!apiKey) {
    json(response, 503, { error: 'DeepSeek 尚未连接' })
    return
  }

  try {
    const requestBody = await readJson(request)
    if (!validRequest(requestBody)) {
      json(response, 400, { error: '请求格式无效' })
      return
    }
    const context = requestBody.context.slice(0, 4).map((item) => ({
      title: String(item.title ?? '').slice(0, 160),
      kind: String(item.kind ?? '').slice(0, 30),
      excerpt: String(item.excerpt ?? '').slice(0, 1_200),
    }))
    const upstream = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.1,
        messages: [
          { role: 'system', content: '你是学生事务资料问答助手。只能依据提供的资料摘要回答；资料不足时明确说“没有匹配资料”，不要补充外部事实。回答简洁，并在每个结论后说明所依据的资料标题。' },
          { role: 'user', content: `问题：${requestBody.question.slice(0, 1_000)}\n\n可用资料：\n${context.map((item, index) => `${index + 1}. [${item.kind}] ${item.title}\n${item.excerpt}`).join('\n\n')}` },
        ],
      }),
    })
    if (!upstream.ok) {
      json(response, 502, { error: 'DeepSeek 服务暂时无法响应' })
      return
    }
    const upstreamData = await upstream.json()
    const answer = upstreamData?.choices?.[0]?.message?.content
    if (typeof answer !== 'string' || !answer.trim()) {
      json(response, 502, { error: 'DeepSeek 服务返回了无法识别的结果' })
      return
    }
    json(response, 200, { answer: answer.trim() })
  } catch {
    json(response, 400, { error: '代理无法处理本次请求' })
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`DeepSeek 本机代理正在监听 http://127.0.0.1:${port}`)
})
