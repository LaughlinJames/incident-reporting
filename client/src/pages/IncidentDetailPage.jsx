import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getIncident } from '../api.js';
import { CustomerUpdatesList } from '../components/CustomerUpdatesList.js';
import { TimelineList } from '../components/TimelineList.js';

export function IncidentDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getIncident(id);
        if (!cancelled) setData(res.data);
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return <p className="loading">Loading incident…</p>;
  }
  if (error) {
    return (
      <div className="error-banner">
        {error.message}{' '}
        <Link to="/">Back to list</Link>
      </div>
    );
  }
  if (!data) {
    return <p>Not found.</p>;
  }

  return (
    <>
      <p>
        <Link to="/">← All incidents</Link>
      </p>
      <h2>
        {data.incidentId}{' '}
        <span className={`badge ${data.severity}`}>{data.severity}</span>{' '}
        <span className="pill">{data.status}</span>
      </h2>
      <p className="muted">Opened {data.openedAt ? new Date(data.openedAt).toLocaleString() : '—'}</p>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>{data.title}</h2>
        <p>{data.description}</p>
        <div className="detail-grid">
          <div>
            <div className="muted">Customer</div>
            <div>{data.customer?.name || '—'}</div>
          </div>
          <div>
            <div className="muted">Owner</div>
            <div>{data.owner || '—'}</div>
          </div>
        </div>
        {data.services?.length > 0 && (
          <p style={{ marginTop: '1rem' }}>
            <span className="muted">Services: </span>
            {data.services.map((s) => s.name).join(', ')}
          </p>
        )}
        {data.rootCause && (
          <p>
            <span className="muted">Root cause: </span>
            {data.rootCause}
          </p>
        )}
        {data.remediation && (
          <p>
            <span className="muted">Remediation: </span>
            {data.remediation}
          </p>
        )}
      </div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Timeline</h2>
        <TimelineList events={data.timelineEvents} />
      </div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Customer updates</h2>
        <CustomerUpdatesList updates={data.customerUpdates} />
      </div>
    </>
  );
}
