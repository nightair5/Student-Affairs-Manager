# Recognition evaluation

Run:

```bash
npm run eval:recognition
```

The repository contains 60 anonymous deterministic fixtures covering courses, competitions, multiple deadlines, no-deadline notices, corrections, events, scholarships, OCR noise and prompt injection. The evaluation does not send data to DeepSeek and does not claim model quality beyond these fixtures.

Current local-baseline result (2026-08-08):

| Metric | Result |
| --- | ---: |
| Samples | 60 |
| Project match accuracy | 88.33% |
| Project name accuracy | 90.00% |
| Stage accuracy | 38.06% |
| Task precision | 100.00% |
| Task recall | 67.78% |
| Duplicate task rate | 0.00% |
| Over-fragmentation rate | 1.67% |
| Material accuracy | 96.67% |
| Time-point accuracy | 88.33% |
| Evidence accuracy | 91.67% |
| Severe error rate | 10.00% |
| Human-review agreement | 86.67% |

Average confirmation time is not reported because the product has no consented user telemetry. The low stage accuracy and task recall are known limitations of the deterministic fallback; they must not be presented as production DeepSeek quality.
