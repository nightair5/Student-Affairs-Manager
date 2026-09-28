# D14 新批授权卡：尚未授权、尚未发送

核价：2026-09-28，只读 [DeepSeek 官方 Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing/)。当前 `deepseek-flash` 映射 DeepSeek-V4.1-Flash，官方列 1M 上下文、384K 最大输出；本批已冻结 `max_output_tokens=8192`、非思考模式。峰时未命中缓存输入 US$0.30/百万 token、输出 US$1.20/百万 token；命中缓存/非峰时更低。官方按输入和输出 token 计费，价格可调整，临近调用必须重核。

| 项目 | 本批绑定 |
|---|---|
| 比较 | 已见合成 Development 的 Candidate03 vs Candidate16，12 来源×2=24 次；6 AB/6 BA，零替代样本 |
| 模型与参数 | `deepseek-flash`，temperature 0，reasoning none，stream false，每单元最多输出 8192 token；D13 请求正文不含 Expected |
| 冻结清单 | D13 `MANIFEST.json` SHA-256 `b60a6ee22ab1e8f53088ba34d7a2151bbce3f7c700aafa596097701456a5c167`；`PREPARED_REQUEST_IDENTITIES.json` SHA-256 `0a50d55fb8818cacf01319503df7d127fd1020adc1efcb726eb049ae59a5cbda`；每个请求 SHA 在该文件内逐项绑定 |
| 代码起点 | 执行器提交 `50f7161`、隔离检查提交 `7b16ffb`；实际授权记录必须绑定授权时已提交且远端同步的最终完整 HEAD，不可假定这些短 SHA 永远是最终 HEAD |
| 最坏 token 上界 | 官方写 1M 上下文；为避免十进制/二进制歧义，保守用每单元 1,048,576 输入 token + 8,192 输出 token；请求 UTF-8 字节数不代替 token |
| 峰时保守单位费用 | 向上取整到 microUSD：`ceil((1,048,576×0.30 + 8,192×1.20)/1,000,000 ×1,000,000)=324,404 microUSD` |
| 24 单元合计 | `24×324,404=7,785,696 microUSD`，即 **US$7.785696**；建议新授权硬上限 **US$7.80** |

这个上界只在官方上述路由、上下文和计费规则持续成立、无额外收费且实际请求仍为冻结正文时有效。运输失败、HTTP 错误、usage 缺失按该单元完整 324,404 microUSD 保守占用，不因无本地 raw 视为免费。服务商最终实扣若无账单证据写 `NOT_OBSERVABLE`，不能把 reserve/settle 的保守数称为实扣。价格、规则、输入上限或请求发生漂移，停止并重做授权卡。

权威账本唯一位置：`C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl`。本轮核完整哈希链，840 行、SHA-256 `ca5bb4f57d011bcf8f583d48d637076a8c76d380d98b3f5b46b0ea6f6c9f17ea`，只读、append 0；旧 D11 grant/US$8 许可不能沿用。

执行器 `node scripts/run-candidate16-d14.mjs --verify` 只读；`--dispatch-next` 在不存在本批授权文件时抛 `D14_LIVE_AUTHORIZATION_REQUIRED`，故障注入和账本前后哈希已测。实际未来调用需用户另行明确给出**这一批的模型、24 次和美元硬上限**，再核价/核账本/核最终 HEAD、24 个 requestSha、各 unitIdentity；建立唯一 grant 并逐单元 reserve→一次发送→raw SHA/usage→settle。锁被遗留、发送/费用/raw/settle 任一状态不明，一律封存停发，不重试或 repair/verifier。授权文件不得只凭本草案生成；本轮 0 grant/0 reserve/0 settle/0 模型调用。
