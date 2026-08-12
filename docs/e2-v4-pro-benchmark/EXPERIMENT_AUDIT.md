# E2.9 Independent Experiment Integrity Audit

## Verdict

`WARN — same-family / provisional`。

审计支持最终状态 `EXPERIMENT BLOCKED`；不支持任何 Pro 优于 Flash、Candidate Freeze、E2 READY、默认模型切换或上线结论。

## Verified

- tag `v2-e2-7-blocked` 精确指向 `9c86661e9320a182f3043115cd50389514a508f6`；实验分支正确。
- 冻结点之后未修改 Golden/Holdout/Development expected、Workspace v8、Repository、Migration 或 DomainCommitPlan。
- generation runner 只读 ignored source-only manifest；请求白名单和 forbidden-key firewall 生效；没有导入 expected。
- checkpoint 保留 6 observations：5 complete、1 Flash 401；401 未补跑或覆盖；12 client attempts；5 可确认 upstream completions。
- 5 个完成项的 source/raw/result SHA-256、requested/returned model、fingerprint 与 usage 均独立复算通过；fallback 0。
- S3 24 条结构标签确无 `information_only`/`prompt_injection`；S3 model calls = 0，早停正确。
- Preview 当前 flag=false（禁用代码部署 `cf5477b6-31d1-45cc-9a04-794834e6dbb5`）、live endpoint=404、实验 Bearer Secret 已删除（活跃 Secret Change `dc95d63b-0d92-4863-965b-e54f804db31b`）；Production 最近部署仍为 2026-08-08。
- lint、Worker 31/31 tests、build PASS。

## Findings and limitations

1. 401 只能称与 Preview 认证/Secret 激活时序相关且根因未定，不能证明为同一 Secret 的传播竞态。
2. 6 个 Node `fetch` TypeError 支持 transport failure，但没有 socket-level 证据证明均发生在发送前。
3. Smoke 3 只有 `prompt_injection`/`multi_paragraph`，没有冻结 Ambiguity 标签，独立构成 S2 阻断。
4. 冻结 24 条不能满足 S3 pure-information/prompt-injection coverage，不能合法创建 8-case manifest。
5. S0 `/models` 与最小 Pro completion 原始响应没有持久化，只能由聚合文档、部署记录与后续 Pro identity 交叉验证。
6. `schemaBundleSha256` 聚合算法未记录；两个组成文件 hash 可验证，bundle 外部复现性不足。
7. 同模型家族审计不能称完全独立，只能 provisional。
8. Selection、Blind、Browser、人评与质量指标均 NOT RUN，不能产生模型优劣结论。

## Recomputed aggregates

- Flash：2/3 complete；total tokens 8454；mean total 4227；mean server latency 9622 ms。
- Pro：3/3 complete；total tokens 13722；mean total 4574；mean server latency 20650 ms。

## Recomputed hashes

- source-only manifest canonical：`64f0effc410890e816afcf54fb17089e9de7a0fdce0cbe50da86a256121b8f80`
- source-only manifest raw：`75063fafe3de64d489d5ec8c2ffa7a433e5a219f19f668ed66cf8b31a5692314`
- structure labels canonical：`714cebbbf2a3645d08c1387b87ac7ba5861cc26d898fb57acaef97df8908bcc8`
- smoke checkpoint raw：`2757859f116e83cc87ebcb5c2d333c0bf39e9277ac0e3b9b41aa65bf82aa7834`
- Prompt canonical：`c925f1dc27971e4fcaf7ad185b729f016fa7af966cd7992337d9eaa94c97e6fd`
- Semantic scorer canonical：`45a57048c7a6e0f6935219c0b1cd48717c92e6e3fd394f1460e69deee5c5f0a0`
- Evaluation contract canonical：`b5e80beff3b637e13a7baafc887f39174f21bd2f23d105c042c0a7d5b16bc438`
