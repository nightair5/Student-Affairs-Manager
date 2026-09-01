# RCO-0 历史多模态结果重分类

- schemaVersion: `rco-0-reclassification-1.0.0`
- generatedAt: `2026-09-01T17:34:16.920Z`
- baselineCommit: `c0771e927772a0986b0961108af68366b8127f41`
- clientValidatorSha256: `9bbf82f9bf88af6d6886ce053a3bd86841c5498a4ca59795a40f861e6fb3e27d`
- rco0ScorerSha256: `c789959b6b3127b3aa2745fdd24e7ac50658d8bf599dcf78dbe02df4bf567097`
- modelCalls: `0`
- verdict: `NO_PROMOTION`

旧 checkpoint、summary、dataset、Expected、freeze 与缓存均为只读输入；原始分数只保留为 `LEGACY_SCORER_DIAGNOSTIC_ONLY`。

| Run | Arm | Planned | 返回结果 | 客户端有效 | 请求失败 | 无效结果 | 重分类状态 |
|---|---:|---:|---:|---:|---:|---:|---|
| MM-V2-001 | T | 36 | 36 | 0 | 0 | 36 | INVALID_RUN |
| MM-V2-001 | I | 36 | 36 | 1 | 0 | 35 | INVALID_RUN |
| MM-V2-001 | IT | 36 | 35 | 2 | 1 | 33 | INVALID_RUN |
| MM-V3-I-001 | T | 0 | 0 | 0 | 0 | 0 | NOT_RUN |
| MM-V3-I-001 | I | 36 | 36 | 0 | 0 | 36 | INVALID_RUN |
| MM-V3-I-001 | IT | 0 | 0 | 0 | 0 | 0 | NOT_RUN |

## 结论边界

- “36/36 success”只能改释为 36/36 request/model returns，不能称客户端成功。
- V2/V3 都是 12 个语义模板家族的合成代理，不是 72 个独立真实案例。
- 历史 Forbidden 指标搜索了 description，标记为 `UNINTERPRETABLE_UNDER_OLD_DESCRIPTION_SCOPE`。
- V2 IT 有一个 transport failure，所有配对质量比较保持 `INVALID_RUN`。
- 真实去标识材料、真人修改时间、浏览器验收与商业正确率仍为 `NOT_RUN`；不得晋级或上线。
