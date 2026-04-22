import { useCallback, useEffect, useState } from 'react';
import { getBySeverity, getOpenByCustomer, getSummary } from '../api.js';
import { SummaryCards } from '../components/SummaryCards.js';

export function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [severity, setSeverity] = useState(null);
  const [byCustomer, setByCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, sev, cust] = await Promise.all([getSummary(), getBySeverity(), getOpenByCustomer()]);
      setSummary(s);
      setSeverity(sev);
      setByCustomer(cust);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <h2>Dashboard</h2>
      <p className="muted">Aggregations over the `incidents` collection — $group, $lookup, and counts.</p>
      {error && <div className="error-banner">Could not load dashboard: {error.message}</div>}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Summary</h2>
        {summary?.data && (
          <p className="muted" style={{ marginTop: 0 }}>
            Status breakdown: {summary.data.byStatus?.map((x) => `${x._id || '?'}: ${x.count}`).join(' · ')}
          </p>
        )}
        <SummaryCards summary={summary} severity={severity} byCustomer={byCustomer} loading={loading} />
      </div>
    </>
  );
}
