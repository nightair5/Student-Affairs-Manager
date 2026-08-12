# Protocol 3.0.0 Hash Contract

JSON 使用递归键排序且无多余空白的 canonical JSON；文本统一 LF。Bundle 按 UTF-8 路径排序，并以长度前缀 frame 与固定 separator 连接后计算 SHA-256。

`protocolAndDeployment` 同时覆盖主 Worker route、R2 benchmark wrapper、R1 冻结调用实现、Durable Object ledger、Preview service binding/feature flag、独立 ledger Wrangler 配置、package lock、manifest preparer、runner 和 scorer。Activation 另绑定两次实际部署 version 与 bundle hash。
