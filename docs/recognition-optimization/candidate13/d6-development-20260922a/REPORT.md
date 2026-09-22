# Candidate03 vs Candidate13 D6 Development结果

冻结结论：`REJECT_CANDIDATE13_DEVELOPMENT`。

本批是模型辅助单作者参照上的合成Development工程筛选，不是独立人工Holdout，也不是实际用户转化率。24个冻结请求全部只发送一次并完成结算；没有重试、repair、verifier或替代样本。

| 臂 | 候选 | 完整正确 | 首次整份正确率 | Schema+引用 | TP / FP / FN | Precision / Recall / F1 | Critical Major / Major / Severe / Forbidden |
|---|---|---:|---:|---:|---:|---:|---:|
| A | Candidate03 | 2/12 | 16.67% | 12/12 | 12 / 9 / 6 | 57.14% / 66.67% / 61.54% | 47 / 35 / 0 / 2 |
| B | Candidate13 | 2/12 | 16.67% | 12/12 | 14 / 3 / 4 | 82.35% / 77.78% / 80.00% | 35 / 30 / 0 / 2 |

配对结果：Candidate03胜2、Candidate13胜3、平7。Candidate13明显减少了普通任务误报和漏报，但整份完全正确来源仍是2/12，没有净增；S11两臂都把多端点替代关系处理错，Candidate13仍有2个Forbidden。因此不能只看F1提升就晋级。

| 门槛 | 结果 |
|---|---|
| 24个单元都有确定结局 | PASS |
| 两臂各12/12 Schema与引用有效 | PASS |
| Candidate13 Severe=0、Forbidden=0、教学例泄漏=0 | FAIL（Forbidden=2） |
| 相对Candidate03不增加任务FN或关键字段Major | PASS |
| 完整正确来源至少净增2 | FAIL（2/12对2/12） |

失败分层：transport 0、解析0、Schema 0、引用0、语义链路失败0。失败发生在内容质量门槛，不是网络或格式问题。

实际usage：输入116,262 tokens，其中缓存输入98,176；输出27,266 tokens。本地按官方峰值价计算的可审计费用上界为US$0.067607；服务商实际扣费为`NOT_OBSERVABLE`。冻结请求最坏预算US$0.351580，硬上限US$1.00。

权威账本从742行追加到791行，仅新增1条grant、24条reserve、24条settle；最终SHA-256为`efb46f116db9c550ba53624c5d710164c6143ba9cc30c57ab2b7515c059f4d6a`。

四项主指标中，合成Development首次整份建议正确率为Candidate03 16.67%、Candidate13 16.67%。正确处置率、低修改正确处置率和主动修改时间都需要注册真人试次，当前保持`NOT_OBSERVABLE`。

Candidate13不得进入独立Holdout、替换默认候选或部署。下一候选应先修复S04条件假实体丢失、S08字段回归和S11多端点替代关系，再冻结为新版本并使用全新Development重测。
