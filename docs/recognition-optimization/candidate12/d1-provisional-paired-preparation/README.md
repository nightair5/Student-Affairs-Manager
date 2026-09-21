# Candidate12 D1 临时 Development 配对准备包

状态：`D1_PROVISIONAL_DEVELOPMENT_IDENTITIES_READY_FOR_AUTHORIZATION`。模型调用：0。派发授权：`false`。

本包把 C2 的 12 份完全合成来源用于 candidate03 与 Candidate12 的 12×2 配对工程筛选，共冻结 24 个请求身份。它只回答“同一批已见合成题上，两套 Prompt 应该怎样公平比较、请求有没有被参照污染、执行器能否在未授权时关死”等工程问题；当前没有模型答案，也没有质量分数。

证据标签固定为：

- `evaluationRole=SEEN_SYNTHETIC_DEVELOPMENT`
- `truthStatus=PROVISIONAL_MODEL_AUTHORED`
- `eligibleForIndependentHoldout=false`
- `claimCeiling=ENGINEERING_SCREENING_ONLY`

这些来源和参照由 Codex 制作，Candidate12 实现侧从创建时就能看到。即使未来 24 次全部完成并达到预注册筛选线，也只能说明 Candidate12 值得进入独立人工 Holdout，不能据此宣布优于 candidate03、完成晋级、提高真实转化率或可以上线。

## 文件

- `PROVISIONAL_SOURCES.json`：只含 12 份来源及来源哈希，不含 Expected。
- `PROVISIONAL_REFERENCES.json`：单独保存 12 份 provisional Expected 及哈希。
- `PREPARED_REQUEST_IDENTITIES.json`：24 个完整零调用请求、上下文和逐请求身份。
- `PREPARATION_MANIFEST.json`：来源、Expected、候选、Schema、scorer、adapter、账本和保护文件绑定。
- `EXPERIMENT_DESIGN.md`：配对顺序、固定变量、失败处理和筛选规则。
- `BUDGET_AUTHORIZATION_CARD_DRAFT.md`：未来调用的只读预算草案；当前不构成授权。
- `VALIDATION.md`：本阶段验证证据和剩余边界。

## 运行入口

重新验证冻结包：

```bash
node scripts/prepare-candidate12-d1.mjs --verify
node --test scripts/candidate12-d1.node-test.mjs
```

`scripts/run-candidate12-d1.mjs` 是独立的拒绝型执行入口。当前运行 `node scripts/run-candidate12-d1.mjs --dispatch` 必须在读取 Secret、创建预算记录或发出网络请求前以 `D1_MODEL_CALL_NOT_AUTHORIZED` 失败。未来取得明确的 24 次模型调用和最坏预算授权后，应另做 grant 绑定的执行阶段，不得把本准备提交改写成“已授权”。
