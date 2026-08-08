# Prompt and schema versioning

Current identifiers:

- `promptVersion`: `recognition-2.0.0`
- `schemaVersion`: `2.0`
- `modelName`: `deepseek-v4-flash`

The browser and Cloudflare Worker keep compatible copies of the fixed system contract. The contract treats user text, OCR and webpage text as untrusted data, defines the allowed hierarchy and inference labels, and requires strict JSON only. Recognition history stores all three identifiers so regressions can be reproduced.

When changing recognition behaviour:

1. Update the typed result contract and runtime validator first.
2. Increment `schemaVersion` for incompatible fields and `promptVersion` for behavioural changes.
3. Update both browser and Worker prompt contracts.
4. Add anonymous regression fixtures for the new rule.
5. Run `npm run eval:recognition`, full tests and the Cloudflare checks.
6. Do not silently reinterpret already confirmed tasks; re-run recognition only into a new draft.
