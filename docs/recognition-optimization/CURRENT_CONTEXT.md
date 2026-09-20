# MAINLINE-REAL-INPUT-01 当前交接

## 当前结论
- 当前 6632 隔离库的真实保存、独立只读读回和双路径实际下载已收口。
- 用户实际下载的完整库与独立仓储证据内 workspace 逐对象完全相等。
- 当前正式对象为 4 tasks、5 materials、4 timePoints、3 sources、3 drafts、16 historyRecords。
- 5 份材料全部 required + unverified；未被猜成缺少、无需或已备齐。
- 独立读库 effects.writes=0，没有为取证写回数据库。

## 仓库
- 仓库：C:\Users\Winner\student-affairs-multimodal-exp。
- 分支：codex/e2-multimodal-recognition-exp。
- 本轮起点：00330d91f53503a07b6adf3eb21238a3dc3792a9。
- 起点本机与远端一致，工作区干净。
- 最终交付提交以当前分支远端 HEAD 为准。

## 基线与保护
- 基线：deepseek-flash + candidate03 + reasoning=none。
- 本轮新增模型调用 0 次；累计仍为 290 次。
- 原账本、候选、Expected、评分器、模型原答和历史结果未改。
- 产品源码、全局 Schema、正式仓储和确认规则未改。
- 未读取密钥、剪贴板、真实学生材料或浏览器个人资料。
- 未动生产入口、6631 或旧 HTTPS 入口。

## 实际文件 A
- 文件：mainline-real-input-01-workspace (11).json。
- 大小：393016 bytes。
- 原始 SHA256：7EA80DA638C379A986F66077EFEE22AEC2B9212FCC74D883793040AB038D16CC。
- Schema v8。
- workspace id：rco-mainline-01-02-i1-real-input-https-preview-1。
- savedAt：2026-09-13T14:27:36.528Z。

## 实际文件 B
- 文件：real-input-local-evidence (14).json。
- 大小：307607 bytes。
- 原始 SHA256：B49CA7D644CB7E7C58EF7D37F343893847CF4736946A869F4F17856620B1D452。
- 证据内 workspace SHA256：cc62dcd655603d2e7ff11b6b497d3da08899405bc7de982331362ed541a1a41a。
- writes=0、foreignDatabase=0、forbiddenNetwork=0、blockedDatabaseUpgrades=0。
- realJobs=0。

## 双路径一致性
- A 的完整 workspace 与 B.workspace 深度序列化后完全相等。
- tasks：4 / 4。
- materials：5 / 5。
- timePoints：4 / 4。
- sources：3 / 3。
- sourceVersions：3 / 3。
- recognitionRuns：3 / 3。
- extractionDrafts：3 / 3。
- historyRecords：16 / 16。
- 顶层 revisions：0 / 0，两个 workspace 均无该属性。

## 正式保存任务
- 填写送样登记单：2026年9月17日14:00前。
- 提交放映授权书：2026年9月23日16:00前。
- 上传预告片：2026年9月25日12:00前。
- 上传校样PDF：2026年9月24日10:00前。
- 旧寄送要求 task-old-mail-proof 不在 canonical tasks 中，没有生成待办。

## 材料
- 送样登记单：required + unverified。
- 放映授权书：required + unverified。
- 版权方邮件许可截图：required + unverified。
- 预告片：required + unverified。
- 校样PDF：required + unverified。
- unverified 只表示准备情况尚未核实。

## 替代关系边界
- 当前 workspace 没有顶层 revisions 集合。
- supersedes 仍保存在 source:09fec1bb:draft:1:1 的 rawResponse.revisions。
- 关系由 task-upload-proof-pdf 指向 task-old-mail-proof。
- 草稿核对与处置历史仍保留原回答上下文。
- 不能把该草稿关系称为顶层 revision 实体。

## 当前闭环状态
- 正式保存对象持久化：PASS。
- 独立 new repository 只读读回：PASS。
- 独立读库无写入：PASS。
- 完整库实际下载：PASS。
- 工程证据实际下载：PASS。
- 两实际文件业务对象一致：PASS。
- 本轮按要求未重复浏览器下载、连接诊断或交互旅程。

## 下一轮唯一优先
- 任务动作与材料要求边界，同时约束取消、替代和依赖目标必须存在。
- 已准备 6 份真正未派发的匿名通知和固定业务裁决。
- 状态仅为 PREPARED_NOT_DISPATCHED。
- 未创建新候选、未改 Expected、未派发模型请求。
- 未来最小范围：一个新候选及测试、runner 显式分流及测试、冻结材料只读装载。
- 预期减少删多余任务、补材料、重做材料归属和清理坏依赖/替代目标。
- 该预期尚未经新模型比较，不宣称已经改善首次准确率。

## 主报告
- mainline-real-input-01/runs/read-download-closeout-20260920a/AUDIT.md。
- 下一轮准备：同目录 NEXT_SCOPE.json。
