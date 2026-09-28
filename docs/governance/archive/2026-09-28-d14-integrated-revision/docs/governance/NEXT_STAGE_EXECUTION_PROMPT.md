# 下一阶段：D14 精确授权准备与探索试次接口

本提示词不授权模型调用、真人招募/试用或发布。已执行的 D13 提示词保存在 [原字节存档](archive/2026-09-28-d13/docs/governance/NEXT_STAGE_EXECUTION_PROMPT.md)。用户要求执行下面工作时，连续完成本地部分，不逐个小步骤询问。

~~~text
继续“学生事务管家”识别优化独立支线，执行 D14 的零调用部分。
工作区：C:\Users\Winner\.codex\worktrees\student-affairs-candidate11\比赛
分支：codex/e2-candidate11-blind-eval

目标：把已有D13成果推进到“用户可审查具体调用金额”和“真实探索可用的空试次入口”，不重新造候选、重算相同诊断或重造Development。

先读AGENTS、PRD、CURRENT_CONTEXT、PROGRESS_POLICY、PROJECT_EXECUTION_ROADMAP和candidate16/d13-development的D13_RESULTS、VALIDATION、BROWSER_EVIDENCE、Manifest、预注册、预算卡及探索协议。
核HEAD/工作区/upstream/远端，保留用户改动。运行prepare-candidate16-d13.mjs --verify与verify-recognition-history.mjs --verify。D11拒绝、D13冻结包和账本保持只读。

一、只读做成具体的24次预算申请
- 官方核验deepseek-flash当前路由、上下文/输出限额、峰时价格、缓存/推理/其他计费规则，保留日期及一手链接。
- 用24请求的可证明token边界计算最坏费用；字节不是token，估计不是硬上界。证明不了就具体列缺口。
- 生成独立D14预算卡，绑定D13 Manifest和24身份SHA、模型/参数、最坏费用与建议上限；不改D13旧卡或身份。
- 不做连通性探测、不读Secret、不创建grant/reserve/settle、不写账本、不发送模型请求。执行器可本地编写/测试但默认阻断；付费执行须用户看过金额后另行授权。

二、接入正式探索的空试次入口
- 复用D13字段/commit/readback计时逻辑；新trialId和新隔离库，不把工程记录变成真人记录。
- 实现空白手动录入、固定辅助条件、开始/暂停/退出/恢复；确认后保存并独立读回，缺失与失败不填0。
- 固定建议4人×4条平衡排程、材料SHA、辅助输出来源、低修改探索阈值；同一人不重复同一通知的两条件。
- 准备真实负责人/同意/争议裁决空字段。无人时保持NOT_RUN，不生成签名、耗时或正确率。
- 用匿名工具试次验收页面和失败恢复，明确ENGINEERING；新端口不接管旧服务。接口准备不是已开始真人试用。

三、收敛质量与交付
- 只处理妨碍两个交付的问题；D13旧评分/结果不改。v7有限别名、标题/描述与泄漏人工审核缺口写清。
- 维护旧测试先定位等待/启动条件，另建边界，不改历史锁、Expected、断言或提高全局超时伪造绿灯。
- 定向先行，产品改动在边界跑lint/test/build、相关安全/隔离和实际浏览器；已有失败单列。
- 更新短交接、结果、跟踪，Conventional Commit后立即推送并核HEAD/upstream/远端。

禁止新业务调用、grant/reserve/settle、真人招募/试用、默认替换、合并、部署、新依赖或Schema升级。
最终交付：有依据的预算卡、空试次入口/材料、测试/浏览器/保护/Git证据、还需提供的负责人及具体授权。
停止在“调用金额和探索入口可审查，等待对应授权”；若某项受阻，只列该项，不抹去其他已验收成果。
~~~

若用户优先选择调用，可仅执行预算卡并交付具体金额；收到明确模型/次数/费用授权后再执行冻结比较，不被真人接口拖住。真人探索同样可以独立申请，不依赖候选比较获胜。
