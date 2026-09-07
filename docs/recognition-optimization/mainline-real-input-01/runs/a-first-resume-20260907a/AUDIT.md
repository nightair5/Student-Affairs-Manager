# MAINLINE-REAL-INPUT-01：首页接通，首调前预算复核未通过

结论：**NOT_COMPLETE / PAID_BLOCKED**。同一包，不重做PLAN。用户批准第42路径和A01优先顺序已接受；本次未运行A01，没有真实模型调用、模型网络或费用。

## 实际推进与未完成

- DashboardPage新增显式realInput能力：按钮先打开输入核对，文案说明逐次同意后才发送；保留日期视图，旧人工/default分支不变。仅trim判空，新入口向App传原始quickText。
- App仅新增对应props。新验收测试保留原失败attempt，将此前误写的品牌按真实组件纠正，并新增旧/新首页说明正反对照。
- 首页复现7通过/1失败，修后8/8。逐键/实际浏览器原文保真仍NOT_RUN，不能用源码检查代替。
- 当前35实现存在、7路径未创建。启动器、评分器、runner及A/B绑定尚未完成，服务端配置NOT_CHECKED，实际OCR/Edge/下载与完整工程均NOT_RUN。

## 独立复核为什么阻止A01

新登记 **P1_DUPLICATE_USAGE_RELEASE**，位于scripts/real-input-budget.mjs的validateUsageEnvelope与lease.complete。

审查使用新临时账本、合法模拟租约和假HTTP200，无模型或真实凭据。原始usage同时含input_tokens:1048576与input_tokens:100；JSON.parse保留后值，校验按100输入+10输出结算390微元（0.000390元）。实际账本出现reserve3300000→settle390，重开仍成立。正常单一字段响应对照也能结算。

这不是已经产生超支，也不是DeepSeek真实返回了坏数据；问题是有歧义的原始用量会被当作可靠费用依据，无法证明释放预留仍满足原10元保证。原授权规定usage异常保留3.30元并停发，此处未满足。主代理独立复核了函数返回和实际持久账本。两份账本原文、SHA和来源见RESULT.json。

旧预算/网关52/52在当前源码重跑通过，表明原测试漏掉此反例，不能据此放行首调。独审BLOCKED后立即停止产品/测试实现修改，未修预算，未继续创建runner或付费manifest；只追加失败审计。首页并非现在的费用阻碍。

## 公开协议与价格

本轮只访问官方公开文档：
- [人民币价格](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)仍列该模型高峰未缓存输入3元/百万token、输出9元/百万token和1M上下文。
- [Responses兼容文档](https://api-docs.deepseek.com/guides/responses_api/)列该模型及temperature、max_output_tokens支持。

这不是账号认证或实际计费验证；reasoning/结构格式的首调前完整核验、有效期内费用证据绑定仍须完成，没有生成可派发授权manifest。本次没有访问真实服务端凭据或剪贴板。

## 保护与交付边界

- 起点本机/实时远端：7a30e0989d514d1df11475f4860cc014db4ce09e。
- 原946保护仅用户新批准的Dashboard变化；其余945逐字匹配。原清单不修改，旧Dashboard SHA代入核对原聚合摘要；当前945和新页SHA分别登记。
- 原34实现中只有App、当前新acceptance测试变化，新增例外Dashboard；其余现场SHA保持。最终完整35/7见IMPLEMENTATION_SNAPSHOT。
- 旧16+12+20及上轮原始日志、所有追加日志前缀匹配；既有Expected/freeze/dataset/checkpoint/cache/历史FAIL、全局Schema/repository/capture/validator/confirmationV2/domainCommit/时间AST/依赖只读。
- 无真实用户库、真实材料、真人、稳定入口或部署。模型识别准确率：**本轮未测量**。
- 按git-push技能精确暂存本run审计/原始日志、CURRENT_CONTEXT和追加日志；35实现保留未提交。推送不强推、不自动变基；最终提交以Git交付答复及远端核验为准。
- 暂存完整diff检查仅提示两份原始Vitest日志末尾空行；原始日志保持逐字，不清洗证据。手写文档/JSON/交接的定向diff检查通过，不能把该结果写成全量工程通过。3份日志经敏感串检查无命中，按精确路径强制纳入Git；不修改gitignore。

## 唯一下一动作

先解除这个已登记的预算歧义，不换模型、不重做计划或扩数据。最小修复仍只需原42路径内的预算模块及对应Node测试，不需要新公共文件或依赖。修复并独审后恢复既定A01优先顺序；不是放弃真实调用或重新等全浏览器验收。

可复制授权：

> 继续同一MAINLINE-REAL-INPUT-01，明确授权修复a-first-resume-20260907a登记P1_DUPLICATE_USAGE_RELEASE。先核最新审计Git/远端、IMPLEMENTATION_SNAPSHOT的35现有SHA/7未建、945只读保护及Dashboard获准例外、静态证据与日志前缀，不回切、不重做PLAN或重复实现。保持42路径，优先仅改scripts/real-input-budget.mjs及其Node测试：在结算前检查原始响应身份/usage是否有重复或冲突属性，解码后的同名键也须识别；有歧义则保留完整3.30元预留并停发，不靠JSON.parse后值或选小值结算，不拒绝全部正常响应。先补反例与正常对照，再验证真实临时账本complete/重开/下一请求拒绝，旧52断言不弱化。独立安全复核无阻断后，同包继续原A/B输入与候选评分绑定、服务端安全配置和首调参数价格核验，先A01，符合原继续条件再A组；其余工程/Edge随后同包完成。原24次10元/滚动预留/模型参数/0 verifier Repair retry和所有停止条件不变。新重大安全/预算/保护/范围问题立即停；不接真实库/稳定入口、不部署。成功精确业务Git交付；未通过仅审计保留现场。
