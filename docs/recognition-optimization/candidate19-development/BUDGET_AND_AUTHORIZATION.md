# 本批核价、真实调用与封存状态

2026-10-04。用户已明确授权C19-C17-C19-DEVELOPMENT-R1原12个deepseek-flash请求、US$3.90硬上限和唯一新grant。**授权已使用：1grant、2reserve、2settle、2发送；10个未发送。** 第3单元发送前Git核验TLS失败留下锁，未删除、未续发、未第二次prepare。本文件不是恢复锁或新增费用许可。

## 第一次grant前官方复核

只读[DeepSeek官方价格](https://api-docs.deepseek.com/quick_start/pricing/?tab=case-studies)和[Responses协议](https://api-docs.deepseek.com/guides/responses_api/)。当次deepseek-flash路由DeepSeek-V4.1-Flash，1M上下文/384K最大输出；冻结Responses、temperature0、reasoning.none、stream.false、max_output_tokens8192。输出计量包含推理。峰时缓存未命中输入US$0.30/M、命中0.006/M、输出1.20/M；非峰半价。峰时工作日UTC01–04/06–10，中国法定节假日除外；没有用缓存/非峰优惠降低预算，没有将字节当tokens。未来价格不可照搬。

全上下文1,048,576输入+8192输出，单元ceil=324404 microUSD；12单元**3892848 microUSD=US$3.892848**，低于授权US$3.90。原Manifest794f0949a3342f0fbad6a70cb5916e69bf7f447757260bf2aae78398fef47c79、身份7d969f0aeb216bd158fc2a32346a5b1863fa189e5b206386be2205bd5708a5e0；授权绑定当时已同步HEAD ddff187173c5c9e2a7b4a29ca063bea26711dc09和原snapshot ce97b325f38897e87a55b63ddaea9470e8ea4156。

真实USER_AUTHORIZATION/PRICE_EVIDENCE/AUTHORIZATION只在本机.data/candidate19/execution，不入Git、不展示Secret。原PRICE_SNAPSHOT和ZERO_CALL_REPORT保持为此前冻结准备快照，不当当前状态。

## 两次真实usage与内部结算

| ordinal | 候选 | input | cached input | output | reasoning | total | 内部保守microUSD |
|---|---|---:|---:|---:|---:|---:|---:|
| 1 | C17/S01 | 4344 | 3840 | 222 | 0 | 4566 | 1570 |
| 2 | C19/S01 | 4596 | 0 | 1285 | 0 | 5881 | 2921 |
| 合计 | 2/12 | 8940 | 3840 | 1507 | 0 | 10447 | 4491 |

内部结算US$0.004491是实际usage×保守单价的记账上界，**不是供应商实际扣费**；实扣NOT_OBSERVABLE。原始响应及usage在[现场报告](paid-evidence/EXECUTION_REPORT.json)和两份原raw中可核。账本只追加1grant+2reserve+2settle，ordinal3–12没有reserve/settle/send。

账本971行SHA7b1d1935254a7d7830e1d03892d12895707b71107dfc1bfb611f3459e839367d→976行SHA bcb849817e2d956f7caa61c26c70200229e91136c15c18eea88c9bcfecfc4458；完整链和原前缀有效。之后产品工程账本只读。唯一grant C19-R1-1fe28759-b1d5-412c-abf9-c118fa79f0ad。

## 当前可做与不可做

resume-read-only和report允许读现场，但nextOrdinal=3不是续发许可。原执行协议禁止删除锁，当前代码HEAD也已不同于原授权绑定。不能覆盖原授权、删锁、重新建grant或用剩余金额扩样本。原两次状态确定、余下10未发送，0不确定；保留12固定分母，不判赢家。

所需唯一具体恢复文字：

> 授权对C19-C17-C19-DEVELOPMENT-R1第3单元发送前Git核验留下的锁进行一次有证据的安全恢复；只续原10个未发送身份，沿用唯一原grant和US$3.90整批总上限，前2个不重发，不新增身份、重试、repair或verifier。先保留原现场并离线验证版本化恢复；账本、raw、状态、身份、新同步HEAD和重新核价全部一致才恢复，任何不确定继续封存。

这是待用户明确批准的窄范围恢复，不是再次申请12次费用或第二grant。恢复实现须用新的补充绑定保留原授权，证明锁owner已终止与未发送，当前价不会越整批硬上限；单元3若出现任何发前/发后未决证据就保持封存。真人/Holdout/默认采用/合并/部署均不在此范围。
