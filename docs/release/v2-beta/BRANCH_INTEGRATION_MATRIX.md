# Product v2 Beta Branch Integration Matrix

> 冻结日期：2026-08-28
> Production base：`7a0af21e881dd97ee5c2247e0666a033ff53ae7e`
> Production tag：`v1-production-baseline`

## 1. 决策规则

| 分类 | 含义 |
| --- | --- |
| `MUST INCLUDE` | Beta 核心闭环所必需，且需要在 release 分支重新验证 |
| `SHOULD INCLUDE` | 有明确核心价值，但不阻塞 Beta；本轮没有此类项 |
| `DEFER` | 保留分支或现有代码，但不扩大为 Beta 主能力 |
| `RESEARCH ONLY` | 仅保留研究证据，不进入产品运行时 |
| `REJECTED` | 已失败、被门禁拒绝或风险超过 Beta 收益 |
| `ALREADY IN PRODUCTION` | 已是 `7a0af21` 祖先，不得重复合并 |

## 2. E1 核心提交

六项构成从 Production 直接延伸的线性链：

```text
7a0af21
  -> 1506f7d
  -> ddebe7c
  -> dca382d
  -> 09b9798
  -> dbc8945
  -> 3907733
```

| 分支/提交 | 能力 | 是否在 Production | 测试证据 | 用户价值 | 风险 | Beta 决定 | 合并方式 |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| `1506f7d` | timezone semantics | 否 | 历史 CI success | 防止跨时区日期漂移 | 日期兼容 | MUST INCLUDE | 首项，`cherry-pick -x` |
| `ddebe7c` | Workspace v8 domain contract | 否 | 历史 CI success | 建立唯一事实源 | schema 兼容 | MUST INCLUDE | 依赖 `1506f7d` |
| `dca382d` | canonical v8 persistence | 否 | 历史 CI success | rich entity 不再被 legacy view 覆盖 | 持久化回归 | MUST INCLUDE | 依赖 `ddebe7c` |
| `09b9798` | v7 -> v8 migration | 否 | 历史 CI success | 保护现有用户数据 | 最高迁移风险 | MUST INCLUDE | 依赖 persistence；必须实测迁移/回滚 |
| `dbc8945` | rich RecognitionResult atomic commit | 否 | 历史 CI success | 确认后原子写入完整事实 | 半提交/幂等 | MUST INCLUDE | 依赖 repository/migration |
| `3907733` | canonical v8 workflow activation | 否 | 历史 CI success | 激活正式 v8 产品路径 | UI 兼容 | MUST INCLUDE | 最后一项；到此停止 E1 |

六项对 Production 均为 `NOT_ANCESTOR`，`git cherry -v 7a0af21 <commit>` 均为 `+`，没有 patch-equivalent 重复项。`7a0af21..3907733` 只有上述六个提交，未发现 E2/benchmark/experiment 运行时夹杂。

## 3. 产品与审计分支

| 分支/提交 | 能力 | 是否在 Production | 测试证据 | 用户价值 | 风险 | Beta 决定 | 合并方式 |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| `feature/student-affairs-mvp@7a0af21` | 当前远端默认产品线 | 是 | Production 制品与部署回执；历史 CI fail | 已上线产品基线 | v7、历史 CI 未闭合 | ALREADY IN PRODUCTION | 仅作为 release 起点 |
| `codex/v2-beta-release-audit@107e14b` | R1–R2 审计分支 | 否；相对 Production 增加两份文档 | `git cherry release/v2-beta codex/v2-beta-release-audit` 为 `- 107e14b`；release 中 patch-equivalent 为 `94361da` | 固化审计证据 | 无运行时差异 | DEFER | 补丁已等价纳入，不整体合并或重复 cherry-pick |
| `codex/e1-phase0-green-ci@ddebe7c` | timezone + v8 contract 中间点 | 否 | 两项历史 CI success | E1 前缀 | 单独合会重复 | MUST INCLUDE | 由完整六提交顺序覆盖 |
| `codex/e1-phase-b-canonical-persistence@3907733` | 完整 E1 canonical v8 | 否 | 六项历史 CI success | Beta 数据底座 | migration/rollback | MUST INCLUDE | 六项逐个纳入，停在 `3907733` |
| `codex/feature/comprehensive-upgrade@9db55ba` | 智能工作流、OCR、移动端等 | 是 | 为 `7a0af21` 祖先 | 已上线能力 | 功能过宽 | ALREADY IN PRODUCTION | 不重复合并，做导航收敛 |
| `codex/feature/project-recognition-v2@a8fe6d8` | 项目层级识别 v2 | 是 | `7a0af21` 第二父提交 | 已上线识别路径 | 自动匹配边界 | ALREADY IN PRODUCTION | 不重复合并；E3 降级人工 |
| `codex/feature/public-web-reading@d074e30` | 公网 HTTPS 读取 | 是 | 为 `7a0af21` 祖先 | 已上线网页入口 | SSRF/不可信内容 | ALREADY IN PRODUCTION | 不重复合并；重跑安全测试 |
| `codex/feature/student-affairs-color-refinement@1e37b0f` | 颜色与文本可读性 | 是 | 为 `7a0af21` 祖先 | 改善扫读 | 视觉回归 | ALREADY IN PRODUCTION | 不重复合并 |
| `codex/feature/student-affairs-visual-redesign@a905e25` | 视觉重构 | 是 | 为 `7a0af21` 祖先 | 已上线框架 | 非核心视觉复杂度 | ALREADY IN PRODUCTION | 不重复合并 |
| `codex/feature/deepseek-knowledge-obsidian@49ec021` | 通用知识问答/Obsidian 侧支 | 分支否；同类能力部分已上线 | 旧支线 49 behind / 1 ahead | 非核心 | 整体合并会倒退并扩大范围 | DEFER | 禁止整体合并；Beta 隐藏或次级化入口 |

## 4. E2 与实验分支

| 分支/提交 | 能力 | 是否在 Production | 测试证据 | 用户价值 | 风险 | Beta 决定 | 合并方式 |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| `codex/e2-a-recognition-baseline@d67ca84` | Golden/eval baseline | 否 | 评测报告 | 研究证据 | harness 依赖 | RESEARCH ONLY | 不合并 |
| `codex/e2-recognition-v2@b7f6be8` | E2 pipeline | 否 | Holdout FAIL；A–J 未完成 | 潜在识别改进 | 未过门槛 | REJECTED | 不合并 |
| `codex/e2-generalization-v2@8ae655e` | generalization candidate | 否 | Development/Golden/Holdout FAIL | 无已证实净收益 | 质量倒退 | REJECTED | 不合并 |
| `codex/e2-factledger-diagnostic@70dd976` | FactLedger 诊断 | 否 | Production NOT READY | 诊断价值 | 非产品路径 | RESEARCH ONLY | 不合并 |
| `codex/e2-factledger-ab-preview@c9ad5e8` | FactLedger A/B Preview | 否 | `v2-e2-factledger-rejected` | 无 | 失败且含 Preview 接线 | REJECTED | 不合并 |
| `codex/e2-path-a-planning-v2@9c86661` | Path-A planner | 否 | `v2-e2-7-blocked` | 无已证实收益 | internal gate FAIL | REJECTED | 不合并 |
| `codex/e2-9-v4-pro-small-benchmark@b2ea4a4` | V4 Pro benchmark | 否 | protocol blocked | 研究价值 | Preview/模型实验 | REJECTED | 不合并 |
| `codex/e2-9-v4-pro-protocol-rerun@d53e632` | protocol rerun | 否 | provisional/blocked | 协议证据 | 非产品 | RESEARCH ONLY | 不合并 |
| `codex/e2-9-r2-harness-integrity-repair@94a23d6` | harness integrity | 否 | screening blocked | 评测完整性 | 非产品 | RESEARCH ONLY | 不合并 |
| `codex/e2-9-r2-transport-integrity@a16cf67` | transport evidence | 否 | R10 祖先 | 错误处理启发 | 与 harness 耦合 | RESEARCH ONLY | 如有必要在 release 最小重实现 |
| `codex/e2-9-r3-v4-pro-successor@73b507e` | V4 Pro successor | 否 | path-mask blocked | 无 | 未过 gate | REJECTED | 不合并 |
| `codex/e2-9-r4-path-masking-integrity@523fe58` | path-masked harness | 否 | blocked lineage | 研究价值 | 评测基础设施 | RESEARCH ONLY | 不合并 |
| `codex/e2-9-r5-harness-preflight@ec70999` | R5 preflight | 否 | blocked outcome | 研究价值 | 评测基础设施 | RESEARCH ONLY | 不合并 |
| `codex/e2-9-r6-harness-qualification@ad90d6c` | R6 qualification | 否 | gate failure | 研究价值 | 评测基础设施 | RESEARCH ONLY | 不合并 |
| `codex/e2-9-r7-planner-repair@3f67959` | isolated planner repair | 否 | masked replay | 研究价值 | 禁止进入 Beta | RESEARCH ONLY | 不合并 |
| `codex/e2-9-r9-planner-precision-repair@00e6116` | R9 planner precision | 否 | R10 祖先 | 研究价值 | 实验 planner | RESEARCH ONLY | 不合并 |
| `codex/e2-9-r9-integrity-hardening@ef52d6b` | evaluation integrity | 否 | R10 祖先 | 研究价值 | 评测基础设施 | RESEARCH ONLY | 不合并 |
| `codex/e2-9-r10-facts-first-preview@a2df4d5` | R10 facts-first Preview | 否 | `archive/e2-r10-20260826`；NOT_FOR_RELEASE | 归档研究 | 混入 release 风险极高 | RESEARCH ONLY | 只保留归档标签 |
| `codex/e2-v4-flash-vision-exp@e097887` | Vision Exp candidate | 否 | Development gate FAIL | 无已证实净收益 | 未完成 Golden/Holdout | REJECTED | 不合并 |

## 5. 依赖升级分支

| 分支/提交 | 能力 | 是否在 Production | 测试证据 | 用户价值 | 风险 | Beta 决定 | 合并方式 |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| `dependabot/npm_and_yarn/development-dependencies-31f132ee74@ec59be2` | 9 项开发依赖升级 | 否 | CI failure | 不阻塞 Beta | 大 lockfile 变化 | DEFER | Beta 后独立升级 |
| `dependabot/npm_and_yarn/lucide-react-1.33.0@9b6dd4c` | Lucide 大版本升级 | 否 | CI failure | 非核心 | UI/API 兼容 | DEFER | 不纳入 |
| `dependabot/npm_and_yarn/multi-9b1536b8cd@ff95132` | React/@types 升级 | 否 | CI failure | 非核心 | 核心运行时风险 | DEFER | 不纳入 |
| `dependabot/npm_and_yarn/multi-d8ec5a502f@8ba16bb` | ReactDOM/@types 升级 | 否 | CI failure；旧基线 | 非核心 | 陈旧且冲突风险高 | DEFER | 不纳入 |

## 6. 去重、回滚与纳入方法

- `ddebe7c` 已包含于 `3907733`，不得分别合并两个 E1 分支。
- 所有后续 E2 主线都包含 `3907733`；只能精确纳入六个 E1 提交，不能从 R10 tip 截取整段历史。
- 五个产品 feature tip 已在 Production，不得重复 cherry-pick。
- `SHOULD INCLUDE` 当前为空；没有证据支持为了“顺手优化”扩大 Beta。
- 每个 E1 提交使用 `cherry-pick -x` 单独纳入并立即验证；每一步的前一 SHA 是天然回滚点。
- 若任何提交引入数据丢失、迁移不可回滚、rich entity 刷新后丢失或实验依赖，立即停止后续纳入。

推荐顺序：

```bash
git cherry-pick -x 1506f7d
git cherry-pick -x ddebe7c
git cherry-pick -x dca382d
git cherry-pick -x 09b9798
git cherry-pick -x dbc8945
git cherry-pick -x 3907733
```
