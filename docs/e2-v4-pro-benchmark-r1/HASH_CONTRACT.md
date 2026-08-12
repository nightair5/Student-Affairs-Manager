# E2.9-R1 Bundle Hash Contract

实现：`scripts/e2-9-r1-hash.mjs`；测试：`scripts/e2-9-r1-protocol.node.mjs`。

1. 输入路径先把 `\\` 统一为 `/`，再按 JavaScript UTF-16 code-unit 升序。
2. 文件按 UTF-8 解码；CRLF 与 CR 统一为 LF。
3. `.json` 解析后递归排序对象 key；数组保持原序；输出无无意义空白。
4. 每个输入构造：`<pathUtf8Bytes>:<path>\n<contentUtf8Bytes>:<canonicalContent>`。
5. 各项使用 `\n--E2-9-R1-BUNDLE-ENTRY--\n` 连接。
6. 对最终 UTF-8 字节串计算 SHA-256。

`bundle-hash-manifest.json` 明确列出每个 bundle 的输入文件、单文件 canonical SHA-256、canonical 字节数和最终 SHA-256；测试证明输入顺序、JSON key 顺序和换行风格不影响结果。
