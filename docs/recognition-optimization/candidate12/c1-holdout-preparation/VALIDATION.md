# Candidate12 C1 验证记录

状态：`WAITING_FOR_INDEPENDENT_HUMAN_LABELS`。

## 基线与保护

- 启动时本地HEAD、upstream和`git ls-remote`均为B2提交`a0145d47e130f1143334fa00b74e6d0d7511d908`，工作区干净。
- B1 Manifest SHA、24份B2 raw、24份结果、84份保护文件和693行权威账本精确匹配。
- Candidate12先行冻结提交：`c03368054ff8c357f055658c2d2d39b45bbcb761`；远端已同步。
- Candidate12 bundle SHA：`880488f038cec55763276f525c1847638533fe95d79a64599e9585dc8d92296a`。

## 定向检查

- Candidate12构造、固定参数、四类规则、无教学例、来源不变、旧候选不变和漂移拒绝：11/11通过。
- Candidate12冻结重复验证通过；84份保护文件与693行权威账本不变。
- Manifest 分列来源、Expected、Schema、scorer、adapter 与 Candidate12：前两项因真实材料缺失保持 `NOT_AVAILABLE/null`，后四项具有独立冻结 SHA。
- 人工准备验证器：4/4通过，覆盖空模板拒绝、完整结构正控制、模型辅助/个人信息/已见重合/覆盖不足拒绝。
- 已见语料排除库：75条；6条B1、32条历史绑定、7条Candidate12工程反例、8条工程夹具、10条Prompt教学例、12条Codex临时Development来源。

## 全仓检查

- `npm run lint`：0 error，5个既有warning。
- `npm run build`：通过；保留既有chunk-size warning。
- `npm run security:scan`：通过。
- 裸 `npm run test`：131个测试文件中129通过、1失败、1跳过；1431个测试通过、2失败、1跳过。失败包括要求原样保留的 `REAL_INPUT_CARRIERS_MANIFEST` 未定义问题，以及 `U01-09` 在5秒边界发生的一次超时。
- `node scripts/candidate11-checks.mjs test` 隔离检查：Vitest 130个测试文件通过、1跳过；1433个测试通过、1跳过。裸测试中的 `U01-09` 在隔离运行通过，未形成稳定回归。
- 隔离检查器其余 contract、time-contract、server、worker、time-parity、multimodal-lib、functions、c11-scoring、c11-history、c11-gateway 和 c11-preview 全部通过。
- 历史 `RCO-5-007` 保持3/4通过、1/4失败，原因为 `FREEZE_HASH_MISMATCH:package-lock.json`；未修改旧锁文件、旧冻结哈希或门槛。

## 证据边界

当前真实独立来源0、完整人工参照0、请求身份0、模型调用0、Secret读取0、grant/reserve/settle和权威账本写入0。没有真人、合并、部署或默认候选变更。
