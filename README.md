# 学生事务管家

把老师消息、文件、截图和网页通知整理成可确认、可修改、可追溯的任务。

## 本地运行

```bash
npm install
npm run dev
```

浏览器访问终端显示的本地地址（默认 `http://localhost:4173`）。

## 验证

```bash
npm run lint
npm run test
npm run build
```

当前版本使用前端演示识别逻辑，不包含真实 OCR、邮件发送或微信授权。产品范围与开发约束见 [PRD.md](./PRD.md) 和 [AGENTS.md](./AGENTS.md)。
