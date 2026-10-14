# 导出阻碍只读审查

审查者/root/i1_fresh_review，未改代码、未控制浏览器、未调用模型。
结论：静态未定位确定根因；JSON下载仍未验收。

App.tsx:1410先异步读取canonical，再对未挂入DOM的链接调用click，并立即撤销Blob URL。立即撤销是待验证时序风险；现有WorkspaceControls.tsx:18–25也同样写，不能据此断言根因。Obsidian导出延后撤销。
runtime.ts:75只读指定库并序列化，未见旧库或网络旁路。异常会在App显示，但performExperiment前置守卫可静默返回。
建议核对下载监听先于点击、current读取是否增长、busy是否解除、Blob创建/点击/撤销实际路径；两次超时与Downloads无文件不能证明IAB限制或下载成功。

主代理补证：读取18→导出→证据读取→21，按钮恢复可用，无JS对话框、无console错误；已排除“完全没有进入读取”的解释，未证实下载完成。未擅自改源码或归咎浏览器。
