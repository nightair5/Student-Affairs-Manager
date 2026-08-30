# Student Affairs Product v2 Beta Release Scope

> 审计日期：2026-08-28（Asia/Shanghai）
> 审计分支：`codex/v2-beta-release-audit`
> R1：`PRODUCTION_BASELINE_IDENTIFIED`
> R2：`BRANCH_MATRIX_FROZEN`
> Production 基线：本报告识别的历史回滚锚点；2026-08-31 经用户独立明确批准后，RC.4 已部署到 Production，当前状态见 `FINAL_RELEASE_REPORT.md`

## 1. 执行结论

Product v2 Beta 的唯一发布起点确定为：

```text
7a0af21e881dd97ee5c2247e0666a033ff53ae7e
```

该提交已标记并推送不可移动的带注释标签：

```text
v1-production-baseline
```

远端没有 `main` 分支。远端默认分支实际为：

```text
feature/student-affairs-mvp
```

因此后续 `release/v2-beta` 必须从已确认的 Production SHA 创建，不能从不存在的 `origin/main`、当前研究分支或任意日期附近提交创建。

## 2. Production Baseline Identification Report

| 字段 | 结果 |
| --- | --- |
| Production URL | `https://student-affairs.site/` |
| Worker | `student-affairs-manager` |
| Deployment ID | `bc1719b0-2fcf-4f26-b8d1-fc3261588300` |
| Worker Version | `3b6d6ba2-e21f-495c-80e4-c4bac62366be`（Version 13，100% 流量） |
| Deployment createdAt | `2026-08-08T08:55:40.370263Z`（北京时间 `2026-08-08 16:55:40.370263`） |
| Version createdAt | `2026-08-08T08:55:39.744695Z` |
| Worker script ETag | `c212701f192899e8f2d7c336986ca2536044b452e71acc701fdb19e2cd95b040` |
| Exact Git commit | `7a0af21e881dd97ee5c2247e0666a033ff53ae7e` |
| Git tree | `2b6b318ae105f91bd66b577582d1af4573472cd1` |
| Production tag | `v1-production-baseline` |
| Confidence | `HIGH` |
| Release base recommendation | `7a0af21e881dd97ee5c2247e0666a033ff53ae7e` |

## 3. 基线证据链

### 3.1 Cloudflare 控制面

只读 `wrangler deployments/versions` 结果确认当前 Deployment 与 Version，部署来源为 `wrangler`。Version 绑定 Static Assets 与服务端 `DEEPSEEK_API_KEY` Secret 类型，但控制面元数据本身没有保存 Git SHA、分支或 commit message。

### 3.2 生产制品逐字节复现

在 `7a0af21` 上使用锁文件执行确定性构建。线上实际使用的 15 个 JavaScript、CSS 与 MJS 文件全部与本地构建逐字节一致：

```text
15 / 15 assets matched by SHA-256
```

关键文件包括：

| 文件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `assets/index-k66ICz0e.js` | 336,664 | `6C617A40A9C92834BB41D52ED2613D1933247045BBEB75D311953BADAF1626BB` |
| `assets/index-VgpuoBT3.css` | 119,713 | `A448CDF8E8BE45EAB68488559722E76E3F8ECCBA4791D24628CB5469865269E3` |
| `assets/pdf.worker.min-CHFwMXne.mjs` | 1,262,398 | `0613F41490DD6AACEED7A93FBBD38C85E6D6AA60474B6588C6E7709CFBE18CB3` |

`index.html` 经 Cloudflare Static Assets 提供时存在字节表现差异，因此没有把入口 HTML 的哈希当作提交证明；判断只使用全部可寻址哈希制品。

### 3.3 唯一提交的部署回执

Git tree `2b6b318...` 同时属于功能提交 `a8fe6d8` 与 release merge `7a0af21`，仅靠制品不能区分两者。历史部署回执补足了唯一提交关系：

1. 在 `feature/student-affairs-mvp` 中完成 `a8fe6d8` 的 release merge，生成 `7a0af21`。
2. 随即将 `6cee280..7a0af21` 推送到远端正式产品分支。
3. 同一部署会话明确记录“发布同一提交到 Cloudflare 生产环境”。
4. 随后的 `npm run deploy:cloudflare` 返回当前仍在服役的 Version `3b6d6ba2-e21f-495c-80e4-c4bac62366be`。
5. `7a0af21` 提交时间为北京时间 `16:54:47`，Version 创建时间为 `16:55:39.744695`，顺序一致。

因此 `a8fe6d8` 是内容相同的第二父提交，但不是本次 Production release ref；Production Git 基线确定为 `7a0af21`。

## 4. 已知限制与待关闭证据

- Cloudflare Version 没有内建 Git SHA；本次绑定依赖控制面、全量制品哈希与原始部署回执的交叉证据。v2 Beta 必须增加可审计的 release metadata。
- `7a0af21` 当时的 GitHub Actions 在 adapter tests 阶段失败，后续 build、安全、审计和 Cloudflare 检查被跳过。线上可用不等于历史 CI 全绿。
- `/api/deepseek/status` 当前返回 `configured: true` 与 `deepseek-v4-flash`，但本阶段没有调用付费模型，不能据此声称上游实时调用已通过。
- Production CSP 当前为 Report-Only。是否升级为强制 CSP 必须在 Preview 回归后决定。
- 线上当前仍为 Workspace schema v7；canonical v8、迁移与回滚尚未进入 Production。

## 5. Beta 纳入范围

### MUST INCLUDE

按依赖顺序纳入完整 E1 产品前缀，且每个提交单独验证：

```text
1506f7d  timezone semantics
ddebe7c  Workspace v8 domain contract
dca382d  canonical workspace v8 persistence
09b9798  v7 -> v8 runtime migration
dbc8945  rich RecognitionResult atomic commit
3907733  canonical v8 workflow activation
```

Beta 的核心闭环限定为：

```text
Capture
-> Source 先保存
-> RecognitionRun / Draft
-> Evidence 与不确定性可见
-> 用户逐项确认、编辑或拒绝
-> DomainCommitPlan 原子提交
-> Workspace v8
-> Today / Project / Calendar
```

### ALREADY IN PRODUCTION

Production 基线已经包含：

- 综合工作流、本地 OCR 与移动端基础能力；
- 项目层级识别 v2 的既有实现；
- 公网 HTTPS 读取的 SSRF 防护路径；
- 视觉重构与颜色可读性修复；
- DeepSeek 同源代理、Source-before-AI 与可编辑 Draft 的 v7 产品路径。

这些能力不得重复 cherry-pick；在 release 分支只做兼容、降级和收敛。

### DEFER

- 通用知识问答与 Obsidian 导出入口；
- 复杂周报/月报与非核心报告能力；
- 自动 E3 项目匹配；
- 自动 E4 补充通知变更；
- 跨设备、微信、自动邮件、支付和账号系统；
- 当前失败的 Dependabot 大范围升级。

### RESEARCH ONLY / REJECTED

- E2.5–E2.9 与 R1–R10 的 benchmark、Blind、Selection、Scorer、Planner、FactLedger、Durable Object ledger、实验 bearer 与 Preview route；
- Vision Exp、V4 Pro 与其他未过门槛模型候选；
- 归档 R10 分支 `archive/e2-r10-20260826`。

## 6. R3 进入条件

R1 与 R2 的 Git/基线条件已满足。R3 可以从以下精确提交创建独立工作树：

```text
C:\Users\Winner\student-affairs-release
release/v2-beta
7a0af21e881dd97ee5c2247e0666a033ff53ae7e
```

后续仍需逐项关闭 migration、rollback、双时区测试、浏览器 A–J、Preview 隔离与 48 小时稳定期。任何失败不得用本报告替代。
