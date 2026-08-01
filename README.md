# 学生事务管家

把老师消息、文件、截图和网页通知整理成可确认、可修改、可追溯的任务。

## 本地运行

```bash
npm install
npm run dev
```

浏览器访问终端显示的本地地址（默认 `http://localhost:4173`）。

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
npm run lint
npm run test
npm run build
npm run server:check
```

## Firebase Hosting 部署

Firebase Hosting 是当前生产部署目标。仓库提供根路径构建和单页应用回退配置：

生产站点：[https://student-affairs-nightair.web.app](https://student-affairs-nightair.web.app)

```bash
npm run build:firebase
npm run firebase:serve
npm run deploy:firebase
```

当前仓库已通过 `.firebaserc` 绑定 `student-affairs-nightair`。在新的开发设备部署前，需要先完成有效登录并核对项目：

```bash
npx --yes firebase-tools login
npx --yes firebase-tools projects:list
npx --yes firebase-tools use --add
```

`use --add` 生成的 `.firebaserc` 只包含非敏感项目标识，可以在确认项目无误后提交。不要提交 Firebase 服务账号 JSON、访问令牌、真实用户数据或 `.env`。

Firebase Hosting 只托管 `dist` 静态文件，不能安全保存或代理 DeepSeek API Key。要在 Firebase 生产站点启用 DeepSeek，必须另行部署 Firebase Functions 或 Cloud Run，通过 Secret Manager/服务端环境变量读取密钥，再显式配置 `/api/deepseek` 重写；在此之前页面会正确显示“DeepSeek 尚未连接”。

## P0：可信确认闭环

- 录入会先保存 `Source` 与 `ExtractionDraft`；关闭审核面板不会丢失草稿。
- 一份来源可产生多项独立的时间点、任务与材料建议。每项均可编辑、拒绝、单项确认或全部确认；只有确认项才创建任务。
- 任务关联来源、项目、材料和修改历史；风险与优先级理由来自可测试规则。
- 实体数据保存到 IndexedDB，并会安全迁移旧 localStorage 工作区。项目档案页支持 JSON 导入、导出和二次确认清空。

数据只保存在当前设备、浏览器和站点地址中；不支持跨设备同步。文件本体、大图片不会写入本机工作区；所有自动结果均为可修改的本地规则建议。

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
DEEPSEEK_MODEL=deepseek-chat
```

每次云端问答都要求用户确认，只发送当前问题和本地检索命中的最多 4 条引用摘要；没有匹配引用时不会发送。外部来源文本始终按不可信内容处理。不要使用 `VITE_` 前缀配置密钥，也不要提交真实 `.env`。

P1 阶段不包含生产 OCR、邮件发送、网页抓取/监测、微信授权、账号系统或跨设备同步；P2 只在安全边界内增加了下述可选服务基础与诚实的未接通状态。产品范围与开发约束见 [PRD.md](./PRD.md) 和 [AGENTS.md](./AGENTS.md)。

## P2：安全服务接入基础

- 可选 Node.js 本地服务：令牌缺失时同步默认关闭。
- 手动认证拉取/推送、修订号冲突检测、远端摘要预览和二次确认覆盖。
- 服务端工作区使用原子文件写入 `.data/`；该目录不会提交 Git。
- 非敏感服务地址和最后修订保存在 schema v5；令牌不持久化。
- 当前仍不等于云账号或跨设备自动同步。
- 邮件队列支持未配置阻塞、发送失败、有限重试与真实 `sent` 状态；默认适配器关闭。
- 网页监测支持持久化本机基线与可解释的手动差异；可选服务端读取受 HTTPS 白名单、私网阻断和响应上限约束，默认关闭。
- 微信与跨设备页面可记录“已了解接入条件”，但状态仍分别是等待平台审批、需要账号后端；没有真实授权、聊天读取、自动外发或云端同步。

## 当前能力

- 粘贴消息、拖拽或选择受支持文件、拍摄/选择截图，或录入网页链接。
- 生成可编辑的本地规则建议；多时间点输入会拆成多条独立任务，并分别保留来源依据。
- 统一任务中心、首页三项重点任务和月历。
- 编辑任务字段、勾选材料并自动记录修改历史。
- 使用版本化本地工作区持久化任务、来源、材料状态、修改历史和提醒设置，并迁移旧版数据。
- 启用页面存活期间的真实浏览器通知；邮件可进入服务端队列，真实发送仍需配置合法 Webhook 适配器并以 `sent` 状态为准。
- 项目里程碑、重复来源人工核对建议、课程时段与避让建议。
- 经授权的本地知识检索、逐条引用，以及选择性 Obsidian Markdown ZIP/目录导出。
- 可替换的 DeepSeek 同源服务端代理；未配置服务端密钥时页面明确显示“尚未连接”。
- 微信与跨设备只展示接入前置条件和可撤销意向记录，不代表已经授权、绑定或同步。

## 数据保存范围

数据保存在当前设备与浏览器的站点存储中。使用相同的站点地址刷新或关闭后重新打开，数据会自动恢复；更换设备、浏览器、站点地址，或清除浏览器站点数据时不会自动同步。跨设备同步需要后续账号与后端服务。

## Firebase 能力边界

本轮只配置 Firebase Hosting 静态部署，不包含 Functions、Cloud Run、账号系统或云数据库。同步、邮件队列、网页读取和 DeepSeek 代理仍属于可选本机 Node 服务，不会因 Hosting 部署自动接通。生产域名拥有独立的 IndexedDB 站点存储，不会自动继承 localhost 或旧部署地址的数据。
