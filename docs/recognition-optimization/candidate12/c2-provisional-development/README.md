# Candidate12 Codex 临时 Development 数据包

状态：`PROVISIONAL_MODEL_AUTHORED_DEVELOPMENT_ONLY`。独立 Holdout 资格：`false`。

本包由 Codex 按用户要求制作，包含 12 份完全合成的匿名校园通知和 12 份结构化参照，覆盖单任务、多任务、true/false/unknown 条件、共享材料、精确与模糊时间、完成标准、依赖、禁止项、无任务资讯，以及两份多端点修订。

它不是独立人工真值：来源和 Expected 均由 Candidate12 实现侧可见的 Codex 制作，没有真实标注者 A、复核者 B 或独立裁决。因此它只能用于模板、哈希、评分器和阻断逻辑的 Development 检查，不能生成正式 24 个 Holdout 身份，不能用于 Candidate12 对 candidate03 的晋级结论。

文件：

- `PROVISIONAL_DEVELOPMENT_PACKAGE.json`：12 份来源、完整但 provisional 的结构化参照及逐项 SHA-256。
- `VALIDATION.md`：验证结果和证据边界。
- `scripts/build-candidate12-provisional-development.mjs`：确定性构造与重复验证。
- `scripts/candidate12-provisional-development.node-test.mjs`：资格阻断、哈希和排除库测试。

这 12 份正文已加入 C1 `OVERLAP_CORPUS.json`，未来人工来源与它们逐字或高相似重合时必须被拒绝。人工门状态继续为 `WAITING_FOR_INDEPENDENT_HUMAN_LABELS`。

后续D1已基于本包另建24个`dispatchAuthorized=false / NOT_RUN`的临时Development配对身份，目录为`../d1-provisional-paired-preparation/`。这些不是正式Holdout身份，不改变本包的独立资格或人工门状态。
