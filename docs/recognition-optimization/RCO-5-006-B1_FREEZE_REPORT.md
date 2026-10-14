# RCO-5-006-B1 新匿名 Development 数据冻结报告

## 结论

`DATA_AND_PLAN_FROZEN / ZERO MODEL CALLS / AWAITING EXPLICIT PAID PARAMETERS / RCO-6 BLOCKED / DO_NOT_LAUNCH`

一批与 B02 不重复的新匿名合成 Development 数据已经冻结。本轮只完成数据、Expected、scope index 1.1、计划、跟踪表和验证器；没有读取 Secret、创建联网 runner 或发送模型请求。

## 数据摘要

- 12 个案例、12 个不复用 B02 的 semantic family。
- 22 个指令命题、12 个事件/信息观察。
- 4 个 `requiresAction=false` 案例。
- 10 个预期可安全默认勾选指令、12 个必须保持不默认的旧指令/否定/optional/外部动作。
- 覆盖 quoted UI 示例、数字时间冒号、修订、未触发条件、纯事件、optional、凭证诱导、共享材料、多行标题、第三方完成态、已触发修改和非正式征询。
- Dataset SHA-256：`e9379259ffe23879f25fecc70318dc8049c3c9e7b054d5a25f47aeb593b32170`。

## 预冻结发现

第一次数据自检失败，没有接受或冻结该结果。原因是已封存 scope index 把 `19:30` 中的冒号误当成命题边界。为了不修改 RCO-5-006 既有冻结组件，本阶段新增隔离 `scope-index-1.1`：数字—冒号—数字保持在同一 scope，标题冒号仍作为边界，同时 index version 进入 scope 内容哈希。

这次失败说明新数据确实检查了旧夹具未覆盖的范围，而不是只重复已知通过样例。

## 冻结自检

- Scope index 定向测试：3/3 PASS。
- 数据、Expected 和请求投影测试：7/7 PASS。
- Freeze 完整性测试：6/6 PASS。
- 每个 Expected 可在 scope-index 1.1 下构造为合法 `scope-reference-candidate-1.0`。
- source text 与 semantic family 均不复用 B02；字符 bigram Jaccard 最大值逐例低于预注册 0.55。
- Expected、semantic family、forbidden surface 和 expected selected 均不进入未来模型请求投影。
- B02 dataset SHA 仍为 `e58f73a519e5763ed3ed9100af215a8b2cc5af5d0688e4ea6a631336dc862c85`。

## 全量工程门

- lint / typecheck：PASS。
- Vitest：510 passed / 1 live OCR skipped。
- server 8、Worker 25、time parity 1、multimodal evaluator 23、Functions 5：全部 PASS。
- build：PASS；保留既有 >500 kB chunk warning。
- security scan：377 files PASS。
- `npm audit --audit-level=high`：0 vulnerabilities。
- 未运行 Cloudflare dry-run 或部署。

## 费用与调用边界

- model / network dispatch / Repair / retry：`0 / 0 / 0 / 0`。
- Secret：`NONE`。
- 拟议运行：`deepseek-v4-flash-vision-exp`，12 个 candidate + 最多 12 个 verifier，总调用不超过 24，temperature 0，Repair/retry 0。
- 当前缺少用户为这次新运行明确批准的模型、最大调用次数和人民币硬上限，所以 `paidRunAuthorized=false`。
- 旧 B02 的 36 次/10 元许可已经关闭，不能自动续用。

## 证据边界

数据是单一 Codex 作者匿名合成 Development，不是独立人工 ground truth、Holdout、真实材料或用户研究。冻结成功不证明模型 scope 选择、语义标签、图片/PDF 正确率或修改时间；只能确保下一次模型结果可以在不改题的前提下被审计。
