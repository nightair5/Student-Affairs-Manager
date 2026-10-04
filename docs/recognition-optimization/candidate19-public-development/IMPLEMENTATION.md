# 唯一产品根因与实现

原文来自学院官方交流通知，见PROVENANCE第2项；输入是记录了边界和匿名化的操作摘录，非整篇通知。工程wire明确标ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT，原模型在这四份来源上未运行。ROOT_CAUSE保留原文、wire、旧1.2.0和新1.3.0审计；旧代码由Git起点原字节编译执行，不用手写旧行为模拟。

| 层 | 实际路径和行为 |
|---|---|
| Prompt / wire | 旧Candidate19/source-contract-v4未改；工程wire有3种同任务材料及其原有渠道，condition unknown。 |
| decode | conditionalNonActionProduct → SourceContract真实Schema及compiler；主任务、附属材料、deadline均有真实scope/owner。 |
| 公共转换 | materialChannelGrounding.destinationRole、groundMaterialChannels；1.2.0前两个UNSUPPORTED，1.3.0全部EXPLICIT_CHANNEL。 |
| 约束 | 有界并列成员必须是已声明、双向归属同一任务的材料；允许括号格式说明，但不删除括号中的否定/条件判断。前缀子串、外对象、开放列表、否定/条件、矛盾继续受阻。 |
| 首次页面 | 现有App/DraftReviewPanel材料与办结标准区域；没有额外强制渠道补录；个人意向仍unknown。 |
| 保存与安排 | ReviewSession/sourceReviewD26/DomainCommitPlan/CanonicalRepository；暂停事件、原C19材料/截止及依赖实际保存读回。有意向未知工程来源只保留草稿，不猜符合；D27个人安排和原截止仍分开。 |

src/recognition/publicNoticeChannels.test.ts：真实公开工程wire+6种最小语义变体+真实保存读回8项；既有渠道42项同时通过。不同合法材料集合/顺序必须仍有原文依据，不做无据集合扩展或对候选特判。真实交换工程夹具的构造错误（effect枚举、使用时间值scope、模拟usage形状）在接入前修正，均不宣称第二产品根因。

新增publicNotices仅包含4份匿名官网摘录、出处和provisional最小事实，两个工程wire供页面。serve-candidate19-recorded新增--public-notice-fixtures，仍用普通App和旧12readonly录制；回环服务器只GET静态文件，/api/deepseek GET/POST及同步均403。

新来源单臂包装复用createScopedEngine/createScopedHost，count=4已实测，严格ordinal/一次发送/锁/持久send状态/唯一grant/不确定封存等实现未复制重建。脚本public-notice-execution-host只有未来本批AUTHORIZATION通过后才允许读取服务端配置；本轮仅verify和resume-read-only，无Secret读取、grant或发送。原授权与PRICE原件将仅留本机.data。

逐事实新诊断规则public-source-fact-adjudication-1.0.0：对原答、人工前展示、人工最终分层；值/对象/时间类型和精度/材料/条件/关系/标题描述及额外义务逐项source-based暂定裁决。每项须给原文对比理由和输出位置；缺失、重复或未决不满分，错误不被其他正确字段抵消。无损材料视图/任务合并不按数量判分。不是独立人工真值，不修改v11。没有新输出，所有新模型结论NOT_RUN。
