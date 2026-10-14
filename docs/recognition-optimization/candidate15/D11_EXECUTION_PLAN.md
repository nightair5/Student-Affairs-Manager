# D11 冻结 Development 配对评测执行契约

数据角色：12 份**完全已见、合成** Development 来源；D9 的 12 份单作者/模型辅助参照是 provisional，不是独立人工真值。两臂为 Candidate03 与 Candidate15，按 D10 的 24 个 ordinal 逐个发送，6 组 AB、6 组 BA。D10 Manifest 和请求文件原样保留；执行记录另写入 `d11-development-20260928a`。

本批唯一授权来自用户 D11 消息：`deepseek-flash`、最多 24 个冻结请求、US$8.00 硬上限、一个新 grant 和逐单元 reserve/settle。零重试、零 repair、零 verifier；任何发送、raw 或结算不确定即停止，绝不根据“本地没有 raw”重发。grant 和请求均绑定提交 HEAD、D10 双哈希、24 个身份及请求哈希。历史账本前 791 行的 SHA-256 必须保持 `efb46f116db9c550ba53624c5d710164c6143ba9cc30c57ab2b7515c059f4d6a`，后续只允许本批事件沿原链追加。

2026-09-28 再查 DeepSeek 官方文档：`deepseek-flash` 路由到 V4.1-Flash，模型元数据的上下文窗口为 1,048,576 token，Responses API 的 `max_output_tokens` 包括所有生成 token。以峰时 cache-miss 输入 US$0.30/百万 token、输出 US$1.20/百万 token 和每单元 8,192 输出上限计算，逐单元向上取整预留 324,404 微美元，24 单元共 US$7.785696，低于硬上限 US$8.00。D10 草案使用四舍五入的 “1M” 窗口得到较低值，本次采用官方精确元数据重新保守计算；请求字节数不充当 token 数。供应商实扣额不可直接观察时标 `NOT_OBSERVABLE`。

官方依据：[Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing/)、[Lists Models](https://api-docs.deepseek.com/api/list-models/)、[Responses API](https://api-docs.deepseek.com/api/create-response/)。调用前若官方路由、价格、计费或上限改变、出现无法封顶的额外费用，必须在 grant 前停于 `BUDGET_UNRESOLVED`；账本或冻结身份漂移也一样停止。

执行器 `scripts/run-candidate15-d11.mjs` 先提交并推送，再运行 `--prepare`，随后只能用 `--dispatch-all` 派发。其账本和状态记录保留 `NOT_SENT`、`RESERVED`、`SENDING`、`RAW_SAVED`、`SETTLED`、`UNCERTAIN`；新目录锁阻止同批并发，异常锁留在现场。`scripts/score-candidate15-d11.mjs` 只有在 24 个结局都已结算后才生成 v6 配对结论。旧治理校验器固定要求 791 行，D11 账本合法追加后只能用 D11 前缀及全链校验，不修改旧断言或旧文件。

晋级门槛保持 D9/D10 已冻结条件：24 个确定结局；每臂 12/12 Schema 和引用有效；Candidate15 Severe、Forbidden、教学例泄漏均为零；相对 Candidate03 不增加任务 FN 和关键字段 Major；整份正确至少净增 2。未全部达到即 `REJECT_CANDIDATE15_DEVELOPMENT`。本次不处理独立 Holdout、真人试用、默认候选、合并或部署。
