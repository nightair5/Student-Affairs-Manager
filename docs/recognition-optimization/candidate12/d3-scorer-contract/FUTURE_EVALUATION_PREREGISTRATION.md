# 未来评测预注册

## 数据与冻结顺序

1. Candidate13如实施，只能依据已见D2错误族开发。
2. Candidate13代码、Prompt、规则、Schema、compiler和scorer必须先冻结并提交。
3. 新Development或Holdout的Expected在候选冻结前不得对实现者可见。
4. D1来源、D1 Expected、D2回答和本包夹具永久视为已见材料。
5. 正式Holdout必须由真实标注者A独立标注、真实复核者B复核并完成冲突裁决；模型不能冒充人工。

## 固定运行边界

未来配对运行必须固定模型、temperature、reasoning、referenceTime、timezone、Schema、adapter和输出上限，只允许候选组件不同。顺序预先平衡，一次发送，零自动重试、零repair、零verifier。任何调用都需要新的价格核验、预算卡、grant和用户明确授权。

## 晋级门槛

- 所有计划单元具有确定结局；
- 两臂Schema与reference validity全部通过；
- 候选Severe=0、Forbidden=0、teaching leakage=0；
- 相对基线不增加任务FN；
- 相对基线不增加关键字段Major；
- 完整来源至少净增2；
- 任一条件不满足即拒绝，不得揭盲后降低门槛。

即使通过，也只允许申请下一阶段，不等于真实接受保存转化、真人收益、Commercial Preview或Production资格。
