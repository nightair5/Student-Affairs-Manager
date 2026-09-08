# RCO Current Context

## 当前目标与结论
- 同一MAINLINE-REAL-INPUT-01：明确任务、日期待定也能确认保存。
- D03真实App已主动确认；原9→10任务，保留双时间原文、无假日期/提醒。
- 0新增模型调用、0费用，不读取密钥/剪贴板，不改原32次/68行账本。
- 本轮提升承接确认成功率，不是模型首次识别准确率。
- 交付后停止，不自动增加候选、模型或数据。

## 仓库与授权
- 唯一C:\Users\Winner\student-affairs-multimodal-exp。
- 分支codex/e2-multimodal-recognition-exp。
- 实施起点3519b5760d6b795666d6502cf33c34c877142daf，本机/远端核验一致。
- 原46路径+明确第47例外src/pages/CalendarPage.tsx。
- 实际改11个源码/测试；来源逐字前后SHA见PENDING_TIME_CHECKS。
- 当前报告位于runs/candidate03-20260908a/PENDING_TIME_*。
- 最终业务/回执提交见PENDING_TIME_DELIVERY，不回切历史HEAD。
- 全局Schema/repository/capture/validator/confirmationV2/domainCommit/时间AST只读。
- MAINLINE04、候选、Expected、评分、原答、历史结果只读。

## 根因与实现
- D03描述含近期，模型结构化时间仅给具体截止时间另行通知。
- 已有转换没有丢该时间；旧客户端缺人工时间追加且整体阻挡确认。
- factCorrections允许逐字原文、不可变scope、唯一新ID绑定本任务追加时间。
- 不删除原时间，不改raw/first，不伪称模型输出。
- explicit accept_pending_date与事实核对/selected/正式确认分离。
- 仅real-input隔离状态可用；保存日期同意本身不建正式任务。
- 同意绑定完整事实及修改身份；相关事实修改后须重新同意/核对。
- 保留needsConfirmation=true、normalizedValue=null和原TIME_NEEDS_REVIEW事实。
- 冲突、非法时刻/日期、错误时区/归属/引用、条件修订依赖仍阻挡。
- 缺日期的时刻合法性使用内存探测值，不保存/显示探测日期。
- 现有CAS/联合全图校验及原子事务未替换。
- Calendar可选参数独立日期待定区域；真正无日期与明确日期旧默认保持。

## 实际浏览器验收
- 原origin http://127.0.0.1:6631。
- 原run real-input-d030c507-3f7c-4a2c-a511-8cd5bd534862。
- 原库rco-mainline-01-02-i1-real-input-d030c507-3f7c-4a2c-a511-8cd5bd534862。
- D03载入原回答前独立读库9任务，SHA与D01最终基准一致。
- 真实面板逐键输入近期；未保存状态加入任务禁用。
- 明确保存时间依据→接受日期待定→事实核对→主动勾选→确认。
- 新任务提交活动总结；原文近期/具体截止时间另行通知两条均保留。
- 两时间normalizedValue=null、precision=vague、needsConfirmation=true。
- 任务中心、日期待定日历区及详情均找到；不进入无截止列表或日期格。
- 用户执行手动恢复/报告刷新，代理完成后续查询与独立new repository读回。
- 重复D03载入前后全workspace相同，0重复/覆盖/丢失。
- 原9任务/旧Run/Draft/来源版本/时间/材料/依据/历史逐对象不变。
- 新增1任务/2时间/0材料；reminderRecords=0，实际jobs=0。
- 下载real-input-local-evidence (8).json，907297字节，真实文件未修改。
- 文件SHA 3db3fb699da45b6afaf66b194e49333413239de0d239cea4785493bf80877db8。
- 全对象SHA c45f55d098e8f31e02ca2ca7cf7ef4d5f629eda38e1763c9fce72195cccfcc91。
- 先取得UI独立仓储摘要，再核实际下载全对象，联合validator通过。
- 同网址旧控制与用户新标签不同；自动导航仍ERR_BLOCKED_BY_CLIENT。
- 重绑已恢复原标签成功；未改防护/系统设置，不宣称已定位具体扩展。

## 工程与保护
- 受影响21文件首次260通过1失败：旧启动器缺公开载体路径配置。
- 配置公开载体路径，原失败+最终3新测试重验4/0；旧断言不改。
- 按独立测试身份合并261通过、0未解决，不是一次全绿或累加attempt。
- 新测试覆盖日期真/无/待定、坏引用、冲突、条件/修订/依赖、回滚和重复。
- 最终App类型/受影响lint通过；Node类型、契约、安全、稳定build隔离通过。
- 框架envFile=false，env/cache/output均新临时目录，根.env不读。
- 一次确认策略针对性实现复核通过，不冒称独立第三方审查。
- 原945保护仅Calendar获准例外，其余944逐字SHA保持。
- 402旧证据、53原静态证据、日志追加边界保持。
- 旧日志按原READ_CLOSE_CHECKS逐字SHA核对，Git换行差异单列。
- 账本68行/51632字节不变，SHA如下。
- 00a339e7e7d80c7ea5b058fd41f2602a062c1a465421b39310fcccf0d6f96b57。

## 剩余边界
- 模型识别准确率本轮未测量；首次近期遗漏仍未修复。
- 真人主动编辑时间NOT_RUN；自动默认选择NOT_ENABLED。
- 正式任务后续补日期/执行/真实提醒/稳定导入仍需另行授权。
- 详情底部旧历史区与上方完整事实历史重复且文案滞后，未扩大页面范围。
- 不接真实用户库或稳定入口，不部署。
- 下一轮应按用户选择聚焦剩余首次识别或实际使用瓶颈，不自动开展。
