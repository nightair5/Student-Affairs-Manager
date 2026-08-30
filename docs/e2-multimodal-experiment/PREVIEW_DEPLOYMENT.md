# E2-MM 独立 Preview 部署记录

## 结论

独立多模态实验 Preview 已部署，并在 2026-08-31 01:11:40 Asia/Shanghai 从剪贴板直接配置了 Cloudflare `DEEPSEEK_API_KEY` Secret；密钥未回显、未落盘、未进入 Git。后续真实烟测证明上游鉴权失败，因此当前只能标记为 `SECRET_PRESENT_AUTH_FAILED`，不能标记“已连接”。

## 可复核标识

- 基线：`v2.0.0-beta.1-rc.4` / `2a95dba23e18ea2fcde8e1e0dd9754db4f79fce8`
- 实验分支：`codex/e2-multimodal-recognition-exp`
- 协议提交：`f5978e6`
- 实现提交：`aad25a6`
- Worker：`student-affairs-manager-multimodal-exp`
- URL：<https://student-affairs-manager-multimodal-exp.nightsdell.workers.dev/>
- 首次部署 Version：`72d876a4-1bbd-453c-b0d9-397aef3b275b`
- Secret Change Version：`ab4fc524-95e5-48ec-a4bb-c92a8aa61a02`
- 安全错误分类提交：`607c2a2`
- 当前实验 Version：`71f0fffb-21a1-4faa-ad29-830a443ecfd9`
- 创建时间：`2026-08-31 01:01:29.125 Asia/Shanghai`
- 配置状态：`SECRET_PRESENT_AUTH_FAILED`

## 线上只读探针

2026-08-31 01:01–01:03 Asia/Shanghai：

- Preview 首页返回 HTTP 200，使用独立静态资源 `index-BOp-j9c1.css` / `index-Bz7D0jKa.js`。
- Secret 配置前 `/api/deepseek/status` 返回 `configured:false`；配置后返回 HTTP 200、`configured:true`、稳定文字模型 `deepseek-v4-flash` 和实验模型 `deepseek-v4-flash-vision-exp`。
- 数据冻结完成前未发送正文或图片、未调用付费模型。

2026-08-31 01:41–01:51 Asia/Shanghai 的三次新标签运行均未产生有效预测。最终诊断 Run `synthetic-unseen-v1-diagnostic-20260831c` 对同一冻结案例各调用 T/I/IT 一次，三臂都返回 `503 UPSTREAM_AUTH_FAILED`。未继续运行 36×3，避免产生 108 次确定无效的调用。

## 工程门槛

- `npm run lint`：PASS。
- `npm run test`：PASS；Vitest 44 个文件 / 260 项，Node 服务端 8 项，Cloudflare Worker 22 项，评测库 4 项，Firebase Functions 5 项。
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

- Secret 已存在但鉴权失败；不得在有效凭证与 1×3 新标签烟测通过前运行完整 36×3。
- 合成批次完成后仍需 A–J 浏览器验收，不得据此直接运行正式真实材料或切换 Production。
- I 图片版消融入口与三臂评分器已完成工程验证；质量比较、真实用户修改时间、真实 Unseen-1/2 与替换评审均未完成。
