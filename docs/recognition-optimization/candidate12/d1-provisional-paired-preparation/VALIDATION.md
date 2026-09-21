# Candidate12 D1 验证记录

状态：`D1_PROVISIONAL_DEVELOPMENT_IDENTITIES_READY_FOR_AUTHORIZATION`。

- 来源：12/12，`SEEN_SYNTHETIC_DEVELOPMENT`；source set SHA-256 `3cdd90c5a687f5427d6e0839bfb33c1784dd18d19d708bf14f0e266539469c5a`。
- provisional Expected：12/12；Expected set SHA-256 `c1eeac6d8f54f638d65d382b4308e662157af493d6b0dc826a98b6a56bdd8c8d`。
- 原 C2 package SHA-256：`386e145aa6e69709401ddf63739fd2c768376e12c6c035b1e2ef35d7f2256352`。
- 请求身份：24/24；A/B 各 12，PD01 起交替 A→B/B→A；全部 `dispatchAuthorized=false`、`NOT_RUN`。
- Preparation Manifest SHA-256：`e2a14c8a920613f8cdd44afa57699f674f266f102df28b2eb926e1b750b1e005`。
- candidate03 bundle SHA-256：`bef5b0f3bbf20738b90c5b0299169c614d95c879c644c4af1164e4d4943f8c14`。
- Candidate12 bundle SHA-256：`880488f038cec55763276f525c1847638533fe95d79a64599e9585dc8d92296a`。
- candidate03/Candidate12 prompt SHA-256：`eea6740095362dd28db89378c9422048ea0d72b1164e69aeb94fb6d5b04eb8eb` / `6303a9f61bd18c901ea58cf1613a94054d534e1107f888737189d117c601a4ac`。
- Schema SHA-256：`52b52e25774d61b8fddecf978f2215d53c0f9b4e47f9d45c74426c0b50a77d7e`；scorer 与 adapter 沿用冻结版本。
- 请求体范围：13,614—16,165 字节；无 Expected 字段进入请求或 `requestSha`。
- 定向 Node 测试：11/11 通过；覆盖重复验证、物理隔离、配对顺序、非 Prompt 等值、逐请求哈希、Expected 污染、来源/Prompt/模型漂移、身份漂移、无授权拒绝、Manifest 绑定和零副作用。
- 84 份保护文件一致；权威账本仍为 693 行、572,913 字节和 SHA-256 `2051d8e775123579c3fa262f671a757e690983f64bc5945d692faaeb24b5322e`，writer 未打开。
- 模型 API 调用、Secret 读取、grant、reserve、settle、receipt、raw 结果和账本写入均为 0。
- `eligibleForIndependentHoldout=false`；本包只能用于工程筛选，不能得出 Candidate12 已优于 candidate03 的结论。

## 仓库级验证

- `npm run lint`：0 error、5个既有warning。
- 裸`npm run test`：1432通过、1失败、1跳过；唯一失败为既有candidate02启动测试没有设置`REAL_INPUT_CARRIERS_MANIFEST`，报`lstat ...\\undefined`。该命令在Vitest失败后按npm链路停止，未继续后续Node组。
- 仓库现有隔离入口`node scripts/candidate11-checks.mjs test`：Vitest 1433通过、1跳过；server、worker、time parity、multimodal library、Functions及candidate11 scoring/history/gateway/preview均通过。临时匿名carrier证明裸测试失败是既有启动配置缺口，不是D1回归。
- 历史RCO-5-007原样保持3/4通过、1/4失败：`FREEZE_HASH_MISMATCH:package-lock.json`。没有修改旧锁文件、冻结哈希断言或发布门槛。
- `npm run build`与`npm run security:scan`通过；构建保留既有chunk-size warning，Secret扫描覆盖2576个源码/构建文件。
