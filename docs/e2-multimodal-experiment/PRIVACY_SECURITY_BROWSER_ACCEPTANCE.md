# E2-MM 隐私、安全与浏览器验收

状态枚举仅允许 `PASS`、`FAIL`、`NOT RUN`。静态检查、Mock 单测、HTTP 200 不能替代真实浏览器证据。

| ID | 必需证据 | 当前状态 |
|---|---|---|
| A | 上传截图/照片后开关默认关闭；网络请求只有 OCR 文字，没有图片 data URL | NOT RUN |
| B | 开关旁逐项展示实际发送范围与不发送范围；键盘可聚焦、切换并读取标签 | NOT RUN |
| C | 开启图片后只发送当前 1 张原图；更换文件会撤销 consent，不能沿用 | NOT RUN |
| D | 扫描 PDF 只能发送用户填写的 1–4 页；越界、错误页码、超限均阻止提交 | NOT RUN |
| E | 关闭开关、云端未配置或图片格式不支持时，默认文字路径仍可用且不伪装多模态 | NOT RUN |
| F | IndexedDB、JSON 备份、Obsidian/CSV 导出、控制台与 Worker 日志均不含 data URL、文件本体或图片字节 | NOT RUN |
| G | Worker 拒绝无 consent、未知字段、SVG/HEIC、MIME 不匹配、超过 4 张、单张/总大小超限、跨域与缺 Secret 请求 | NOT RUN |
| H | 多模态超时、上游错误或无效结构时，Source 已先持久化，正式任务为 0，用户可回到文字/本地路径 | NOT RUN |
| I | 多模态输出只进入待确认；逐项编辑、拒绝、部分确认、刷新恢复均保持现有可信闭环 | NOT RUN |
| J | Chrome/Edge 桌面与 320/375/390/430/768/1024px 下开关、说明、页码、错误和提交按钮均可见；`Tab`/`Escape` 与 reduced motion 无回归 | NOT RUN |

## 工程检查（不能替代 A–J）

- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run security:scan`
- `npm audit --audit-level=high`
- `npm run cloudflare:check`
- `git diff --check`

## 发布隔离检查

- Production Deployment/Version 不变。
- RC.4 Preview Deployment/Version 不变，48 小时计时不重置。
- Multimodal Preview 使用独立 Worker 名、独立 workers.dev URL、无 Custom Domain。
- 未取得全 PASS 前不得合并 `release/v2-beta`、移动 RC tag 或切换 Production 模型。
