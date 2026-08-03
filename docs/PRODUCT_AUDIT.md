# 全面升级审计记录

审计基线：`feature/student-affairs-mvp` 的 `d7f5b1d`。本文件记录代码审查与修复结论；生产是否上线以 Cloudflare 实际部署与浏览器验收为准。

## Critical

- 未在受版本控制的源码、配置、构建产物或 Git 当前历史扫描中发现可识别的真实 API Key、私钥或服务账号 JSON。
- 如果用户曾在聊天、截图或其他渠道公开过旧 Key，代码扫描无法证明其安全；仍应在服务商控制台撤销并轮换，绝不复用聊天中的旧值。

## High

- 已修复：Worker 请求体、模型输出和错误处理边界不足。现已固定模型和 token、限制 Origin/方法/类型/字段/长度/并发/频率，并对 AI 结构和逐字证据二次校验。
- 已修复：当前备份可被静默规范化。schema v6 现在严格拒绝非法枚举、日期、重复 ID、悬空引用与依赖环；schema v3/v4/v5 保留兼容迁移。
- 仍存在：公开站点没有 Firebase Authentication、Cloudflare Access 或 App Check。单实例内存限流不是持久化 WAF，扩大公开调用前必须增加平台级 Rate Limiting/Turnstile 与消费上限。

## Medium

- 已修复：未确认来源会提前创建空项目。项目现在只在首次确认任务时创建。
- 已修复：今日排序依赖静态标签且不可解释。现为纯函数，并尊重完成、稍后、置顶、材料、依赖和用户优先级。
- 已修复：手机教程操作被裁切、主要弹层焦点可逃逸、确认页无法对照原文。现已增加独立滚动、焦点陷阱、双栏/单栏和依据定位。
- 仍存在：`src/styles.css` 包含历史迭代留下的重复选择器，虽然最终层已建立明确覆盖且构建正常，后续应分模块整理以降低回归成本。
- 仍存在：本机 IndexedDB 没有账号恢复或端到端加密；用户清除站点数据且没有 JSON 备份时无法恢复。

## Low

- 已修复：次级页面全部打进首屏包。现在日历、档案、知识问答、服务和隐私页面按需加载。
- 已补充：CI、Dependabot、PR 清单、密钥扫描、架构说明、安全策略和运行手册。
- 保留：Firebase Functions 与本机 Node 服务是替代/回滚适配器，不代表当前 Cloudflare 生产环境已部署这些能力。

## 审计命令

```bash
npm ci
npm run lint
npm run test
npm run build
npm run security:scan
npm audit --audit-level=high
npm run cloudflare:check
```

验证结果和 Preview/生产部署版本在每次发布时追加到 `RUNBOOK.md` 的发布记录，避免用旧结论代表当前线上状态。
