# 安全策略

## 支持范围

当前受支持的公开版本是 `student-affairs.site` 上的最新 Cloudflare Worker 部署，以及仓库默认开发分支上的最新代码。旧 Firebase 部署仅作为回滚参考，不再视为当前安全版本。

## 报告漏洞

请通过 GitHub 仓库的私密漏洞报告功能（Security → Advisories → Report a vulnerability）提交。不要在公开 Issue、讨论区、截图或日志中粘贴：

- DeepSeek API Key、Cloudflare Token、Firebase 服务账号；
- 同步令牌、邮件 Webhook Token；
- 真实老师消息、学生材料、姓名、学号、证件号或联系方式；
- 可复现但会破坏他人数据的攻击脚本。

报告请只提供最小复现、影响范围、受影响路径、浏览器或版本，以及已经完成的非破坏性验证。维护者会先确认接收，再评估、修复、验证和发布；需要第三方平台处理时会明确说明外部阻碍。

## 数据与密钥边界

- 任务、项目、来源文字、草稿、材料、历史与提醒默认保存在当前站点的浏览器 IndexedDB。
- 文件本体、图片和 PDF 二进制不会长期写入本地工作区，也不会随 JSON 备份导出。
- 清除浏览器站点数据、更换浏览器、设备或域名会失去本地数据；当前没有账号和自动跨设备同步。
- `DEEPSEEK_API_KEY` 只能通过 Cloudflare Secret、Firebase Secret Manager 或本机 Node 服务环境变量读取，禁止使用 `VITE_*`。
- 云端整理只接收用户主动提交的当前文字；知识问答只接收问题和最多 4 条引用摘要。外部文本始终是不可信数据。
- Worker 日志只记录 requestId、路径、状态码、耗时、输入长度、输出 token、错误类型和匿名客户端标识，不记录原文或凭证。

## API 防护

生产 Worker 对 `/api/deepseek*` 执行：

- 精确 Origin 校验和受控 Preview 白名单；
- 方法、`Content-Type`、请求体大小、字段白名单、长度、数组数量和日期校验；
- 服务端固定模型、token 上限、系统提示词和超时；
- 单实例分钟频率限制和每客户端并发限制；
- AI JSON 结构、枚举、日期、材料数量和逐字证据校验；
- 统一安全错误、requestId、安全响应头与脱敏结构化日志。

单实例内存限流会随 Worker 实例重建，不能替代 Cloudflare WAF Rate Limiting、Turnstile、账号鉴权或 App Check。公开扩大调用量前必须在 Cloudflare 控制台增加平台级规则并在 DeepSeek 设置消费上限。

## Key 泄漏处理

如果任何密钥曾进入前端、Git、构建产物或公开聊天：

1. 立即在对应服务商撤销旧 Key，不等待代码修复。
2. 暂停 AI 接口或移除 Worker Secret。
3. 检查 Cloudflare Logs、Security Events 与 DeepSeek 消费。
4. 创建新 Key，通过 `wrangler secret put DEEPSEEK_API_KEY` 写入。
5. 清理代码与必要的 Git 历史，完成密钥扫描、测试和 Preview 验证。
6. 重新部署并只在真实状态与调用均成功后恢复“已连接”。

完整事故流程、回滚和恢复步骤见 [RUNBOOK.md](./RUNBOOK.md)。
