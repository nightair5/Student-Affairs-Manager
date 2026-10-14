# D5 新数据前冻结

初始提交`b1bebff`建立了v4.0评分器、评分回归、四项主指标计算器及契约。随后在尚未调用模型、尚无raw/result时发现生产输出Schema没有独立的时间点`actionable`字段；v4.0若继续评分该字段会要求模型输出无法表达的信息，因此该版本已在派发前作废，不得用于实验。

本提交将compiler、scorer-input和scorer上调到v4.1，只删除这一项不可表达的评分维度，并保留任务级actionable、条件和依赖一致性评分。本提交成为现行评分合同冻结点；只有提交并推送后，才允许生成正式D5-R1的12份合成Development正文和Expected。此前工作树中的数据草稿不得进入请求身份或结果。

- D4 Candidate13 Prompt、Schema、adapter、v3绑定不修改。
- 评分器回归使用已见合同夹具，不具有全新Development或Holdout资格。
- 当前模型效果、真人正确处置率和修改时间仍为`NOT_OBSERVABLE`。
- 旧授权均不得用于D5。
