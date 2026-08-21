# E2.9-R8 Path-masked Replay Integrity Audit

**Date:** 2026-08-21

**Auditor:** fresh GPT-5.6-Sol ultra, same-family, read-only, provisional

**Run:** `e29r8-replay-review-20260821-d`

## Overall Verdict: WARN

证据结论为：

`INTERNALLY CONSISTENT / SAME-FAMILY LLM-AS-JUDGE PROXY / EXTERNALLY UNATTESTED`

D轮 packet、标签、映射、计数与 Gate 算术可以独立复算。Gate 为6/8通过、整体失败，新的 R8 Screening 为 `NOT_REQUESTED`。这不是人工评审、真实 Ground Truth、新 Blind 或用户验收。

## A. 冻结输入与样本：PASS

- Checkpoint raw SHA-256：`0886afb941eeb74d80d9ed35601ee50447c0e4b464310ac197fd39df006fa336`。
- Source manifest raw SHA-256：`115b43f98d0ca56cac522d0272ed10894fa0cc2a185562d0c10ce4bff7aca12f`。
- 16个唯一 observation，8个唯一 source case；每个 case 两个缓存模型 observation。

## B. 新增生成调用与 Expected 边界：限定范围 PASS

- Replay runner 仅从冻结 cache 重建候选，没有网络或生产模型生成路径。
- Expected-key firewall 已执行；唯一特许键是数值计数 `expectedObservations: 16`。
- `modelCalls: 0` 只表示新增生产识别/生成调用为0；匿名标签由同族 LLM-as-judge 生成。

## C. Packet 路径遮蔽：定义内 PASS

- A/B/C 三轮因关联指纹作废；D轮经过统一语义展示层。
- D轮直接身份扫描与非业务关联器扫描均为0，独立 packet audit 为 PASS。
- 8个来源各出现两次，可形成来源分组，但不能由此识别哪侧是 baseline/candidate。

## D. 标签覆盖与顺序：文件内 PASS

- 16条标签完整且唯一；draft 与 envelope 一致。
- 原始匿名选择：X=3、Y=7、TIE=6、II=0。
- 文件内顺序满足 packet → audit/labels → reveal。
- “Reviewer 只读 packet”属于流程声明，无法由本地可修改 JSON 独立证明。

## E. Commitment 与揭盲：WARN

- 标签前保存了16条 HMAC commitment、Gate policy hash 和 commitment-list hash。
- Secret 与 private bindings 未持久化，因此公开材料不能事后重新打开 HMAC，形成外部不可抵赖证明。
- 当前映射、commitment 覆盖和代码重建内部一致，但不是第三方时间戳或外部签名。

## F. 计数、Gate 与阶段边界：PASS

- Preferred：candidate 9 / baseline 1 / tie 6。
- Major Correction：3 / 10。
- Planning Error：6 / 10。
- Fact Loss：0 / 0。
- Over-splitting：1 / 0。
- `candidateFactLossLower` 与 `candidateOverSplitNotWorse` 失败，其余6项通过。
- 最终：`R8_REPLAY_ADJUDICATION_FAIL`，fresh R8 Screening `NOT_REQUESTED`。
- Selection `NOT_RUN`，Blind `NOT_CREATED`，Production `NOT_DEPLOYED`。

## Evaluation Type

`synthetic_proxy / same-family LLM-as-judge`

它是基于原文的匿名业务代理审阅，不是 human evaluation 或 real-GT benchmark。

## Claim Impact

- D轮哈希、计数和 Gate FAIL：supported。
- “R8候选在代理审阅中9比1胜出”：supported with scope qualifier。
- “R8质量已达标”或“可申请 Screening”：unsupported。
- “完全外部不可篡改的盲评”：unsupported。
- “0模型调用”：必须限定为0次新增生产识别/生成调用。

## Remaining Limitations

- `.evaluation-cache` 是 Git ignored、可修改的本地证据。
- 内嵌时间、NTFS mtime 和本地 commitment 不是外部时间戳。
- Same-family reviewer 只能提供 provisional 代理证据。
- 16 observations 实际来自8个唯一 source case，不能当作16个独立来源。
