const severityOrder = ['sev0', 'sev1', 'sev2', 'sev3', 'sev4'];

/**
 * @param {object} props
 * @param {any} [props.summary]
 * @param {any} [props.severity]
 * @param {any} [props.byCustomer]
 * @param {boolean} [props.loading]
 */
export function SummaryCards({ summary, severity, byCustomer, loading }) {
  if (loading) {
    return <p className="loading">Loading dashboard metrics…</p>;
  }

  if (!summary?.data) return null;
  const s = summary.data;
  const open = s.openExcludingResolved ?? 0;
  const last24 = s.openedLast24Hours ?? 0;

  return (
    <>
      <div className="grid-cards">
        <div className="summary-card">
          <span className="muted">Open / in progress</span>
          <div className="value">{open}</div>
        </div>
        <div className="summary-card">
          <span className="muted">Opened (last 24h)</span>
          <div className="value">{last24}</div>
        </div>
        <div className="summary-card">
          <span className="muted">Total incidents (in DB)</span>
          <div className="value">
            {s.byStatus?.reduce((a, b) => a + (b.count || 0), 0) ?? '—'}
          </div>
        </div>
      </div>
      {severity?.data && (
        <div className="card">
          <h2>Active by severity</h2>
          <div className="row">
            {severityOrder
              .map((sev) => {
                const row = severity.data.find((r) => r._id === sev);
                if (!row) return null;
                return (
                  <div key={sev}>
                    <span className={`badge ${sev}`}>{sev}</span>
                    <span style={{ marginLeft: 8 }}>{row.count}</span>
                  </div>
                );
              })
              .filter(Boolean)}
          </div>
        </div>
      )}
      {byCustomer?.data && byCustomer.data.length > 0 && (
        <div className="card">
          <h2>Open by customer</h2>
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Count</th>
                <th>Last opened</th>
              </tr>
            </thead>
            <tbody>
              {byCustomer.data.map((r) => (
                <tr key={String(r.customerId)}>
                  <td>{r.name}</td>
                  <td>{r.count}</td>
                  <td className="muted">{r.lastOpened ? new Date(r.lastOpened).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
