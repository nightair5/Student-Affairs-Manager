# 验证与真实限制
2026-10-07。代码/测试/命令均在candidate11工作区；模型请求只来自独立授权的4身份，测试与浏览器不派发。没有修改依赖/lock/Workspace v8/冻结或旧断言。

| 入口 | 确定退出结果 | 解释 |
|---|---|---|
| 5个定向Vitest文件：authoritySupportContext/authorityEndpointComposition/singleAuthorityProduct/sourceReviewD26/semanticFixtureContract | 26 PASS，exit0，最终1.4.0后运行 | 两对象支持、日期clock二次组装、负owner/引用/缺端点、真实capture及原子保存/独立读回 |
| npm run lint | exit0，0error/8既有warning | 无新增lint warning |
| npm run build | exit0 | 保留既有大chunk提示，不加依赖 |
| npm run test（权威carrier入口） | exit1：产品9、安全24、历史3 PASS；历史6 FAIL | 全量到确定退出，不排除失败，不称全绿 |
| 最终代码后npm run test:product | 产品9组全部exit0 | 包含Vitest、contract/time、server、worker/D26worker、functions/time parity；最终源变更后复跑当前产品，未受影响安全组复用本轮24PASS |
| 原v5-current-notice.node-test + observed reader直接现场运行 | 6PASS/1FAIL | 原“未授权AUTH不存在”断言在合法已授权现场不成立，是调用前状态假设；不删除真实AUTH/raw/state或改旧断言凑绿 |
| 新v5-current-notice-isolated-preauthorization.node-test | wrapper1PASS，原未改preauth3PASS，exit0 | 全新OS临时目录，公共scripts源码/carrier，空.data；不读当前AUTH/旧库，显式继承Node路径环境且去除外层NODE_TEST_CONTEXT，child真实3测试退出，不接受零测试假绿 |
| 原4录制只读read-only scene及诊断 | CONSISTENT，4SETTLED/0UNCERTAIN | 原Git blobs/5产物4身份/rawSHA/receipt/usage/完整链；不调用mutation |
| 最终历史保护 | 84protected/119frozen/7archives，exit0 | HISTORY_PRESERVED_LEDGER_APPEND_REVIEW_REQUIRED；授权9追加单列，历史没改 |
| 最终security:scan/封存16文件/账本前缀/模型403 | 见FINAL_READ_ONLY_SCENE.json及EVIDENCE_INDEX | 合法追加不伪装账本零改变；无秘密原件入Git |
| 官方浏览器最终6880 | 首屏/部分/局部风险/三故障/刷新/独立值PASS，console[] | 具体步骤及过程失效尝试见BROWSER_EVIDENCE，非仅单测 |

六历史组为d19-diagnostic、d9-historical、rco-5-007、c11-history、c11-gateway、vitest-d17-history。D17账本快照及D9/RCO-5-007/C11冻结哈希旧断言保留，未改锁/Expected/raw/分数/Manifest凑绿。当前server没有复现旧随机bad port。已有audit5H2M、production0仅历史风险记录，本包未重新全仓审计或宣称修清。

计量仍measurement3.2/low-edit-v2：canonical两个partial单列，不把旧ordinary.partial=false当终态；真实02和日期夹具无字段edit，不造editId；坏owner选择2episode不计语义字段纠正。正式失败/读回失败保留failure trace，检查点错误页面/历史另证；刷新/未闭合/缺终态时间null，不填0或估省时。四真人NOT_OBSERVABLE。

当前工程可提交、可独立revert；既成4次外部请求及账本真实追加不能通过代码revert抹去。完整首答仍0份已确认正确、3错误1UNKNOWN，不能以26测试或1份解码宣称准确率提高/默认替换/上线。
