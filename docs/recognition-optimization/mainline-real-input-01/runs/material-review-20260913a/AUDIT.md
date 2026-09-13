# 材料准备情况尚未核实：公开接口复现与最小范围申请

状态：SCOPE_BLOCKED，诊断完成，功能未实现。0模型、0费用、0浏览器控制、0部署、0业务源码变化。原7未提交业务文件原字节保持。

## 现场和实际阻碍

起点本机/远端715252940bf48cd90817941ccdebb9fc82d2dc1e。60源码、944保护、607旧静态、18冻结闭包及上轮90项证据逐字匹配。账本264行/128请求完全不变，原日志前缀另绑定于CHECKS。

不是用户未找到按钮，也不是模型或浏览器问题：

1. FactCorrectionEditor中“尚未核实，请主动选择”是value为空的占位项；保存按钮要求非空，不是可保存状态。
2. factCorrections.MaterialDecision直接复用全局MaterialStatus，validateMaterialDecision拒绝unverified。
3. semanticState.projectCanonical必须将每份正式材料写入WorkspaceV8.materials，每份材料status必填。已有默认missing/not_required不能代替未知。
4. CanonicalWorkspaceRepository保存/读回使用全局shapeValidator；它只接受六个旧状态，直接拒绝unverified。仅修改实验范围内代码不能通过合法仓储保存。
5. legacyView向旧React类型直接投影status；详情select没有未知选项，材料历史标签表也没有该值。只改两个全局存储文件仍不能完整显示。
6. taskLogic的项目材料统计以total-ready计算missing，新状态若原样传入会被误算为缺少；必须仅为该新状态排除误报，旧六状态行为保持。

因此此前建议低估了全局枚举限制。本次先证实，不以类型断言、删除材料、兼容字段掩盖missing或绕过仓储来实现。

## 零调用公开接口反例与正常对照

命令：node docs/recognition-optimization/mainline-real-input-01/runs/material-review-20260913a/REPRO.mjs。
脚本只使用esbuild的write:false内存编译和MemoryWorkspaceRecordStore；不使用Vite/Vitest，不加载.env、不读取密钥、不访问实际浏览器库。结果REPRO.json绑定依赖。

- 必需性已知、status=unverified：REAL_INPUT_CORRECTION_MATERIAL_DECISION。
- 必需性为null、status=ready：仍拒绝；不知道是否需要与不知道是否备齐不能混同。
- 六个旧材料状态均通过原接口与shape检查。
- 正确材料只将ready改成unverified：全局校验INVALID_ENUM:materials[0].status；真实CanonicalWorkspaceRepository.save报WORKSPACE_V8_INVALID，同一个内存记录未被覆盖。
- 真实R11-07历史原答进入现有HTTPS回放公开接口后，reviewSemanticMaterial同样拒绝unverified，工作区逐对象未变。
- 明确模拟用户选择ready的正常对照可以确认“填写送样登记单”1项；独立new SemanticRepository内存读回一致，原回答保持。这是模拟对照，不是实际用户材料已齐备或HTTPS验收。

这些检查证明当前不能承接新状态，不标记功能PASS。没有新增或弱化旧测试/Expected。

## 一次性最小例外申请（均未修改）

保留原实验文件职责；另请求以下六个受保护文件的限定增量，详见NEXT_SCOPE.json：

| 文件 | 必要职责 |
|---|---|
| src/domain/v2/types.ts | 正式材料类型承接显式实验unverified，不把未知伪装成六个旧状态 |
| src/domain/v2/validators/shapeValidator.ts | 仅显式版本化real-input隔离库和材料核对标记允许新状态；普通工作区继续拒绝，旧规则保留 |
| src/types.ts | 旧React兼容视图无损传递unverified；不为普通默认录入开放新选择 |
| src/components/TaskDetailPanel.tsx | 仅实验只读详情中的未知材料显示“准备情况尚未核实”，防止select空白；旧默认选项不变 |
| src/lib/taskUpdates.ts | 新状态的材料历史文本可读，不输出undefined，旧标签不变 |
| src/lib/taskLogic.ts | 新状态不当成ready，也不被total-ready误算为missing；保留旧六状态统计规则 |

新状态仅进入新显式实验核对操作，原已确认实体和旧数据库不迁移/重写；旧应用版本对新实验数据拒绝而非假装兼容。核对操作必须绑定来源与材料身份并可追溯。全局repository/capture/domainCommit/confirmationV2/时间AST继续只读。不得仅依赖一个可伪造的标记绕过校验，实验语义仓储仍须验证完整操作链和确认事实。

以上六文件是类型、存储与现有展示链的最小完整接线申请，不授权执行、提醒、项目管理或通用纠错框架扩建。新版本范围与旧规则回归放原获准实验测试。未批准前停止产品修改与部署，安全只读分析和审计交付继续。

## 下一次识别优化定位

ROOT_TRACE逐一绑定4份材料×03/06/07共12个历史响应；06是旧批次，仅作已见诊断，不是本轮同期比较。12/12任务、材料、修订字段从模型原答到RESULT保持相同；原文完全一致，原评分不改。

| 代表问题 | 已证实的位置 | 对用户的影响 |
|---|---|---|
| R11/Q11材料说明多拆任务 | 03/06原答已有额外密封袋任务；07原答删除该多余项，非转换层删除 | 用户需删多余任务、核对袋归属 |
| R03/Q03保存对象变材料 | 03原答无材料，06/07原答直接多出原始照片材料 | 引入不必要的材料核对，非原文要求额外准备 |
| R10/Q10材料与任务归属正常 | 三路线都保留两任务、各自表格与照片/收据；解析未丢 | 不应为减少材料数量而删除正确交付规格或关联 |
| R11登记单共享与独立动作 | 填写登记单是明确动作，同时作为送样附件有依据 | 不能把任务产物一律删除为“重复材料” |
| R12/Q12明确制作正常对照 | 三路线均保留明确制作展签；06/07另漏旧取消实体，原答已错 | 保留真实制作义务，不以动作词黑名单去任务；取消问题单列 |

模型wire没有准备状态，所以材料是否已准备好不是可从当前输出可靠推断的事实；本轮不能把required当可用性。当前占位选项＋全局枚举是额外产品阻碍，与模型多造材料是两个层次。

下一轮唯一优先改动：先完成显式实验“准备情况尚未核实”的无损存储与显示，减少额外核对阻塞；它不需要新模型调用，不能宣称首次准确率提高。现有事实表证明同一wire能表达正确任务/附属材料关系，目前没有证据支持必须新建wire或继续追加同义Prompt；暂不建议再开付费批次。真正修改识别策略后，才需要新的有效比较证明收益。

## 本轮实际交付与缺项

用户新能力：尚未交付，受只读类型/校验边界阻挡。真实R11/R12确认、刷新、IndexedDB读回和下载均NOT_RUN；控制无恢复消息，本轮0尝试，未继续让用户刷新。R12既有坏引用/时间覆盖限制保持；原Q01/Q07正常旅程证据未重复运行。

产品源码未变，不跑全量工程、不重新构建或部署；上轮已验证工程仅按SHA复用，不当成新功能通过。测试构建根.env未读取。当前HTTPS保持原版本e07c1a4a-97a8-4c6e-85c5-3fdd10b06cce（本轮未在线重验）；模型关闭。开发依赖历史风险未修。

本轮仅精确提交复现、范围申请、审计、短交接及追加日志；7业务文件保留。实际提交与远端核验见DELIVERY.json，不强推、不自动变基。等待六文件例外批准后继续同一包，不重做PLAN、不重复模型比较。
