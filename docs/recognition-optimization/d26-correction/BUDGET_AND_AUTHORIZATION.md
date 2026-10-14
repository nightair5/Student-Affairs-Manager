# D26 修订比较：具体授权卡（尚未授权）

2026-10-02；[机器可核对卡](BUDGET_CARD.json)、[官方核价记录](PRICING_EVIDENCE.json)。不是旧 D25 US$5.20 卡，也不复用任何 grant。

| 绑定 | 本批固定值 |
|---|---|
| Batch | D26-C17-C18-DEVELOPMENT-R1 |
| 实现代码 HEAD | de670d59803c2c5dbfdd488559175e444662a6d2（本地已提交，尚未同步） |
| Manifest SHA-256 | c41185c3831d35db610e5a4a563b7471b0bd60d1d92a373edd6a5c10d28f7ac2 |
| 16 身份文件 SHA-256 | 89f33327eabd2ec90f9d383ac922d56b56ca4654cfee0be47aac083eea411e89 |
| 请求 | 8 已见开发来源 × C17/C18，16；4AB/4BA，逐 ordinal 一次；每份 requestSha/unitSha 见卡 |
| 路由/参数 | https://api.deepseek.com/responses；deepseek-flash；temperature=0；reasoning=none；stream=false；max_output_tokens=8192 |
| 官方价格核验 | 2026-10-02T10:58:48Z；峰时未命中输入 US$0.30/M、输出 US$1.20/M；不假定折扣/缓存收益 |
| 每次内部保守上界 | 324404 micro USD = US$0.324404 |
| 16 次保守总上界 | **US$5.190464**；建议独立硬上限 **US$5.30** |
| 实际状态 | 全部 NOT_RUN / dispatchAuthorized=false；发送、grant/reserve/settle 均 0；实际 usage NOT_RUN，供应商实扣 NOT_OBSERVABLE |

[DeepSeek 官方价格页](https://api-docs.deepseek.com/quick_start/pricing/)列模型当前路由、1M 上下文、384K 服务上限及输入/输出计费。请求只允许 8192 输出。使用保守二进制 1M 输入上界 1,048,576，按整上下文给每单元预留：`ceil(1,048,576×0.30 + 8192×1.20)=324404 micro USD`，再乘 16。不是把 UTF-8 字节当 token，也不是预测实耗；它有意远大于这些短通知的预期耗费。

[Responses 官方说明](https://api-docs.deepseek.com/guides/responses_api)支持输出上限、非推理配置和真实 usage；超上下文请求返回 400，usage output 包括推理 token。本批没有 tools、图片、持久文件、server-side 工具或 reasoning 调用。价格网页未列本批额外固定 API 费用；不把这一点泛化到其他收费服务。派发前必须重新确认路由、token 上限和全部收费规则；若出现额外收费或无法证明硬界，标 BUDGET_UNRESOLVED、grant 前停止。

HTTP/解析失败仍保留第一次实际回答和分母。usage 缺失时内部 settle 用整次上界，不冒充供应商实扣；发送、raw、settle 不确定即停止后续，未知请求不会自动重发。零连通性探测/重试/repair/verifier/额外样本。

## 当前阻碍与最小剩余动作

1. 已知 CI 分支只有 checks；Cloudflare Pages 列表和最近 Worker 手动部署不能证明 Worker Builds 无自动分支绑定。只读 UI 未登录、CLI 不支持该查询。按本轮用户要求保留本地提交，不推送。最小外部动作：登录 Cloudflare 后只读核对本仓库/分支的 Worker Builds 触发设置；无自动发布副作用后普通推送并核远端。
2. 新 D26 安全核心及故障注入通过；真实宿主已有 D25 实现可复用，但必须绑定新 batch/身份/费用/账本基线并离线验证；不能把旧 D25 CLI 换一个名字直接使用，更不能复用旧 grant。该接线不需要额外模型请求，付费前完成。
3. 未有本批模型许可。授权后重新核最终完整提交 HEAD（包含结果包）、upstream/remote、身份、价格与当前账本完整链；任一关键状态漂移在创建 grant 前停止。

## 用户随后可提供的具体授权文字

```text
授权仅执行 D26-C17-C18-DEVELOPMENT-R1 冻结修订包：
Candidate17 vs Candidate18，8 来源 × 2 臂，共 16 个 deepseek-flash 请求，
Manifest SHA-256 c41185c3831d35db610e5a4a563b7471b0bd60d1d92a373edd6a5c10d28f7ac2，
身份文件 SHA-256 89f33327eabd2ec90f9d383ac922d56b56ca4654cfee0be47aac083eea411e89，
费用硬上限 US$5.30，只创建一个本批新 grant，逐单元 reserve/settle。
调用前核官方当前费用、身份、已提交且同步的执行宿主及账本；
最坏费用超上限或发送/结算状态不确定立即停发。
不授权额外样本、探测、自动重试、repair、verifier、真人、
独立 Holdout、默认替换、合并或部署；旧批许可不得复用。
```

这段是供用户将来主动发送的模板，文件本身不是授权。无许可仍完成本地工程；有许可在同一个工作包完成真实输出、两臂逐来源比较和分层决策，不再交启动说明。
