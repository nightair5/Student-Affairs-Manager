# MAINLINE05 独立复核：范围阻碍，不是全包批准

审查者：`/root/mainline05_dependency_scope_review`。无历史上下文，只读当前PLAN、白名单和失败相关接口；未修改文件。审查绑定IMPLEMENTATION_SNAPSHOT.json中05源码/测试，以及IMPLEMENTATION_BASELINE.json所引用的MAINLINE04快照。完整实现审查仍NOT_RUN。

这是业务闭环阻碍，不是无效测试。PLAN第3.4节允许依赖先确认或同批确认；新增依赖是工程内存变形，不证明原通知或模型表达了依赖。

根因：mainline04/semanticComposer.ts:109–130沿依赖遍历到前置任务私有时间，误报MULTIPLE_DEADLINES；mainline05/semanticState.ts:75–79要求首次问题为空，因此同批仍拒绝。调整报错顺序只能改善提示，不能解决提交。

现范围内没有满足全部约束的放行解法。PLAN第6节禁止新确认层绕过问题项；即使保留first，另算资格并忽略该问题也实质改写冻结判断。

最小追加授权：仅增加semanticComposer.ts这一保护例外，允许05显式启用“资产归属与依赖安全传播分离”的结构修正；旧默认、历史和其余七文件不动。回归放现有获批05测试，保留当前失败断言，验证自身多截止、坏依赖、循环仍拒绝。

独立定向实跑16过/1失败；普通双任务部分/批量、真条件、新要求及两种顺序共享材料均有成功对照。不作全包PASS结论。
