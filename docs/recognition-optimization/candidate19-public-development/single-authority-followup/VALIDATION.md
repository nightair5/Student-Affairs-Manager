# 实现交付验证

2026-10-06。最终浏览器证据另见本目录BROWSER_EVIDENCE.md；本记录不将过程证据冒充最终构建。

| 检查 | 结果与范围 |
|---|---|
| 定向Vitest | 39PASS：V5契约21、事件选择/共享事务5、窗口安排1、原D27安排12。含真实Schema→普通解码→正式仓储、错owner、缺事实、字段版本和共享读回反例 |
| 新比较/许可工具Node | 3PASS：8身份、请求无Expected/dispatch关闭、固定分母未知保留、无授权不能进入账本/发送 |
| 权威npm run test | 41独立组确定退出：35PASS、6历史FAIL、0工具不可用；新增Node组另跑，总36/42组PASS，6历史FAIL |
| 产品最终回归 | 9独立组全部PASS，server/worker/functions确定退出；最后解码provenance小改由39定向覆盖，无疑点不再循环无关历史矩阵 |
| lint | 0error，8旧warning；本轮无新增warning |
| build | PASS；旧bundle体积提示保留 |
| security:scan | PASS，4482 source/build文件；没有新依赖、schema或锁修改 |
| 原13录制 | verify PASS，逐份firstFacts相同，转换审计版本化；原4诊断2可解码/2仍拒绝，原成绩不改 |
| 历史及账本 | 84保护/119冻结/7归档PASS；1009完整链及996/1000前缀不变，SHA c730854da5eabbef8c6c62d1da2dea6511ecf2f586fa9872fd2c9b4a1baa140f；本包模型/grant/reserve/settle0 |

六历史失败：d19与vitest-d17的D17_SCORE_LEDGER_DRIFT；d9旧serve-candidate15-d8 guard哈希；RCO-5-007旧package-lock冻结哈希；c11-history/c11-gateway旧AGENTS哈希。没有改旧Expected、锁、断言或排除套件凑绿。旧audit5H2M/production0在依赖无变更下明确复用，未称全绿或上线。

本机日志：`.data/single-authority-tests.log`、`single-authority-product-final.log`、`single-authority-targeted-final.log`、`single-authority-lint-final.log`、`single-authority-build-final.log`、`single-authority-security-final.log`与`single-authority-history-after.log`。日志不进入Git，最终证据索引保存hash。

未测试：新付费V5真实输出、真人四指标、独立Holdout、默认替换、线上速度和部署。付费工具仅测安全拒绝和只读绑定，真实transport未调用。新输出NOT_RUN，不能从夹具/测试数量推算首次模型正确率。
