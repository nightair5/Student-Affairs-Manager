# Product v2 Beta Release Report

> 报告分支：`release/v2-beta`
> 证据检查点：`2a95dba23e18ea2fcde8e1e0dd9754db4f79fce8`
> Preview build：`2a95dba23e18ea2fcde8e1e0dd9754db4f79fce8`
> RC：`v2.0.0-beta.1-rc.4`
> 报告状态：`DRAFT — RELEASE CANDIDATE NOT READY`

## 1. Executive Summary

R1–R8 的产品与工程整合已经进入独立 `release/v2-beta`，Workspace v8、Source-first Capture、可编辑 Human Review、原子提交、核心 IA 和实验运行时隔离均已实现并通过自动门禁。R10 Alpha Test Kit 已准备。RC.1 的 Event P1、RC.2 的 Import 数据完整性 P0、RC.3 的 PDF 本地确认 P1 均按门禁停止、修复并重新生成 RC；RC.4 已通过 H/J、Preview 浏览器迁移/恢复与 Cloudflare Preview Version 回退演练，R11 从最终恢复 Deployment 重新计满 48 小时。

当前不得宣布 RC Ready：RC.4 的 48 小时稳定期尚未关闭；旧 Production 对实验样式路径仍为 SPA HTML 200。Production 未获授权且未部署。

## 2. Current Production baseline

| 字段 | 值 |
| --- | --- |
| URL | `https://student-affairs.site/` |
| Git commit | `7a0af21e881dd97ee5c2247e0666a033ff53ae7e` |
| Tag | `v1-production-baseline`（带注释、不可移动） |
| Deployment | `bc1719b0-2fcf-4f26-b8d1-fc3261588300` |
| Version | `3b6d6ba2-e21f-495c-80e4-c4bac62366be` |
| 本任务改动 | 无 |

完整证据见 [RELEASE_SCOPE.md](./RELEASE_SCOPE.md)。

## 3. Research freeze

E2 complex recognition、R1–R10 research、Selection、Blind、FactLedger、Scorer、Planner、Durable Object ledger、实验 bearer 与实验 custom route 全部保持研究限定。Beta 不重新启动模型实验，不用失败 Holdout/Blind 结果替代产品验收，不整体合并 R10。

## 4. Branch integration matrix

冻结矩阵位于 [BRANCH_INTEGRATION_MATRIX.md](./BRANCH_INTEGRATION_MATRIX.md)。唯一 MUST INCLUDE 是完整六提交 E1 前缀；已上线产品能力不重复 cherry-pick，E2/实验分支不进入 release runtime。

## 5. Included commits

从 Production 基线到 Preview build 的运行时提交：

```text
9d25aed  timezone semantics
87f4b47  Workspace v8 domain contract
67b83e7  canonical v8 persistence
5f7a550  v7 -> v8 runtime migration
7aeb1d3  rich result atomic commit
7d9c8fc  canonical v8 workflow activation
ff61f6a  calendar reminders and CI
e2f61c3  migration recovery hardening
2aa24e1  canonical compatibility facts
a8e76de  trusted canonical workflows
f4d316b  manual extraction fallback
58da10b  experimental route isolation
69ccfe6  beta human review workflows
5c443d4  workspace timezone stabilization
e3bdf47  selected Event timepoint preservation
5ed3de7  canonical facts preserved after import
2a95dba  local PDF suggestion confirmation hardening
```

发布文档提交继续位于同一分支，但未重新部署应用制品。

## 6. Excluded research commits

所有 `codex/e2-*` tips、`codex/e2-9-*` tips、Vision Exp `e097887` 与 R10 archive `a2df4d5` 均未合入。排除原因分别为 RESEARCH ONLY、Holdout/协议/内部门槛失败或运行时风险，详见矩阵。

## 7. Workspace v8 status

v8 是 IndexedDB 唯一事实源。顶层 canonical 数组不由 `ParsedSuggestion`、`recognitionToLegacySuggestions`、`materializeWorkspaceEntities` 或 React 兼容视图重建覆盖。Workspace graph、JSON-safe metadata、来源版本、运行、草稿、证据、项目、事件、时间、材料、历史和提醒均有验证器及回归测试。

## 8. Migration and rollback

迁移使用“先持久化不可变 v7 备份 → 内存迁移 → 全图校验 → semantic round-trip → 单事务替换”。代码级迁移、lineage、篡改拒绝与恢复 UI 测试 PASS；RC.4 隔离 Edge 已通过真实 v7→v8、不可变备份下载、故障注入、二次确认恢复和刷新保持，Cloudflare Preview Version 也完成 RC.4→RC.3→RC.4 回退/恢复演练。详见 [MIGRATION_ROLLBACK.md](./MIGRATION_ROLLBACK.md)。

## 9. AI Beta policy

AI 可选、逐次同意、可编辑、只生成 Draft。Key 只在服务端；不可观测 Token/Cost 不估算。模型失败保留 Source 并提供本地规则/手动补充。Production Prompt、实验模型和复杂两阶段研究路径不进入本次 Beta。

## 10. Human review design

默认只选择 `explicit` 事项；`strong_inference` 与 `optional_suggestion` 显著标记。用户可以逐项编辑、拒绝、部分确认，查看 SourceVersion 绑定依据并选择项目。确认后生成 `DomainCommitPlan`，单事务写入；重复 operation ID 幂等，旧 Run 不覆盖新版本。

## 11. Information architecture

默认路径为“粘贴通知 → 核对拆分 → 今日行动”。一级执行导航是 Today、Inbox、Pending、Project、Calendar、Library；所有任务、知识问答和报告为低频工具。核心页面保留键盘、语义标签、Escape 与 reduced-motion 支持。

## 12. Inbox

Source Inbox 展示 `unprocessed`、`processing`、`needs_review`、`confirmed`、`failed`、`archived`、`info_only`。聚合只采用当前 SourceVersion 的最新 Run/Draft；stale processing 可恢复，重试不创建重复 Source。

## 13. Triage

待确认队列支持复杂通知摘要卡、按需展开、字段依据定位原文、手动编辑和项目选择。纯信息可以保存但不创建伪任务；材料、背景、联系人、地址和格式限制不单独冒充 Task。

## 14. Project

项目页读取 canonical Project、Milestone、WorkPackage、Task、Event、TimePoint 与 Material。自动 E3 项目匹配未开放；补充通知可以关联已有项目，再由用户手动编辑，不阻塞 Beta。

## 15. Today

Top 3 只含当前可执行任务；完成、稍后、受阻、等待、置顶和用户优先级通过纯函数排序。卡片展示任务名、截止日期与时间、预计耗时、下一步和风险；blocked/waiting 单独展示。

## 16. Manual E3 fallback

用户在确认时显式选择现有项目或创建项目。系统不得自动合并项目、覆盖已确认时间或把匹配建议直接写入 canonical facts。

## 17. Manual E4 fallback

补充通知保存为新的 Source/SourceVersion。Beta 可以将 Source 关联已有 Project，并由用户手动新增、修改或取消任务/材料/日期；自动 diff/Apply 尚未开放。

## 18. Experiment cleanup

release Worker 对 `/benchmark*`、`/e2*`、`/fact-ledger*`、`/selection*`、`/blind*`、`/research-preview*` 返回 JSON 404，且没有研究 Durable Object、实验 bearer 或实验 model allowlist。Preview 实测 404；旧 Production SPA fallback 仍为 HTML 200，字面门槛未关闭。

## 19. Browser A–J

场景与合成输入冻结在 [QA_ACCEPTANCE.md](./QA_ACCEPTANCE.md)。2026-08-30 的当前 RC.4 已完成 A–J 核心链，P0 = 0、P1 = 0。D 的 structured material requirements 为空且多出 `PDF格式）` Material，但原始 Source/Evidence/命名要求可回看、确认前可调整，无数据丢失或静默提交，因此按附件允许的复杂通知人工调整口径判为 `PASS（P2）`，缺陷继续透明披露。RC.1 的 Event TimePoint、RC.2 的 Import canonical 改写和 RC.3 的 PDF 本地确认问题均曾按 P1/P0 作废窗口并最小修复；RC.4 以 Edge 152.0.4191.53 完成文本层 PDF、扫描 PDF、原子确认、刷新持久化、最终 `.json` round-trip、失败导入保护、v7 迁移与故障恢复，全程零付费模型调用。

## 20. Engineering tests

`npm ci`、lint、typecheck、UTC/Asia-Shanghai 两套完整测试、build、security scan、npm audit high、Cloudflare dry-run 与 diff check 全部 PASS。当前每套完整测试包含 Vitest 43 files / 256 tests、Server 8、Worker 19、Functions 5；精确提交 CI run `33315897535` 为 success。

## 21. Security

自动证据覆盖 Key 服务端化、Origin、Content-Type、请求体大小、Prompt injection、SSRF 与每跳 redirect 复核、安全错误、实验 route isolation 和 Secret scan。RC.4 已部署首页及 2 个 JS/CSS 资产共 627,422 bytes 的范围扫描中，有界 Secret-like key 与 `DEEPSEEK_API_KEY` 前端名称命中均为 0；Workspace v8 导出及两类 PDF 全链也未发现 Secret 或文件本体，模型调用为 0。Preview/Production Deployment 与 Version 保持隔离；旧 Production 的实验样式路径字面 404 仍是独立未关闭门槛。

## 22. Reliability

自动证据覆盖 AI 失败不丢 Source、确认单事务、迁移失败不覆盖、导入失败不替换、幂等 operation、late run ownership、Error Boundary 与手动继续。RC.4 隔离 Edge 又通过键盘打开/焦点/Escape、连续双击确认只创建 1 Task、模拟网络中断后 Source 先保存且正式 Task 为 0、本地规则恢复与刷新保持；付费模型调用 0。浏览器返回离开根路径作为 P2 导航体验问题保留，可靠性门槛 `PASS`。

## 23. Performance

RC.4 隔离 Edge 的用户可交互观测为：首页冷/热 1772/995 ms、Inbox 49 ms、Project 363 ms、普通确认 134 ms；文本层 PDF 提取 840 ms、扫描 PDF OCR 3379 ms；模拟断网 922 ms 出现反馈，本地恢复确认 926 ms；刷新恢复 995–1918 ms。未观察到主页面卡死、无限 Loading、20 秒无反馈或 AI 阻塞页面。真实上游 AI 成功延迟依照“不得调用付费模型”约束记为 `NOT RUN`，不以 HTTP 或构建时间替代。

## 24. Known limitations

- 复杂通知、相对时间、关键日期和材料需要用户重点核对。
- 自动项目匹配和补充通知自动变更未开放。
- OCR 结果可能需要校对，扫描 PDF 受页数和资源限制。
- AI 可能遗漏或误解信息；建议不是正式任务。
- 浏览器通知依赖页面存活；邮件、微信、跨设备与账号未接通。
- 当前 RC.4 的 48 小时稳定期尚未完成；迁移/回退演练、A–J、非付费范围性能和可靠性已通过，移动端布局与弹层独立滚动已验证，但不等于真实手机完整业务链通过。

## 25. Alpha test kit

5–10 名学生的说明、隐私、匿名化、五项任务、观察表、指标、AI 修改分类、反馈表、Bug 模板、退出与删除步骤已集中在 QA 文档。真实参与者运行与指标均 `NOT RUN`，不得伪造。

## 26. Preview deployment

| 字段 | 值 |
| --- | --- |
| URL | `https://student-affairs-manager-preview.nightsdell.workers.dev/` |
| Worker | `student-affairs-manager-preview` |
| Version | `1d6dc48e-167f-491b-ae55-908a9f2f27b9` |
| Deployment | `8bad8cc4-ea86-4a1e-ad7a-1560e010cae2`（回退演练后最终恢复） |
| Tag | `v2.0.0-beta.1-rc.4` |
| Build commit | `2a95dba23e18ea2fcde8e1e0dd9754db4f79fce8` |
| Version created | `2026-08-30T14:07:11.694749Z` |
| Final deployment created | `2026-08-30T14:13:52.399392Z` |
| Production routes | 无 |

48 小时心跳 `v2-beta-preview-48h` 已改绑 RC.4 最终 Deployment。RC.1/RC.2/RC.3 与 RC.4 回退演练前窗口均不拼接；最早只能在 `2026-09-01 22:13:52.399392 Asia/Shanghai` 判定满期。

## 27. Rollback procedure

P0/P1 时停止新功能和 Production 准备，记录失败 Version/commit，先导出浏览器数据与迁移备份，再把 Preview 流量回退到最近通过门禁的 Version。任何 Production 回滚或部署均需独立明确批准。

## 28. Release notes

用户可见变化、数据/AI 边界、限制与验证状态见 [RELEASE_NOTES.md](./RELEASE_NOTES.md)。当前文案明确“validation in progress”，没有将 Preview 当 Production。

## 29. Remaining P2/P3 and branch cleanup proposal

P2/P3 在 48 小时稳定期后处理，不得在稳定期增加功能：

| 等级 | 问题 | 当前保护 | 后续处理 |
| --- | --- | --- | --- |
| P2 | 多材料通知的本地规则会把部分格式/命名文本拼入 Material 名称，并可能额外生成 `PDF格式）` Material；真实 v8 导出中对应 structured requirements 为空 | 原始 Source、任务描述和 Evidence 仍可回看，用户确认前可取消材料；无数据丢失或静默正式任务 | 稳定期后改进确定性材料解析与结构化材料编辑，并增加匿名 D 场景回归 |
| P2 | information-only Source 当前以 invalid result/识别失败呈现，而非专门的“仅保存资料”完成状态 | Source 已保存且正式实体计数为 0，不生成伪任务 | 稳定期后增加准确状态文案，不改变 canonical 数据 |
| P2 | 应用内页面切换不写入浏览器 history；从 Inbox 按浏览器返回会离开 Preview，而不是回到 Today | 应用内侧栏和手机底部导航可正常返回 Today，数据不受影响 | 稳定期后增加受控 history/state 同步与返回回归 |

上述 P2 不满足 P0/P1 定义，不中断 RC.4 可用性监测。D 的核心 Capture→Refresh 链按 Beta 人工调整口径通过，structured requirements 缺口仍按 P2 保留，不能据此声称结构化材料解析已完善。先前 `.crdownload` 观察已由隔离 Edge 的最终 `.json` 下载与精确 round-trip 证伪为控制扩展产物，不再列为产品缺陷。

分支建议：

| 分类 | 分支 | 动作 |
| --- | --- | --- |
| KEEP | `feature/student-affairs-mvp` | 保留当前 Production 基线 |
| KEEP | `release/v2-beta` | 保留 RC 与后续批准链 |
| ARCHIVE AFTER RC | `codex/v2-beta-release-audit` | `107e14b` 已由 `94361da` patch-equivalent 纳入；当前仍绑定独立 worktree，先保留到 RC 结论固定 |
| ARCHIVE | `codex/e2-9-r10-facts-first-preview` | 已有 `archive/e2-r10-20260826`，只保留研究证据 |
| ARCHIVE | 其余 `codex/e2-*` / `codex/e2-9-*` | 先打归档标签，禁止合入产品 |
| KEEP | E3/E4 prep（如单独建立） | 仅准备，不在本任务实现 |
| DEFER / REVIEW | `dependabot/*` | 均未纳入 RC；Beta 后逐条重建并重新跑完整门禁，不批量合并或删除 |
| DELETE AFTER APPROVAL | 已被 release 吸收的旧 E1 中间分支 | 仅用户明确批准后删除 |
| DELETE AFTER APPROVAL | 已归档且无开放引用的失败实验分支 | 先核对 tag、PR 和 worktree，再批准删除 |

本任务不删除任何远程分支，不强推，不移动归档或 Production 标签。当前仍有 7 个本地 worktree；任何候选分支在解除 worktree 绑定、核对未提交资产和远端归档标签之前均不得删除。

## 30. Production approval checklist

- [x] Production commit 精确识别并标记不可移动 tag
- [x] release 分支独立且已推送
- [x] E1 / v8 / Human Review / experiment isolation 已整合
- [x] 工程与安全自动门禁通过
- [x] Browser A–J 通过，P0 = 0，P1 = 0
- [x] Preview 浏览器 migration / rollback 演练通过
- [x] 非付费范围真实性能记录完成；真实上游 AI 成功延迟按约束 NOT RUN
- [ ] Preview 连续稳定满 48 小时
- [ ] Production 实验样式路径实际返回 404
- [ ] 最终 QA/报告状态已从 NOT RUN 更新为 PASS
- [ ] 用户对独立 Production Release Task 明确批准

### 当前最终判定

```text
RELEASE CANDIDATE NOT READY
PRODUCTION RELEASE NOT AUTHORIZED
```

只有全部未勾选门槛被当前证据关闭后，才允许把本节改为：

```text
PRODUCT V2 BETA RELEASE CANDIDATE READY
PRODUCTION RELEASE AWAITING APPROVAL
```
