import { PRIVACY_FINDINGS } from '../security/sanitize'

/** Phase 17 — local-first privacy summary (read-only). */
export function PrivacyPanel() {
  return (
    <section className="panel" aria-labelledby="privacy-heading">
      <h2 id="privacy-heading" className="panel-title">
        Privacy &amp; local-first
      </h2>
      <p className="muted">
        Science stays in your browser. This panel documents what is stored locally
        and what can leave (only when you download something).
      </p>
      <ul className="muted small">
        <li>{PRIVACY_FINDINGS.localFirst}</li>
        <li>{PRIVACY_FINDINGS.scienceNetwork}</li>
        <li>
          May leave the browser:
          <ul>
            {PRIVACY_FINDINGS.mayLeaveBrowser.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </li>
        <li>
          Reports/exports omit: {PRIVACY_FINDINGS.notIncludedInReports.join('; ')}.
        </li>
      </ul>
      <p className="muted small">
        See <code>fixtures/README-security.md</code>.
      </p>
    </section>
  )
}
