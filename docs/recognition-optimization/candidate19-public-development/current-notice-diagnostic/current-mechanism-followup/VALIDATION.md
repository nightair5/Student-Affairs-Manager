# 当前机制验证
2026-10-07。本轮代码7a155c9（动作/窗口与只读工具）、c708a3e（日期窗口安排）、73f94d0（恢复状态文案）已逐次提交立即普通推送。无新业务模型或账本写入。

| 检查 | 确定结局 |
|---|---|
| 当前机制事实及事务/独立读回反例 | PASS；自然压缩/展开范围、原时基/跨年、无效/倒序/歧义、错owner/类型、完整对象重复/部分重合；真实Schema进入普通产品链 |
| 最后产品定向 | 19/19 PASS、exit0；currentMechanism7 + personalPlanD27 12。此前20定向包含其余动作控制，PASS保留；没有套件排除/全局延时 |
| 全量权威入口 node scripts/candidate11-checks.mjs test | 全部独立组确定退出，整体exit1：当前产品9 PASS，当前安全24 PASS，历史3 PASS/6 FAIL；不是全绿 |
| c708日期安排改动后当前产品复验 | 9独立组全PASS，Vitest、Node、server、worker、worker-d26、functions等均退出；载入原匿名carrier环境，未把缺manifest误报产品根因 |
| 新四身份绑定/既有执行核心/只读reader | 12匿名Node反例PASS、exit0；无本批许可先拒绝，零env/新grant/发送；固定分母，争议不满分，状态不确定保留锁 |
| 最后lint/build/security:scan | exit0；lint0error/8既有warning；tsc/Vite PASS，旧>500k chunk提示保留；scan4564源/构建文件PASS |
| 真实页面 | 6875受影响完整路径，6876只改状态文案后新库对应回归；见BROWSER_EVIDENCE，不以单测替代浏览器 |
| 历史保护/链/封存 | 84保护119冻结7归档PASS；1015链与996/1000/1009原字节前缀PASS；16封存文件逐SHA全同；本轮前后账本SHA相同 |

全量六旧失败原样保留：
- d19-diagnostic、vitest-d17-history：D17_SCORE_LEDGER_DRIFT，旧静态账本快照与合法后续追加不兼容。
- d9-historical：D9_GUARD_FILE_DRIFT_scripts/serve-candidate15-d8.mjs。
- rco-5-007：FREEZE_HASH_MISMATCH:package-lock.json。
- c11-history、c11-gateway：C11_HISTORY_PROTECTED_CHANGED:AGENTS.md。
未改这些旧锁、冻结断言或文件凑绿。server本轮权威组PASS；历史随机bad port单列既有过程，不称当前失败。audit5H2M及production0是既有风险/未发布状态，本轮未重审或修复无关全仓。
八lintwarning为既有实验runtime的Fast Refresh及旧realInput01 effect引用，当前新代码没有新增warning。未把旧警告消失作为准确率门槛。

本地证据 .data/candidate11/checks/test/Asia-Shanghai/summary.json 保留全42分组日志索引。后续无相关代码改动不重复全部矩阵。最后状态文案改动不触及安全/保存算法，相应24安全组明确复用；薄绑定的新auth边界另有12 Node反例。
安全执行器没改，新增脚本只绑定独立四来源及普通回放；新身份NOT_RUN，原耗尽grant不调用。未运行真人、Holdout、默认替换、合并、部署，不读Secret/旧库，不加依赖/v8升级。模型原效果与程序兼容分列。

最终冻结：生成提交99424e33ced530bffc2a6c80908a35417d475b28，190组件/5产物/4身份。prepare-v5-current-notice --write/--verify及--report确定exit0；薄host --verify/--resume-read-only确定exit0；独立v5CurrentNoticeRecordedScene()返回0录制、NO_STATE、0本批链记录，无AUTH/lock/HALT。未调用prepare-authorized/dispatch-next。只读快照、原身份及全4UNKNOWN报告见v5-diagnostic；报告/申请不在5个原产物里，原冻结字节不改。
最终6876 GET /manifest.json=200且构建73f94d0dbf62/source d5a886e1ca34；POST /api/deepseek=403，服务器在任何非GET路由直接拒绝，模型调用0。本地原响应final-server-readonly.json位于.data/current-mechanism-followup，页面原DB未换身份。文档/冻结产物改动不影响产品bundle，明确复用上述最终浏览器及已通过矩阵，未循环重跑。
