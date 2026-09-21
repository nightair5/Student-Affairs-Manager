# Candidate12 D1 临时 Development 配对准备计划

版本：`c12-plan-0.7-d1-provisional-paired`。状态：`D1_PROVISIONAL_DEVELOPMENT_IDENTITIES_READY_FOR_AUTHORIZATION`。

本阶段只把C2的12份已见合成来源形成candidate03/Candidate12的24个零调用配对身份，不发送请求。数据继续标记为`SEEN_SYNTHETIC_DEVELOPMENT / PROVISIONAL_MODEL_AUTHORED`，独立Holdout资格为false，结论上限为`ENGINEERING_SCREENING_ONLY`。

执行边界：

1. 来源与Expected物理分离，请求只从来源构造；Expected变更不得影响request SHA。
2. A=candidate03、B=Candidate12；模型、temperature、reasoning、Schema、scorer、adapter、referenceTime、timezone和输出上限固定。
3. PD01起A→B/B→A交替，24个身份全部`dispatchAuthorized=false / NOT_RUN`。
4. runner在Secret、预算、账本writer和网络组件存在前拒绝无授权派发。
5. 未来调用需要新的24次、¥51.904512最坏上限和唯一权威账本writer明确授权；本阶段不创建grant/reserve/settle/receipt。
6. 即使未来工程筛选通过，也只能进入独立人工Holdout，不能据此宣布Candidate12晋级或提高真实转化率。

正式Holdout仍等待两位不同真实人员完成12份全新密封来源与Expected。
