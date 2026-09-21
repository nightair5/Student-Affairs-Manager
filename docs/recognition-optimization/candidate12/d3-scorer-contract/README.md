# Candidate12 D3 评分契约修复包

状态：`D3_SCORER_CONTRACT_READY_FOR_FRESH_DATA`。本包只修复未来实验的参照、编译器和评分器接口；模型调用、Secret读取、grant、reserve、settle、账本写入、真人试用、Holdout、默认候选变更、合并和部署均为0。

## 结果

- 唯一参照契约：`candidate12-reference-contract-3.0.0`。
- 唯一评分输入：`candidate12-scorer-input-3.0.0`。
- 确定性编译器：`candidate12-reference-compiler-3.0.0`。
- 评分器：`candidate12-scoring-3.0.0`。
- 24类匿名契约夹具，每类一份合法参照和一份明确拒绝参照，共48份。
- D1历史参照12/12与v3不兼容：10/12缺少任务身份数组与字段规则，12/12使用自然语言checks。它们只保留历史诊断，禁止自动转换为独立人工Expected。

D2正式决定继续保持`REJECT_CANDIDATE12_ENGINEERING_SCREEN`。D2事后F1仅用于错误定位，不是预注册晋级成绩，也不是真实接受并保存转化率。

## 使用

```bash
node scripts/build-candidate12-d3.mjs --verify
node --test scripts/candidate12-d3.node-test.mjs
```

`compile-candidate12-reference.mjs`只读取参照并生成带输入SHA和编译SHA的评分输入；它不接收候选回答。评分器遇到无效参照固定返回`REFERENCE_CONTRACT_INVALID`，不返回虚假0分或优胜结论。

## 后续边界

下一步可以在已见D2错误族上实现并冻结Candidate13，但必须在任何全新评测Expected对实现者可见前冻结。全新Development或两位真实人员的独立Holdout、模型调用、预算和部署都需要新的阶段与授权。
