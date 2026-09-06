# MAINLINE05 实际 Edge 验收账本

结论：11条旅程PASS，J03 PARTIAL（不同实际浏览器时区NOT_RUN），整包NOT_COMPLETE。不是模型实验、未测真人时间，不把31项重复工程操作产物当31份独立样本。

## 身份与证据链

- 恢复HEAD及远端：f5410d6c88ab1dfa4b90ae4346ea0b257f13ca3b。
- 正式CUA Edge：主标签763114631，过期对照标签763114632。
- 全程origin http://127.0.0.1:6627；唯一库 rco-mainline-01-02-i1-mainline05-688bf3e0-6e60-449a-acec-01a11d1fdfc4。
- 首次空库独立读回sources/tasks均0。录入只用旧8类匿名人工工程通知和已登记关系内存变形；不预置已确认任务。
- 3次获审查/完整工程候选先后在同origin内存构建，刷新沿原run，未访问新启动输出的new=1 URL、未清库。
- 最终26路径数组SHA：2c9fb255df8b9baaf240ee7c443f10654a1e7b7b7560bca0a37669dd7ab5c3d5，逐项见browser.json。
- 首轮原26审查/full-a为07906b…；3项普通浏览器修补后审查/full-b为a14e35…；最终仅工程回放/菜单及3项正反测试增量，23文件未变，最终审查/full-c通过。
- 未变核心流程按SHA复用实际观察；变化的批量提示、工程读库/下载、共享事件与取消菜单已重验。历史NOT_RUN/失败报告不改写。
- 录入通知使用粘贴式fill；名称/时间用户编辑使用pressSequentially和Backspace，未用fill冒充逐键编辑。

## J01–J12

下表source后缀均为实际Source ID，完整Draft ID为source:后缀:draft:1；可在实际下载文件逐对象核查。行为观察来自同任务CUA工具记录，最终状态另经新repository读取，不仅是toast。

|旅程|结果|实际操作和证据|
|---|---|---|
|J01|PASS|285a6d67首页multi来源先存，关闭/刷新/收件箱恢复前sources/runs/drafts各1、tasks0；真实面板两项一次批量成功，完整材料/时间入库。统一录入另由7fe0f66a完成；后续多次部分确认也真实成功。|
|J02|PASS|7fe0f66a原无日期不编辑即确认；刷新后任务中心、首页、详情、日历独立列表找到；不填假日期。最终7项真正无日期任务全部0关联时间/0提醒，实际buildBrowserReminderJobs结果0；仅开始/事件另行分类，不称无时间。|
|J03|PARTIAL|905c99ad仅planned_start保存不变截止；86657a28逐键补2026-09-08，日历对应日“仅日期”且没有18:00。Asia/Shanghai显示/保存一致。实际不同浏览器时区NOT_RUN：正式工具仅viewport，无timezone覆盖；人工Sensors请求未获回复。Node双时区测试仅工程证据。|
|J04|PASS|057877e5模糊时间待核对不当无日期；3f92f71e坏scope只挡受影响项，独立print可确认；fa33597e悬空引用明确MAINLINE05_INVALID_ENTITY_REFERENCE，保留Source/failed Run/Draft/result=null，不新增正式任务。|
|J05|PASS|bf8cca4c条件真可确认；d3d0b948条件假、52b8561a条件未知均不默认选、强行选择无效、确认禁用；显式暂缓可保存，刷新保留false/unknown与原文，未混同。|
|J06|PASS|8bf44f20旧作废不选、新要求确认，旧依据仍在。de5523c9完整纯信息明确review_info，0任务/项目；ecd7130a有UNACCOUNTED_SOURCE_SCOPE不能标完整，保持needs_review。最终e2190b2e取消无替代关系cancels/fromDirectiveId=null，明确reject旧项后正常确认独立新事项，原文/旧项/关系保留。|
|J07|PASS|7aa05950材料关联事件，预览1事件→批量确认→实际日历/事件详情。最终a6735f0a共享事件：先submit、读库29任务/事件新建1，刷新恢复print再确认；同一事件/时间仅一份，两个已确认owner完整保留。实际日历9月10日及事件详情显示两任务事实、18:00 Asia/Shanghai；location=null显示未提供，不声称测过真实非空地点。|
|J08|PASS|86657a28名称逐键加“逐键验收X”再退格，显式保存；无日期逐键补日。66999e68普通截止逐键2026-09-12T09:30、退格再1，未保存禁止确认，保存后批量确认；canonical实际09:31/Asia/Shanghai，原始/first仍9月10日18:00，edit.before/after完整。planned_start/事件/共享时刻编辑保存前明确拒绝；不新增这类编辑能力。|
|J09|PASS|shared-material 5a6d1e9a顺序/87887063反序/8be07137同批，材料只有1份、deadline始终null、未补造material-time边；明确原有材料截止正例保留。共享事件另有a6735f0a。独立兄弟与必须依赖不同处理。|
|J10|PASS|86657a28注入保存故障无历史落地；成功保存两次编辑后注入确认故障，独立读库整对象与故障前完全相同（正式tasks仍3、编辑仍2），随后重试成功。3ee414c1两Edge标签：A逐键编辑保存、B旧版本确认拒绝MAINLINE05_STALE_RELOAD_REQUIRED；B刷新恢复正确名称再确认；A旧/重复确认未增项，最终该来源恰1任务、edit+confirm各1。|
|J11|PASS|实际收件箱多草稿批量，4d0258c5与af35fdc7先观测一失败一成功但短ID同为:draft:1；范围内App提示修复成完整draftId。重验ddcc1158故障、4d0258c5成功2项，提示逐来源明确区分；失败项随后单独成功。不是跨草稿全局事务，单草稿内部原子。|
|J12|PASS|实际产品JSON文件1260173字节，与工程按钮新repository独立读回的另一实际下载文件全对象一致，联合v8/扩展校验通过；最终刷新再次独立读取全对象不变。稳定默认/原V2以适用工程门核验，非生产浏览器验收；当前副作用记录0网络/旧localStorage/通知与真实库访问。|

## S01–S03与非零正常对照

- S01：0df499f8取消前置checkbox后两项均false，重选前置后两项true；暂缓前置后两项false，用户主动重选可同批确认。de1c6ab3拒绝前置，后项不保持错误默认选/不能确认。ae7acd75前置先确认、剩余后项正常确认。没有全部拒绝过门。
- S02：de5523c9完整纯信息可核对；ecd7130a未覆盖信息仍待核对，不能由空tasks或人工已读冒充完整。
- S03：顺序、反序、同批共享材料保存后业务字段含义未被后项改写。只增加明确关系端点；updatedAt可因事务变化，不等同原始业务字段变化。
- 本轮实际操作和定向检查中，新错误默认选/未确认正式任务/意外重复/覆盖/丢失/假日期/假提醒观测值均0。仅此受测范围，不宣称对任意真实材料为0。
- 旧42字段口径在真实V2内存路径保持42/42；新语义全字段/关系以定向保真与联合全图验证及实际文件全对象一致性证明，不把它冒称模型正确率42/42。

## 真实文件，不是页面文本替代

- 产品文件：C:\Users\Winner\Downloads\mainline-05-workspace (1).json。
- 1260173字节，文件SHA e9fcf0f9481e9f1b70a2e6325448317fec3be78598ab3ac792870294a253dbc3。
- 独立读库文件：C:\Users\Winner\Downloads\mainline-05-independent-read (1).json，844873字节；不是调用App的exportJson。
- 原始独立read日志：2026-09-06T12:07:47.341Z，MAINLINE05_INDEPENDENT_READ；方法 new CanonicalWorkspaceRepository(new IsolatedTestStore(name)).load()。
- 独立按钮下载日志12:08:14.856Z，随后点击App完整导出；两份实际文件存在。只将独立文件逐字复制到已登记临时目录供checker读取，原文件不改。
- 全对象JSON.stringify SHA均03e308722c052a4e8e14b0bbe90382c851082664baaba78c8241d5a6b2ee8a9a。download.json记录独立全对象比较及联合validator，不是对单个文件自算两遍。
- 12:09:47.215Z最终真实刷新后再次new repository.load()，全对象与上述原读回完全相同，31任务/27来源/2事件/24时间/0提醒。
- 实际jobs探针0；7无日期任务均0时间/提醒。副作用记录是每次页面生命周期的本机探针，不冒充完整浏览器网络抓包或后台遥测。
- 早先26任务两份下载文件仍保留（无(1)后缀）；监听超时没有证明产品下载失败，不能删除或改写旧观察。
- B8-01/07/09工具实际只读显示3条NOT_EXPRESSIBLE，原始候选保留；不新增Source/任务、不改历史FAIL、不算模型新测试。

## 最小缺口与交付边界

不同实际Edge时区仍未执行；J03及整包不能PASS，不能用工程1117通过替代。已向用户请求仅在本测试标签DevTools Sensors切换America/Los_Angeles，不改Windows系统/其他用户标签。现有正式工具缺这项能力，不能用未获准CDP、伪造时区DOM或Node SSR代替。

本轮代码不再增加语义规则；等待这一个环境验收证据。若无额外可用实际环境，按用户边界只提交审计，26实现保留本机未提交。正式任务执行/ICS/真实提醒、稳定接入、图片文件提取与付费模型、真人省时仍不在本包。模型识别准确率：本轮未测量。
