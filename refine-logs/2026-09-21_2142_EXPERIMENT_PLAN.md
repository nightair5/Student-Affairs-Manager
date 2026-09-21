# Candidate12 D2 临时 Development 结果与 D3 停止点

版本：`c12-plan-0.8-d2-provisional-results`。状态：`REJECT_CANDIDATE12_ENGINEERING_SCREEN`。

D2已按新授权完成D1冻结的24个配对请求。24/24均一次发送、HTTP 200、usage确定并settled；没有重试、repair、verifier、halt或uncertain。权威账本由693行增至742行，本地可审计费用上界¥0.436048。

正式评分失败：D1冻结的`scorerReference`与绑定评分器`candidate11-scoring-2.0.0`接口不兼容。看见结果后不得补写Expected或评分适配层，因此本轮按预注册纪律失败关闭。事后诊断虽显示Candidate12任务F1高于candidate03（91.43%对78.79%），但两臂诊断完整来源均6/12，Candidate12仍有Forbidden，不能晋级。

下一步D3保持零模型调用：

1. 为未来参照定义唯一machine-readable schema，补齐action/object别名、字段规则、完成标准、修订端点和歧义表达。
2. 用正反例证明reference compiler与scorer逐字节确定、能消费全部参照，并在新数据前冻结版本和hash。
3. D2来源和输出永久列为已见；不得重标后冒充预注册结果。
4. 若继续优化，使用D2错误形成新版本Candidate13并先冻结；正式Holdout仍需两位真实人员的全新双审材料及另行调用授权。

默认候选、Schema、旧库、Preview、Production、合并和部署均不在本阶段。
