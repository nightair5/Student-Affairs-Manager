# 本批具体费用与授权

状态：**ENGINEERING_DELIVERED_PAID_BATCH_NOT_AUTHORIZED**。本卡只是可审核申请，不是授权，不创建grant/reserve/settle。

| 项目 | 本批固定内容 |
|---|---|
| 批次 | D26-C17-C18-DEVELOPMENT-R1 |
| 比较 | Candidate17 vs Candidate18，8份已见D25来源×2=16；4AB/4BA |
| 原比较快照 | 4699d5cfdd6211299d9ab82ef7000d99fc8fe8f8 |
| 执行工具代码提交 | 4555375788b006506abeae6107de5902ac95ad80，已普通推送 |
| 实际派发HEAD | 获准时重新核最终HEAD、upstream和远端一致，绑定到本机AUTHORIZATION；文档后续提交不能沿用旧HEAD绕过检查 |
| Manifest SHA-256 | c41185c3831d35db610e5a4a563b7471b0bd60d1d92a373edd6a5c10d28f7ac2 |
| 16身份文件 SHA-256 | 89f33327eabd2ec90f9d383ac922d56b56ca4654cfee0be47aac083eea411e89 |
| 每份identity/request SHA | [只读矩阵units](evidence/COMPARISON_REPORT.json)，逐项对照原身份，不重新生成 |
| 路由/模型 | https://api.deepseek.com/responses；deepseek-flash（当前官方映射DeepSeek-V4.1-Flash） |
| 固定参数 | temperature=0，reasoning.effort=none，stream=false，max_output_tokens=8192；其他参数依原冻结 |
| 核价时间 | 2026-10-03 00:16:14 Asia/Shanghai；12小时证据窗口至12:16:14；实际创建grant前再核一次 |

官方[价格](https://api-docs.deepseek.com/quick_start/pricing/)与[Responses API](https://api-docs.deepseek.com/guides/responses_api/)留存于[核价证据](PRICING_EVIDENCE.json)。使用峰时未命中缓存输入US$0.30/百万token、输出US$1.20/百万token；不依赖折扣或缓存命中。官方上下文1M取更大的1,048,576输入上界；固定输出8192另留预算。供应商输出上限384K远大于本批8192。

每单元上界：ceil(1,048,576×0.30 + 8,192×1.20) = **324,404 microUSD = US$0.324404**。
16单元合计 **US$5.190464**；建议硬上限 **US$5.30**。这来自模型允许的完整上下文界，并非把请求字节数换算成token，也不是预计实际消费。失败请求按同一单元上界保留；未知发送或计费状态立即停批，不自动重试。

本批仅文本，无图片、工具、服务器资源；官方按输入/输出token计费，输出usage包含推理token。新附加收费、路由/限制变动或价格过期会使该证明失效，须重新核价；超过用户硬上限时在grant前拒绝。真实usage只取原始响应，保守内部结算与供应商实扣分列，当前实扣NOT_OBSERVABLE。

当前实况：16/16 NOT_RUN；实际发送0、确定响应/结算0、不确定0；本批grant/reserve/settle均0。两臂各8个来源未知，正确率null/NOT_OBSERVABLE。权威账本938行、782221字节、SHA e79aec8bbb1378e37f3941d8ffac9cce7d74bbb8e11d7ceee5c90a88b6c734b9，本轮未追加。历史许可没有复用。

下一次只需用户明确给出以下本批授权；这是**待用户发出的文字**：

> 我授权仅执行D26-C17-C18-DEVELOPMENT-R1原冻结的Candidate17 vs Candidate18共16个deepseek-flash请求，费用硬上限US$5.30；允许且只允许本批创建一个新grant，逐单元reserve/settle。按冻结顺序每身份最多发送一次，不包含额外样本、重试、repair、verifier、真人、Holdout、默认替换、合并或部署。核价或状态不确定时立即停发。

授权收到后直接沿已交付宿主接续：重核价/身份/账本/同步HEAD→建立本批唯一许可→16次顺序执行→原v10双臂评分→最多3类根因→现有产品新录制回放与受影响路径验收。无需另写只有启动说明的新阶段。真人材料缺失不阻挡这个本地识别比较。
