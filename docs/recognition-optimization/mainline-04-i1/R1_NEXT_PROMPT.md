# 唯一下一授权建议（待用户授权，不自动执行）

前提：R1最后一轮代码独立复核无阻断；以R1最终审计与精确远端提交为准。若R1仍有业务阻断，不执行以下工程编排包。

> 授权执行 RCO-5-MAINLINE-04-I1-R2：仅适配本阶段检查编排，继续R1未完成的分层工程验收，不改产品语义、不重做PLAN、不新建数据、不调用模型。
>
> 唯一仓库C:\Users\Winner\student-affairs-multimodal-exp，分支codex/e2-multimodal-recognition-exp。起点为已推送的R1最终审计提交，先核对Git/远端、CURRENT_CONTEXT、最新日志、R1_AUDIT/CHECKS/REJECTED_SNAPSHOT/REVIEW/REVIEW_FINAL_SNAPSHOT及CHECKER_SCOPE。8实现必须匹配R1最终SHA，保护或重叠修改立即停，不回切/重装/套补丁。
>
> 本轮唯一允许修改的实现文件为scripts/check-mainline-04-i1.mjs，只新增显式R2阶段配置、当前授权基线、审核SHA绑定、保护检查和R2_*报告/独立临时目录支持；原默认行为与历史失败证据不改。原7个语义源码/测试、依赖、所有旧测试/Expected/freeze/dataset/checkpoint/cache只读。只新增本轮R2_*报告，更新约80行CURRENT_CONTEXT，日志仅追加。若需要额外实际文件或修改产品/测试/依赖，立即申请，不以跳过类型错误、删门或修改答案处理。
>
> 先用新内存编排检查证明：合法当前HEAD/7源码SHA/最新PASS审查放行；错误HEAD、实现变化、审查BLOCKED、路径越界、只读保护变化会拒绝。仍保护原845项中除本轮获准checker外844项，并追加绑定R1静态证据和7源码；不得把允许改checker扩大为允许改历史。报告只追加R2_*，旧BASELINE/REVIEW/ENGINEERING_CHECKS和各失败attempt原样保留，临时目录身份独立且输出不得覆盖。
>
> 定向编排检查通过后进行新无上下文独立审查，核对该checker与7源码最新完整SHA。无阻断才跑一次适用分层工程门：历史文件逐字SHA及原封库测试、当前依赖兼容、lint、type、全量功能测试、Schema/时间契约、build及稳定bundle隔离、安全扫描、公开依赖审计和保护检查。必要临时输出与npm审计缓存只在本轮新目录；不重装升级、不读密钥、不运行生命周期脚本或旧一次性runner。旧R2环境3/1与历史FAIL单列，不混作本轮PASS；各attempt留存，不累计不同尝试冒充更多样本。
>
> 原R1定向72项及49项旧前缀不弱化，原V2内存42/42保持；工程失败立即保留现场和精确原因，额外源码修改未经授权不得继续。任何新错误默认选择、Expected污染、保护变化、范围扩大即停。
>
> 全部门与独立审查无阻断才明确列出8实现/编排及新报告暂存清单，单独提交推送并核对远端；失败只提交审计、保留未提交实现。不得git add全工作区、强推、自动变基。
>
> 外部识别/verifier/Repair/retry/模型网络/费用/密钥/剪贴板均0，仅允许必要Git交付和公开依赖审计网络。不接真实库或稳定入口、不建数据/盲测/B10、不部署/RCO-6。新语义实际App及正式保存NOT_RUN，模型准确率明确写本轮未测量。交付分层数字、保护/Git、缺口和唯一下一建议，完成后停止，不自动接App或付费实验。
