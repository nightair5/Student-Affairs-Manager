# Candidate03 vs Candidate13 D5 预注册

数据角色为`SYNTHETIC_DEVELOPMENT / PROVISIONAL_MODEL_AUTHORED`，最高只支持工程筛选。

## 固定设计

- A：`real-input-source-semantics-3`；B：`real-input-source-semantics-13`。
- 模型`deepseek-flash`，temperature 0，reasoning none，max output 8192。
- reference time `2026-09-22T09:00:00+08:00`，timezone `Asia/Shanghai`。
- Schema、adapter、reference contract、compiler和scorer在Manifest按SHA/版本绑定。
- S01/S03/S05/S07/S09/S11为A→B，其余为B→A，共6 AB/6 BA。
- 每个逻辑单元只发送一次，零自动重试、零repair、零verifier。

## 失败和分母

超时、运输、响应解析、Schema、引用和语义失败分开记录。任一请求是否已发送/计费无法确定时立即停止，禁止自动重发。所有24个逻辑单元都留在分母，不删除失败样本。

## 晋级门槛

1. 24个单元都有确定结局。
2. 两臂各12/12 Schema与引用有效。
3. Candidate13 Severe=0、Forbidden=0、教学例泄漏=0。
4. Candidate13相对Candidate03不增加任务FN或关键字段Major。
5. Candidate13完整正确来源至少净增2。

任一条未满足，固定结论为`REJECT_CANDIDATE13_DEVELOPMENT`，不得降低门槛。通过只表示允许申请独立Holdout/真人验证，不授权修改默认候选或部署。
