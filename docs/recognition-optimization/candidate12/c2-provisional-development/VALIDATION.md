# Candidate12 临时 Development 包验证

状态：`PROVISIONAL_MODEL_AUTHORED_DEVELOPMENT_ONLY`。

- 来源：12/12，完全合成且无真实个人资料。source set SHA：`3cdd90c5a687f5427d6e0839bfb33c1784dd18d19d708bf14f0e266539469c5a`。
- 参照：12/12结构完整；truth status 均为 `PROVISIONAL_MODEL_AUTHORED`。Expected set SHA：`c1eeac6d8f54f638d65d382b4308e662157af493d6b0dc826a98b6a56bdd8c8d`。
- package SHA：`386e145aa6e69709401ddf63739fd2c768376e12c6c035b1e2ef35d7f2256352`。
- 独立人工标注者：0；独立人工复核者：0；`modelAssistanceUsed=true`。
- 独立人工验证器必须拒绝本包，不能通过改字段冒充人工包。
- 正式 Holdout 请求身份：0；模型API调用、Secret读取、grant、reserve、settle和账本写入均为0。
- 未来人工Holdout必须与本包12份来源进行逐字和高相似排除。
- 定向Node测试：8/8通过（C1人工门4项、临时包4项）。
- `npm run lint`：0 error、5个既有warning；`npm run build`与`npm run security:scan`通过，保留既有chunk-size warning。
- 裸`npm run test`：1431通过、2失败、1跳过；失败为既有`REAL_INPUT_CARRIERS_MANIFEST`未定义，以及OCR terminate断言的一次定时波动。
- 隔离Vitest：1433通过、1跳过；上述OCR用例通过，未形成稳定回归。其余隔离分组通过。
- 历史RCO-5-007保持3/4通过、1/4失败：`FREEZE_HASH_MISMATCH:package-lock.json`。
