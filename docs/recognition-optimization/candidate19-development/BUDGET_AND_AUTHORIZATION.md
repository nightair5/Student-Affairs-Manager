# 原批费用、一次恢复与完成状态

2026-10-04。C19-C17-C19-DEVELOPMENT-R1原12个deepseek-flash身份，原授权US$3.90及唯一grant；后明确仅恢复发送前遗留锁、续10未发送、前2不重发。**12/12 SETTLED，1grant12reserve12settle，0不确定。本批许可耗尽，不再prepare/dispatch。** 真实许可/补充绑定/核价原件只在本机.data，此文不授权新调用。

## 续发前官方重核

[官方价格](https://api-docs.deepseek.com/quick_start/pricing/)、[Responses参数](https://api-docs.deepseek.com/api/create-response/)本轮续发前只读核验。deepseek-flash路由DeepSeek-V4.1-Flash，1M上下文/384K最大输出；冻结Responses/temperature0/reasoning.none/stream.false/max8192不变。峰时输入缓存未命中US$0.30/M、命中0.006/M、输出1.20/M。**工作日UTC01–04/06–10（中国法定节假日除外）是非峰半价窗口**，此前文案倒置已纠正；执行上界一直按峰时全未命中，不受文案订正影响。

不依赖缓存/非峰优惠，不把字节当tokens。每单元1,048,576输入+8192输出、ceil324404 microUSD；原12单元最坏US$3.892848≤3.90。续发保守已结算+余10上界也不超整批cap。价格只代表发送时核价证据，不是永久价格。

Manifest SHA794f0949a3342f0fbad6a70cb5916e69bf7f447757260bf2aae78398fef47c79；身份SHA7d969f0aeb216bd158fc2a32346a5b1863fa189e5b206386be2205bd5708a5e0；snapshot ce97b325f38897e87a55b63ddaea9470e8ea4156。原AUTH绑定ddff187173c5c9e2a7b4a29ca063bea26711dc09且字节不改，恢复补充绑定同步代码5d395c3a7dbd6e0d2257ce275f415941b592768f及同一原grant/cap。

## 真实usage及内部结算

[完整逐单元报告](paid-evidence/completed/FROZEN_COMPARISON_REPORT.json)、[最终保全证明](paid-evidence/completed/COMPLETION_PROOF.json)。1/2原raw不改，3–12本轮各一次HTTP200，零额外样本/重试/repair/verifier。

| 汇总 | 原前2 | 本次续10 | 整批12 |
|---|---:|---:|---:|
| input tokens | 8940 | 45330 | 54270 |
| output tokens | 1507 | 13004 | 14511 |
| total tokens | 10447 | 58334 | 68781 |
| cached input | 3840 | 39680 | 43520 |
| reasoning | 0 | 0 | 0 |
| 内部保守microUSD | 4491 | 29208 | 33699 |

**US$0.033699是实际usage×保守单价的内部结算，不是供应商实扣；实扣NOT_OBSERVABLE。** 没有以便宜扩样本。

唯一grant C19-R1-1fe28759-b1d5-412c-abf9-c118fa79f0ad。整批账本971→996（25合法行），本次恢复976→996（20合法行）；996行SHA c58231633b8da1b87e9106f92d0dd457f00e4789e5e5fa03de780fb377dc8750，完整链/原前缀有效。恢复与产品工程本身0写账本，只有获准逐单元reserve/settle产生本次20行。

## 安全恢复及停发

先证明锁owner终止、单元3在reserve前、所有状态/身份/raw/receipt一致，无孤立写入。保全before-private；独立guard内比较锁身份，原子改名保留recovery-1/lock-original，留日志，不删除现场。缺日志、guard残留、漂移或发送不确定均封存。原前2不重发，没有第二grant或覆盖原AUTH。

原2/12的EXECUTION_REPORT/BATCH_STATUS/EXECUTION_FAILURE、原ZERO_CALL_REPORT保持历史原字节，当前状态以completed和RESULTS为准。12结局确定、无活动锁/HALT；余款不授权更多调用。真人/Holdout/默认采用/合并/部署不在授权范围。
