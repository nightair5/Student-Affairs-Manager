# MAINLINE-REAL-INPUT-01 本轮失败审计

结论：**NOT_COMPLETE / 新P1停止**。登记的JSON转义凭据反射已经修复并独审通过；继续主线时发现另一项正常操作可触发的确认风险，按授权停止，不拆新阶段、不改历史结果。

## 已推进什么

- 发送安全：在记录、返回、结算前检查JSON解码键值和嵌套模型文本。真实临时记录器的恶意假凭据响应写入0字节，预留不释放、不重发，正常响应可成功。
- 本机读取：显式新profile，文件签名/大小/像素及本机资源约束、取消/超时、PDF逐页与混合文本层/OCR结果保留。真实OCR未运行，不能称识别准确。
- 保存核心：Source/Version/Run/Draft先存（仅内存验证）；现有capture在内存构造后联合校验/CAS；原始模型与适配/首次/人工修订分别保留；主动事实核对、可控材料编辑、无日期确认和独立兄弟的内存闭环已运行。
- App增加了显式输入/事实纠错slot，并编写InputReview/FactCorrectionEditor/modelClient。新runtime、browser、launcher等9个获准路径尚未创建，所以不是可试用版。

## 分层数字（不同attempt不累计）

| 检查 | 结果 | 边界 |
|---|---|---|
| 旧凭据P1修前 | 18通过/6失败 | 假凭据，无真实泄露 |
| 修后预算+网关 | 52/52；独审另6探针 | 局部安全门 |
| 本机读取新旧测试 | 31/31（新8+旧23） | 依赖mock，不是实际OCR |
| 策略/纠错 | 15/15 | 中途版本；后续仅类型窄化及存储联动，不冒充最终全量 |
| 保存第一次 | 70通过/1失败 | 旧capture派生contentPreview的交接拒绝 |
| 保存第二次 | 71/71（新12+旧59） | 核心SHA仍一致，后加App/UI未验收 |
| app类型 | 最后一次PASS | 中途两次未接完错误原日志保留 |
| 新独审 | 1 P1、1 P2 | 整包阻断 |
| 完整工程/实际OCR/Edge/下载 | NOT_RUN | 没有过门或部署 |
| 模型识别准确率 | 本轮未测量 | 0调用、0模型网络、0元 |

旧MAINLINE05的59项断言原样运行；旧42/42、40/42、17和历史FAIL不改，不把本轮wire内存12项称为新路径42/42。真实用户修改时间与省时未测。

## 新P1：原文已经改了，旧建议却没过期

只用旧no-date匿名工程响应及内存原文变形，不建语义数据集：
1. saveReading→beginInputRun→completeInputRun，未确认正式任务为0。
2. 正常对照：明确核对save→确认，创建1项“保存活动手册”。
3. 反例：correctReadPage将已保存原文改成“此前保存通知已取消，请勿再保存。”；saveReadingCorrection成功。
4. isCurrentDraft仍true；再走公开核对和确认接口，仍创建1项“保存活动手册”。

这是**错误允许确认**，不是自动默认勾选或真实用户数据事故。独立审查发现后主代理用esbuild write:false和MemoryWorkspaceRecordStore复核；结果在logs/source-correction-p1-reproduction-attempt-1.log。没有浏览器/真实IndexedDB写入，报告里的“创建”指内存canonical。

根因：semanticRepository.saveReadingCorrection只更新Source读取记录；semanticState.isCurrentDraft只看currentVersionId和latest Run。已保存读取文字、实际发送范围、建议依据三者没有在原文更正后重新比较。模型不能替本机修这个状态错误，换模型或付费没有帮助。

最小后续方向：让已保存读取范围发生实际改变后，基于旧文字的未确认建议立即过期；显示、事实复核和提交都验证同一输入身份。已确认记录保留，旧原文/raw/first保留，正常未改变范围仍可确认；不靠禁止所有更正/全部拒绝过门。

## 普通P2：对象改了，标题还指向旧对象

独审纯内存探针：首建议对象/标题为“入场凭证”，用户把对象修成“活动报名表”，确认后title仍“提交入场凭证”，nextAction为“提交活动报名表”。主代理未再单独运行该探针。后续需区分首次标题与主动编辑标题，让失配明确可核对，不覆盖用户主动编辑，不用固定词句规则救分。

## 保护与现场

- 起点/实测远端：4d11737bc0fa38f5c4f67a205237531ae3b254a5；分支codex/e2-multimodal-recognition-exp。
- 已核946保护摘要匹配；前run16及continuation12共28静态证据未改。
- 原252816、前256271、本轮起始260128字节日志前缀匹配；本轮日志只追加。
- 13已有例外发生显式增量；19新路径已存在，9未创建。全部32现有实现SHA见IMPLEMENTATION_SNAPSHOT.json；P1后未改。
- Expected/freeze/dataset/checkpoint/cache/旧runner/result、全局Schema/repository/capture/validator/confirmationV2/domainCommit/AST/依赖未改。
- 不读密钥/剪贴板，无真实材料/真人/真实库/稳定入口/部署/RCO-6。
- 工作区逐字SHA与Git换行存储分开；不强推、不回切或自动变基。

## Git交付边界

仅提交本run审计、全部attempt日志、短交接和追加日志；**32业务实现不暂存**。最终精确提交/推送号以实际Git及交付答复为准。历史失败与本轮失败全部保留，不把报告交付当作产品完成。

## 唯一下一建议与可直接批准提示词

继续同一个MAINLINE-REAL-INPUT-01，明确授权修复p1-resume-20260907a已登记的“已保存原文纠错后旧建议仍可确认”P1及“对象纠正后默认标题失配”P2。先核最新审计Git/远端、IMPLEMENTATION_SNAPSHOT的32现有SHA与9未创建路径、946保护、前16+12证据和日志前缀，不回切、不重做PLAN/重复实现。保持41路径，优先semanticState/semanticRepository/semanticConfirmation/semanticView、factCorrections及现有获准新测试。先新增公开接口反例和正常对照，让已保存输入与本次发送/建议依据不同的未确认建议立即过期，显示/核对/提交一致；旧原文/raw/first和已确认任务不可覆盖，正常输入、有效兄弟和用户主动编辑标题保留。标题与动作对象失配明确核对，不写固定句子补丁。独审无阻断后同包继续剩余runtime/launcher、真实App、工程、Edge及下载读库；普通范围内缺陷不拆阶段。3.30滚动预留/24次10元/原模型参数/0 verifier Repair retry不变；首模型请求仍须全部发送安全门与输入候选评分绑定通过。新增重大安全/保护/范围/预算问题立即停。成功精确业务Git交付，失败审计保留现场；不读剪贴板/真实库，不接稳定入口、不部署。
