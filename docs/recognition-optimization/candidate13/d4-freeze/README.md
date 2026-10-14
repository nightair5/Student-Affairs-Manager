# Candidate13 D4 零调用冻结包

状态：`D4_CANDIDATE13_FROZEN_READY_FOR_FRESH_DATA`。

本包将D2已见错误族转为独立Candidate13 Prompt修正，并在任何全新Development或Holdout Expected可见前冻结候选、规则、Schema/adapter/scorer绑定和工程反例。Candidate13没有进行模型评测，没有证明优于candidate03或Candidate12，也没有接入默认路径、6633、Preview或Production。

## 版本

- candidate：`real-input-source-semantics-13`
- prompt：`recognition-prompt-candidate13-1.0.0`
- reference contract：`candidate12-reference-contract-3.0.0`
- scorer：`candidate12-scoring-3.0.0`

## 内容

- `CANDIDATE13_SPEC.md`：候选规则与边界。
- `CHANGE_LOG.md`：相对Candidate12的最小变化。
- `ENGINEERING_FIXTURES.json`：28类已见错误族匿名工程反例，不是新Development或Holdout。
- `REGRESSION_RESULTS.json`：确定性构造结果，不含模型质量分数。
- `FRESH_DATA_ISOLATION.md`：后续新数据隔离规则。
- `FREEZE_MANIFEST.json`：候选、依赖、保护文件和零操作证据。
- `VALIDATION.md`：实测命令与既有失败。

验证入口：

```bash
node scripts/freeze-candidate13-d4.mjs --verify
node --test scripts/candidate13-d4.node-test.mjs
```

下一阶段只能在本冻结提交之后准备全新匿名Development，或等待两位真实人员的独立Holdout标签。模型调用、预算和派发仍需新的明确授权。
