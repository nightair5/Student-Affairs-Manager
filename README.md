# 学生事务管家

把老师消息、文件、截图和网页通知整理成可确认、可修改、可追溯的任务。

## 本地运行

```bash
npm install
npm run dev
```

浏览器访问终端显示的本地地址（默认 `http://localhost:4173`）。

## 第一次使用

首次打开会出现 4 步新手教程；以后也可随时从侧边栏底部的“新手教程”重新打开。日常只需记住一条主路径：

1. 在“今日”页粘贴一整段老师通知，点击“帮我拆成任务”。
2. 在待确认页核对系统拆出的事项数量；正确的直接加入任务，不需要的拒绝，有误的再展开编辑。
3. 回到“今日”页，只处理最上面的 1–3 项；全部事项仍可在“任务中心”查看。
4. 完成后勾选任务；每周查看一次日历和项目档案，并在项目档案导出 JSON 备份。

图片和扫描 PDF 现在可在浏览器本机进行中英文 OCR；首次识别需要联网下载 Apache-2.0 许可的 Tesseract.js 语言模型。图片和文件本体不会上传或保存，用户核对后的提取文字才会在主动点击整理时发送给 DeepSeek。OCR、本地规则识别、课程避让和优先级都只是可修改建议。数据默认只保存在当前浏览器与当前站点地址，不会自动跨设备同步。

网页链接必须由用户逐次勾选授权后读取。Cloudflare Worker 只接受 `WEB_FETCH_ALLOWED_HOSTS` 中逐个列出的精确 HTTPS 主机名，拒绝 URL 凭证、IP/本机地址、非常规端口、重定向、超大响应和非文本内容；读取结果会先转成不执行脚本的纯文本，再由用户核对并主动提交给 DeepSeek。未配置或未列入白名单时可直接粘贴网页正文，不会把裸链接伪装成已分析。

## 手机端使用

网页已适配 320–900px 的手机与平板视口。手机上可从顶部“录入”直接粘贴通知、选择文件或截图，底部导航进入今日、待确认、任务中心和日历；文件库、项目档案、知识问答、服务设置与新手教程统一放在“更多”中。

录入、待确认和任务详情会以全屏面板打开，主要按钮保留适合触摸的尺寸。新手教程固定头部和底部操作，只滚动中间说明区，因此“下一步”不会被长内容裁掉。月历在日期格展示四字行动摘要、最早时间与数量，点击日期后在下方查看当天完整清单。数据仍只属于当前手机浏览器和当前站点域名；更换浏览器、清理站点数据或更换设备不会自动恢复，请定期从“项目档案”导出 JSON 备份。

## P2 本地服务（可选）

同步服务默认关闭，不影响纯浏览器功能。需要本机同步接口时：

```bash
copy .env.example .env
# 编辑 .env，将 SAM_SYNC_TOKEN 替换为至少 20 位的随机令牌
npm run server
```

服务默认监听 `http://127.0.0.1:8787`。在网页“服务接入”页填写相同地址与令牌后，可手动上传、预览远端和处理冲突。本地 Vite 开发服务器也会将同源 `/api` 代理到该服务，遇到浏览器回环限制时可把服务地址设为当前 Vite 地址。令牌只保留在当前页面内存中；不要将真实 `.env`、学生数据或令牌提交到 Git。

如果没有配置 `SAM_SYNC_TOKEN`，健康检查仍可用，但同步读写会明确返回 `SYNC_NOT_CONFIGURED`。这不是互联网云同步：没有账号系统、后台自动同步、端到端加密或跨设备托管。

### 可选邮件 Webhook

邮件默认不发送。服务接入页可把已有邮件提醒计划加入服务端队列；未配置时状态固定为“因未配置而阻塞”。要连接你控制的邮件网关，需在服务端 `.env` 设置：

```dotenv
SAM_EMAIL_PROVIDER=webhook
SAM_EMAIL_FROM=student-desk@example.com
SAM_EMAIL_WEBHOOK_URL=https://your-email-gateway.example/send
SAM_EMAIL_WEBHOOK_TOKEN=replace-with-a-long-random-token
```

Webhook 接收 `{ from, to, subject, text }`，Bearer 令牌只由服务端持有。队列最多自动尝试 3 次并记录失败码；“加入队列”和“处理到期任务”都不直接等同于发送成功，只有服务端适配器返回成功后状态才是 `sent`。

### 可选网页读取

网页监测默认只做浏览器本机比较：用户主动添加 HTTPS 链接、粘贴首版正文，之后粘贴新版本即可获得新增/移除行、哈希和检查方式等可解释结果。记录会随工作区保存在 IndexedDB；没有后台定时抓取，也不会执行网页里的脚本或指令。

需要由本地服务按按钮读取公开网页时，必须显式开启并配置精确主机白名单：

```dotenv
SAM_WEB_FETCH_ENABLED=true
SAM_WEB_ALLOWED_HOSTS=www.example.edu,notice.example.edu
```

服务端仅接受 HTTPS、拒绝 URL 内凭证、本机与私网地址、重定向、非 HTML/纯文本响应以及超过 512 KB 的响应；返回前会移除脚本和样式。链接必须由用户主动添加并授权，读取也只在点击后发生。登录页面、反爬页面和动态渲染内容可能无法读取，失败会显示真实状态。若未配置，接口返回 `WEB_FETCH_NOT_CONFIGURED`，本地粘贴比较仍可用。

## 验证

```bash
npm ci
npm run lint
npm run test
npm run build
npm run server:check
npm audit --audit-level=high
```

## Cloudflare Workers 部署

Cloudflare Workers Static Assets 是当前生产部署目标：一个 Worker 同时发布 Vite 的 `dist` 静态网页、提供 SPA 回退，并只让 `/api/*` 请求优先经过服务端代码。因此 Cloudflare 控制台会把它列在 “Workers” 下，但访问地址呈现的仍是完整网页；Worker 同时承担不暴露密钥的 DeepSeek 服务端代理。部署前先确认账号：

生产主站：[https://student-affairs.site](https://student-affairs.site)

Cloudflare 备用地址：[https://student-affairs-manager.nightsdell.workers.dev](https://student-affairs-manager.nightsdell.workers.dev)

```bash
npx wrangler whoami
npm run deploy:cloudflare
```

任何生产修改都必须先部署到隔离的 Preview Worker：

```bash
npm run deploy:cloudflare:preview
```

Preview 使用独立的 `student-affairs-manager-preview` Worker、完整采样日志和独立 Secret，不会覆盖 `student-affairs.site`。只有 Preview 人工验收与 CI 均通过，且对应提交已合并后，才运行生产部署。详细发布、日志和回滚步骤见 [RUNBOOK.md](./RUNBOOK.md)。

DeepSeek 代理位于同源 `/api/deepseek`，状态接口为 `/api/deepseek/status`。密钥只能写入 Cloudflare Secret，不能放入 `wrangler.jsonc`、`.dev.vars.example`、前端、IndexedDB、日志或 Git：

```bash
npx wrangler secret put DEEPSEEK_API_KEY
npm run deploy:cloudflare
```

`secret put` 会在本机终端隐式输入密钥。未设置 Secret 时站点与本地知识检索仍可使用，但状态接口必须返回 `configured: false`，页面显示“DeepSeek 未连接”。代理固定调用 `deepseek-v4-flash` 并关闭思考模式：知识问答只接受当前问题和最多 4 条引用摘要；智能整理只接受用户点击后提交的当前文本或本机提取文字，生成最多 20 条可编辑建议。两类接口都限制同源、请求体和基础频率，外部来源始终按不可信文本处理。当前没有账号系统，Origin 与单实例内存限流不等于用户级鉴权，公开启用前应在 DeepSeek 控制台设置余额和用量上限。

自定义域名为 `student-affairs.site`。权威 DNS 已切换至 Cloudflare，Worker 通过 `wrangler.jsonc` 的 Custom Domain 路由发布；域名、HTTPS 和页面可用性仍应在每次部署后实测，不能只根据配置推测。

当前生产 Worker 与 Cloudflare Secret 均已配置。`/api/deepseek/status` 已实测返回 `configured: true`，`deepseek-v4-flash` 多任务整理也已完成真实请求验证；密钥明文不在前端、配置文件、日志或 Git 中。若服务商密钥被撤销、余额不足或上游不可用，界面仍会诚实回退到本地规则并提示连接状态。

Worker 会为 API 响应生成 `requestId`，严格校验方法、JSON Content-Type、字段白名单、请求大小、文本长度、引用数量、AI 输出结构和日期；模型、token 上限、系统提示词与超时均由服务端固定。日志只记录 requestId、状态、耗时、输入长度、输出 token、错误类型和匿名客户端标识，不记录用户正文或凭证。代码内单实例频率/并发限制不等于平台级防滥用，正式站点仍需按 [RUNBOOK.md](./RUNBOOK.md) 配置 Cloudflare WAF Rate Limiting，并在高频或风险场景接入服务端验证的 Turnstile。安全报告方式见 [SECURITY.md](./SECURITY.md)。

本地调试可复制 `.dev.vars.example` 为不提交的 `.dev.vars`，然后运行 `npm run cloudflare:dev`。`wrangler.jsonc` 不含账户令牌或服务密钥。

### 旧 Firebase 部署

Firebase Hosting 配置仍保留用于回滚，但已不再是主部署目标。旧站点不会自动获得 Cloudflare Worker Secret，也不应再被描述为 DeepSeek 已连接。

## P0：可信确认闭环

- 录入会先保存 `Source` 与 `ExtractionDraft`；关闭审核面板不会丢失草稿。
- 一份来源可产生多项独立的时间点、任务与材料建议。每项均可编辑、拒绝、单项确认或全部确认；只有确认项才创建任务。
- 任务关联来源、项目、材料和修改历史；风险与优先级理由来自可测试规则。
- 实体数据保存到 IndexedDB，并会安全迁移旧 localStorage 工作区。项目档案页支持 JSON 导入、导出和二次确认清空。

数据只保存在当前设备、浏览器和站点地址中；不支持跨设备同步。文件本体、大图片不会写入本机工作区；DeepSeek 可用时会生成可修改的云端建议，不可用时自动退回本地规则，任何建议都必须由用户确认后才创建任务。

## P1：本地增强能力

- 浏览器内真实读取 TXT、Markdown 和带文本层 PDF；桌面支持拖拽，移动端支持拍摄/选择截图。
- 图片与扫描 PDF 不做假 OCR：没有文本层时必须人工补充原文，文件本体不会进入 IndexedDB。
- 浏览器通知在用户显式授权后真实调度，但仅保证页面保持打开期间触发。
- 项目里程碑可添加、勾选，并与已确认任务的标题、截止和完成状态保持同步。
- 文件库提示可能重复来源，由用户决定保留为独立来源；系统不会自动合并或删除。
- 可录入每周固定课程，并获得避开课程时段的本地开工建议；不会读取系统日历。
- “知识问答”在用户明确授权后检索当前 IndexedDB 中的任务、项目、全部来源摘要、材料和历史；没有引用时明确拒绝补写答案。
- 可选择任务并导出 Obsidian 兼容 Markdown ZIP，或在支持 File System Access API 的浏览器中写入用户主动选择的目录。导出是静态快照，不会自动同步。

### 可选 DeepSeek 代理

DeepSeek 默认未连接，本地知识检索不依赖它。真实云端问答只能由服务端读取 `DEEPSEEK_API_KEY`，前端不会保存或接触密钥：

```dotenv
DEEPSEEK_API_KEY=
DEEPSEEK_API_URL=https://api.deepseek.com/chat/completions
DEEPSEEK_MODEL=deepseek-v4-flash
```

每次云端问答都要求用户确认，只发送当前问题和本地检索命中的最多 4 条引用摘要；没有匹配引用时不会发送。外部来源文本始终按不可信内容处理。不要使用 `VITE_` 前缀配置密钥，也不要提交真实 `.env`。

P1 阶段不包含生产 OCR、邮件发送、网页抓取/监测、微信授权、账号系统或跨设备同步；P2 只在安全边界内增加了下述可选服务基础与诚实的未接通状态。产品范围与开发约束见 [PRD.md](./PRD.md) 和 [AGENTS.md](./AGENTS.md)。

## P2：安全服务接入基础

- 可选 Node.js 本地服务：令牌缺失时同步默认关闭。
- 手动认证拉取/推送、修订号冲突检测、远端摘要预览和二次确认覆盖。
- 服务端工作区使用原子文件写入 `.data/`；该目录不会提交 Git。
- 非敏感服务地址和最后修订保存在 schema v6；令牌不持久化。
- 当前仍不等于云账号或跨设备自动同步。
- 邮件队列支持未配置阻塞、发送失败、有限重试与真实 `sent` 状态；默认适配器关闭。
- 网页监测支持持久化本机基线与可解释的手动差异；可选服务端读取受 HTTPS 白名单、私网阻断和响应上限约束，默认关闭。
- 微信与跨设备页面可记录“已了解接入条件”，但状态仍分别是等待平台审批、需要账号后端；没有真实授权、聊天读取、自动外发或云端同步。

## 当前能力

- 面向新手的首页直接粘贴入口、待确认提醒、最多三项行动重点和可随时重开的 4 步教程。
- 今日排序会解释截止、缺材料、耗时、依赖、日期待确认、手动置顶与稍后状态；支持开始、稍后、置顶、完成及立即撤销完成。
- 桌面确认页并排展示原文与结构化建议，可从字段依据定位并高亮原文；移动端自动改为单栏。
- 粘贴消息、拖拽或选择 20 MB 内的受支持文件、拍摄/选择或直接粘贴截图、录入网页链接，或手动填写任务。
- DeepSeek V4 Flash 已配置时，由服务端代理拆分多事项并建议分类、截止时间、预计耗时、下一步、材料与优先级；页面明确展示发送范围，结果仍需逐项核对、编辑、拒绝或确认。
- DeepSeek 未配置、不可达或返回无效结构时，自动退回可测试的本地规则；裸网页链接不会被假装成已读取正文。
- 生成可编辑的本地规则建议；多时间点、同日多时间、相对日期和日期标题下的编号清单会拆成独立任务，清理常见连接词并分别保留来源依据；时间区间不会重复建项。
- 任务标题会优先提取“提交、参加、上传、核对”等行动及其对象，过滤常见寒暄、转述、强调和礼貌语；原句仍保留在描述与来源依据中，方便人工核对。
- 待确认面板默认使用摘要卡，只有需要修改时才展开字段；支持逐项加入、不需要、部分确认和一键确认剩余任务。
- 新来源不会提前创建空项目；确认前显示项目、任务、时间节点和材料数量预览。待确认列表支持多选确认与可撤销归档，归档不会删除来源。
- 统一任务中心、首页三项重点任务和摘要月历；任务卡突出截止日期与具体时间，并提供醒目的整行“标记完成”操作。
- 月历支持月份切换，每天只显示行动要点、数量、最早时间和必要风险；选择日期后在右侧查看完整清单，任务增多时不再把全部标题挤进日期格。
- 编辑任务字段，并用“缺失、准备中、已准备、已提交、已确认通过、不需要”六种材料状态跟踪进度；每次状态变化都会记录历史。
- 使用版本化本地工作区持久化任务、来源、材料状态、修改历史和提醒设置，并迁移旧版数据。
- 启用页面存活期间的真实浏览器通知；邮件可进入服务端队列，真实发送仍需配置合法 Webhook 适配器并以 `sent` 状态为准。
- 项目里程碑、重复来源人工核对建议、课程时段与避让建议。
- 经授权的本地知识检索、逐条引用，以及选择性 Obsidian Markdown ZIP/目录导出。
- 可替换的 DeepSeek 同源服务端代理；未配置服务端密钥时页面明确显示“尚未连接”。
- 微信与跨设备只展示接入前置条件和可撤销意向记录，不代表已经授权、绑定或同步。
- “隐私与数据”页集中说明本机存储、文件边界、云端发送和备份/清空；主要弹层支持键盘焦点循环、`Escape` 关闭与焦点恢复，次级页面按需加载以缩小首屏脚本。

## 数据保存范围

数据保存在当前设备与浏览器的站点存储中。使用相同的站点地址刷新或关闭后重新打开，数据会自动恢复；更换设备、浏览器、站点地址，或清除浏览器站点数据时不会自动同步。跨设备同步需要后续账号与后端服务。

当前工作区采用 IndexedDB schema v6，将来源、待确认草稿、项目、任务、时间节点、材料、证据、历史和提醒表示为可追溯实体，并安全迁移 schema v3/v4/v5。JSON 备份导入上限为 5 MB；当前 schema 会严格校验必需数组、枚举、日期、唯一 ID、实体引用和任务依赖环，拒绝不完整或被篡改的备份。导入文本始终作为普通数据呈现，不执行其中的 HTML 或脚本。

## 维护与审计

- [架构、数据流、能力状态与依赖许可证](./docs/ARCHITECTURE.md)
- [全面升级审计记录](./docs/PRODUCT_AUDIT.md)
- [安全策略与漏洞报告](./SECURITY.md)
- [发布、回滚与事故运行手册](./RUNBOOK.md)

Pull Request 与受保护分支由 GitHub CI 执行锁定依赖安装、lint、全量测试、生产构建、源码/产物密钥扫描、高危依赖审计和 Cloudflare dry-run。Dependabot 每周只创建更新 PR；大版本仍需人工评估和 Preview 验证。

## Cloudflare 能力边界

Cloudflare Worker 发布 `dist` 静态产物，并通过 Worker Secret 调用 DeepSeek，不把密钥交给浏览器。同步、邮件队列和网页读取仍属于可选本机 Node 服务，未部署到 Cloudflare。当前没有账号系统、Turnstile 或持久化限流，因此代理只具备来源限制、字段最小化、单实例和基础频率保护，不构成用户级鉴权。Cloudflare 生产域名拥有独立的 IndexedDB 站点存储，不会自动继承 localhost、Firebase 或其他旧部署地址的数据。
