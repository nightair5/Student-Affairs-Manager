# E2-MM 独立 Preview 部署记录

## 结论

独立多模态实验 Preview 已部署，但没有为该 Worker 配置 `DEEPSEEK_API_KEY`。因此页面和安全关闭路径可访问，真实多模态模型调用仍为 `NOT RUN`；这不是多模态质量、浏览器验收或替换稳定模型的通过证据。

## 可复核标识

- 基线：`v2.0.0-beta.1-rc.4` / `2a95dba23e18ea2fcde8e1e0dd9754db4f79fce8`
- 实验分支：`codex/e2-multimodal-recognition-exp`
- 协议提交：`f5978e6`
- 实现提交：`aad25a6`
- Worker：`student-affairs-manager-multimodal-exp`
- URL：<https://student-affairs-manager-multimodal-exp.nightsdell.workers.dev/>
- Cloudflare Version：`72d876a4-1bbd-453c-b0d9-397aef3b275b`
- 创建时间：`2026-08-31 01:01:29.125 Asia/Shanghai`
- 配置状态：`DEPLOYED_NOT_CONFIGURED`

## 线上只读探针

2026-08-31 01:01–01:03 Asia/Shanghai：

- Preview 首页返回 HTTP 200，使用独立静态资源 `index-BOp-j9c1.css` / `index-Bz7D0jKa.js`。
- `/api/deepseek/status` 返回 HTTP 200、`configured:false`、稳定文字模型 `deepseek-v4-flash` 和实验模型 `deepseek-v4-flash-vision-exp`。
- 未设置 Secret、未发送真实正文或图片、未调用付费模型。

## 工程门槛

- `npm run lint`：PASS。
- `npm run test`：PASS；Vitest 44 个文件 / 260 项，Node 服务端 8 项，Cloudflare Worker 20 项，Firebase Functions 5 项。
- `npm run build`：PASS；保留现有大 chunk 警告，不冒充性能验收。
- `npm run security:scan`：PASS。
- `npm audit --audit-level=high`：PASS，0 个已知漏洞。
- `npm run cloudflare:check`：PASS，包含独立 `multimodal_preview` dry-run。
- `git diff --check`：PASS。

这些结果只证明工程与 Mock 门槛，不替代真实浏览器 A–J、隐私存储检查、未见材料三臂比较或用户修改时间。

## 发布隔离回验

- RC.4 运行时代码仍为 `2a95dba23e18ea2fcde8e1e0dd9754db4f79fce8`。
- RC.4 Preview 仍为 Version `1d6dc48e-167f-491b-ae55-908a9f2f27b9`，首页 HTTP 200。
- 当前 Production 为 Version `d245a1dc-73a7-42fe-a088-ae0b0ddc3678`，与 RC.4 Preview 返回相同静态资源 `index-DNrLqevz.css` / `index-ZTONh-gk.js`。
- Production 部署发生在本实验 Worker 创建之前，且本实验配置没有 Production Route 或 Custom Domain；本次实验部署未改变 Production 或 RC.4 Preview。
- 现有 Production RC.4 48 小时监测保持 `ACTIVE`，从 `2026-08-31 00:57:56.978876 Asia/Shanghai` 重新起算，最早完成点为 `2026-09-02 00:57:56.978876 Asia/Shanghai`。

## 未完成与阻断

- 需要由有权限的维护者为独立环境执行 `wrangler secret put DEEPSEEK_API_KEY --env multimodal_preview`；密钥不得进入命令历史、Git、日志、前端或导出文件。
- Secret 配置后仍只能先做匿名安全冒烟和 A–J 浏览器验收，不得直接运行正式未见材料或切换 Production。
- I 图片版消融入口、三臂评分器、Unseen-1、用户修改时间、Unseen-2 与替换决策均未完成。
