# Security & privacy (Phase 17)

## Findings
1. **Local-first:** Project data (including `originalText`) lives in **IndexedDB** in the browser.
2. **No science network:** HMM, AIC/BIC, bootstrap, smFRET, import/QC/plots do not call remote analysis APIs.
3. **What may leave the browser:** only **user-initiated downloads** (reports, synthetic CSV/JSON, etc.).
4. **3D viewer:** Mol* is display-only; science does not depend on GPU or remote structure services.
5. **Exports:** research reports are built to **exclude `originalText`**; `stripSensitiveKeys` drops secret-like keys if present in export objects.
6. **No analytics:** app source does not include sendBeacon/gtag analytics hooks.

## Tester checks
1. Open **Privacy & local-first** panel — copy matches this README.
2. Export a Markdown/JSON report → search for `originalText` long payloads (should be absent).
3. `npm run verify:security` (if present) or confirm build + smoke.
4. Confirm science actions work offline once the app bundle is loaded (IndexedDB + workers).
