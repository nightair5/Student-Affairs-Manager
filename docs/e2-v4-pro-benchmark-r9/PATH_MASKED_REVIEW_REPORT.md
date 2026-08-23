# R9 path-masked 匿名复评报告

## 结论

全新 R9 复评 run `e29r9-replay-review-20260824-a` 的预注册 Gate 全项通过：

`R9_REPLAY_GATE_PASS_SCREENING_REQUESTABLE`

该结论只允许另行申请 Screening，本轮没有运行 Screening。

## 隔离与时序

- 16 个 observation、8 个 source case，每个 source 恰有两条冻结 observation。
- X/Y 映射按 observation 随机生成；只在执行器内存中保留 reveal secret，磁盘仅预先保存 commitment。
- reviewer packet 在 labels 前冻结，canonical SHA-256 为 `280277fb9d6538beca4bf8650fe6149b1f21a848647d2234f0606d5aa7dd284a`。
- 自动 correlator scan 与独立 packet audit 均为 PASS。
- packet audit 时间早于 labels；labels canonical SHA-256 为 `d2b98781469f5bcf1ce73f49232ec53589ab67379ba2bffbf99eaeb58e77fec9`。
- labels 冻结后才生成 `reveal-result.json` 并计算 Gate。
- reviewer packet 不含 Expected、映射、模型名、Baseline/Candidate/R8/R9、Prompt/Pipeline、历史分数、延迟、Token 或结果哈希。
- 匿名审阅阶段未读取 Expected，新增生产 recognition/generation 调用为 0。

审阅者为 fresh same-family LLM-as-judge。它不是人工评审、不是 Ground Truth，只是 provisional proxy；因此不能把整个 R9 表述为“完全零模型”。

## 揭盲计数

| 指标 | Baseline | Candidate |
| --- | ---: | ---: |
| Preferred | 1 | 8 |
| Major Correction | 9 | 3 |
| Planning Error | 9 | 4 |
| Fact Loss | 2 | 0 |
| Over-splitting | 0 | 0 |
| Evidence Gap | 0 | 0 |
| Severe Error | 0 | 0 |

另有 7 个 Tie、0 个 Insufficient，16 组均为 determinate。

## Gate

全部机器检查为 true：16 pairs、最少 determinate 数、候选净胜至少 3、基线胜不超过 3、Major 不更差、Planning Error 更低、Fact Loss 不更差、零损失天花板政策、Over-splitting 不更差、Evidence 不更差、Severe Error 不更差。

R8 的旧 Gate 和失败记录未被修改。R9 使用预先冻结的新协议，允许 Fact Loss 在零损失天花板下“不更差”；本轮揭盲实际为 0 对 2，因此即使不依赖 0/0 天花板也通过 Fact Loss 条件。

## 局限

- 同族 LLM 裁决只提供用户影响代理证据。
- 匿名化降低了路径识别风险，但不能证明语言风格不存在任何统计关联。
- 本地 cache 与时间戳没有外部不可变见证。
- 结果不等于 Screening、Selection、Blind 或 Production 验收。
