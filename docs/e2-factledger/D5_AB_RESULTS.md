# E2.5 D5：复杂样例 A/B 结果

## 状态：INCONCLUSIVE

24 条复杂样例已经冻结选择。A 路径由 `scripts/summarize-factledger-d5.mjs` 从同日、同模型、同 Prompt 的已暴露原始输出重新调用当前 strict scorer，不信任缓存内预计算 scores；评分器已增加空 actual 不能命中 alias 的守卫。本次修复前后 24 条汇总数值一致。B 路径 Harness 已执行启动检查，但当前 Node 服务端进程与同仓库 Worktree 均没有 `DEEPSEEK_API_KEY`，命令返回 `NOT_RUN / DEEPSEEK_NOT_CONFIGURED`，没有发起模型调用。

不得用 mock、本地 fallback、A 输出变换或人工 FactLedger 替代 B，因此本阶段没有可计算的 A/B delta。

## 样例

机器可读选择见 `d5-complex-selection.json`：

- Golden `complex_notice`：10 条全选；
- Exposed Holdout `complex_notice`：4 条全选；
- Development：10 条，覆盖多阶段、Event/Task、依赖时间、更正通知、材料边界、OCR 和同日多步骤。

全部 24 条均已暴露，`blindEligibility=false`。

`d5-ab-results.json` 同时保存三份外部 raw cache 的文件名、entry count 与 SHA-256；原始缓存仍保持 Git 忽略且不提交，其中 Golden 有 1 条与本次选择无关的 request failure，所以全量缓存为 258 entries / 257 completed。

## 指标

| Metric | A：recognition-2.4.1 | B：FactLedger → Planner | Delta |
| --- | ---: | ---: | ---: |
| Fact Recall | NOT OBSERVABLE | NOT RUN | NOT COMPUTABLE |
| Task Precision | 81.40% | NOT RUN | NOT COMPUTABLE |
| Task Recall | 61.40% | NOT RUN | NOT COMPUTABLE |
| Material Precision | 98.04% | NOT RUN | NOT COMPUTABLE |
| Material Recall | 98.04% | NOT RUN | NOT COMPUTABLE |
| TimePoint Type Accuracy | 78.95% | NOT RUN | NOT COMPUTABLE |
| TimePoint Value Accuracy | 82.89% | NOT RUN | NOT COMPUTABLE |
| Milestone Precision | 59.09% | NOT RUN | NOT COMPUTABLE |
| Milestone Recall | 50.00% | NOT RUN | NOT COMPUTABLE |
| Event Accuracy | 100.00% | NOT RUN | NOT COMPUTABLE |
| Ambiguity Precision | 70.83% | NOT RUN | NOT COMPUTABLE |
| Ambiguity Recall | 73.91% | NOT RUN | NOT COMPUTABLE |
| Evidence Coverage | 99.28% | NOT RUN | NOT COMPUTABLE |
| Major Correction | 83.33% | NOT RUN | NOT COMPUTABLE |
| Severe Error | 0.00% | NOT RUN | NOT COMPUTABLE |

A 的 Fact Recall 标为 `NOT OBSERVABLE`，因为单次综合输出没有独立事实层；不能从最终 Planner 结构反推“模型曾发现但后来规划丢失”的事实并冒充观测。

## 延迟与 Token

| Metric | A | B |
| --- | ---: | ---: |
| Mean latency | 11,299 ms | NOT RUN |
| P50 latency | 11,313 ms | NOT RUN |
| P95 latency | 17,055 ms | NOT RUN |
| Input tokens total | 91,814 | NOT RUN |
| Output tokens total | 54,481 | NOT RUN |
| Mean input/case | 3,825.58 | NOT RUN |
| Mean output/case | 2,270.04 | NOT RUN |
| Cost | NOT OBSERVABLE | NOT RUN |

A Token 包含 recognize 与已触发的 Repair 操作的真实上游 usage；没有用字符数估算成本。

## 门槛

| 建议正式实施所需条件 | 结果 |
| --- | --- |
| Task Recall +8–10pp | NOT COMPUTABLE |
| Major Correction 至少下降 20pp | NOT COMPUTABLE |
| Task Precision ≥82% | NOT COMPUTABLE |
| Evidence Coverage ≥95% | NOT COMPUTABLE |
| Severe Error 不增加 | NOT COMPUTABLE |

注意：A 本身 Task Precision 为 81.40%，低于 B 路径绝对门槛 82%；但没有 B，不能据此支持或反对 FactLedger。

## 结论边界

- 不能建议正式实施两阶段架构；
- 也不能据此否定两阶段架构；
- D1 的 73.7% planning-side 比例只是方向性人工证据，不是 A/B 效果；
- D5 状态必须保持 `INCONCLUSIVE`，直到合法服务端 Secret 下完成同模型 24 条 B 运行。
- 本次 legacy A cache 没有调用时 source hash，只能作为暴露集诊断证据；未来真实配对 B 必须使用评测运行器新生成、带 `sourceSha256` 的 A cache。
