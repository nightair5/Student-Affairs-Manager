# 未来调用预算卡草案：D13-C03-C16-DEVELOPMENT-R1

状态 BUDGET_UNRESOLVED / NOT_AUTHORIZED / NOT_RUN。本卡不创建授权。

- 拟比较 Candidate03 与 Candidate16，12 份已见合成 Development，每份两臂，共 24 个唯一请求；AB/BA 各 6 组。
- 请求体固定 deepseek-flash、temperature 0、reasoning none、stream false、max_output_tokens 8192；时钟、Schema、adapter 两臂一致。只候选系统指令不同。
- 当前新增业务模型调用 0；没有 grant、reserve 或 settle。本批不沿用 D11 或其他批次的许可。
- MANIFEST 的 requestBytes 是 UTF-8 字节数，不是 token 数；目前 token 未测量、供应商实扣 NOT_OBSERVABLE、费用硬上界尚未证明，金额不预填 US$8 或 US$1。
- 真正申请前只读重新核验官方路由、上下文/输出上限、峰时输入/输出/缓存价格、推理和附加收费规则。用有依据的最坏输入 token 上限与 24×8192 最大输出求和，再加入可证明的其他费用；不能证明就保持 BUDGET_UNRESOLVED。
- 实际执行前绑定最终提交、Manifest、24 个身份、请求 SHA、价格证据与用户明确指定的美元硬上限；用户看过这份具体包后授权模型、次数和上限，才可创建一个新 grant。
- 唯一账本：C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl。本轮只读基线 840 行，SHA-256 ca5bb4f57d011bcf8f583d48d637076a8c76d380d98b3f5b46b0ea6f6c9f17ea。调用前核完整链及变化来源。
- 下一执行包仍需可审查的专用执行授权绑定、跨进程锁、逐单元一次发送和 reserve/settle 状态机，不能直接把准备身份当调用许可。D13 的派发守卫一律拒绝派发。
- 每个逻辑单元最多发送一次；零重试、零 repair、零 verifier、零探测。已预留、已发送、raw 写入失败、settle 不明等状态均停发，不能凭“没有本地 raw”重发。失败保留分母。
- 不读取 Secret；今后只有已获授权的现有服务端安全路径使用服务端环境变量。

本阶段没有为草案联网核价，因为尚未开始调用申请；当前价格与硬上限必须在真正调用前重新取证，不能照搬旧批金额。
