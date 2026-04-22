import { useState } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { postIntelligenceRecommend } from '../api.js';

function matchLabel(kind) {
  if (kind === 'text') {
    return 'These records were found with full-text search on title and description (strongest match first).';
  }
  if (kind === 'recent') {
    return 'No strong text match was found, so the most recent incidents are used as context for the model.';
  }
  return '';
}

export function IncidentIntelligencePage() {
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await postIntelligenceRecommend(description);
      setResult(res);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  const similar = result?.similarIncidents ?? [];
  const rec = result?.recommendation;

  return (
    <>
      <h2>Incident Intelligence</h2>
      <p className="muted">
        Describe a new or in-progress incident. The app looks up similar records in the database, then asks ChatGPT for suggested next
        steps (triage, mitigation, comms) informed by that history.
      </p>
      {error && <div className="error-banner">Could not get recommendations: {error.message}</div>}
      <form className="card" onSubmit={handleSubmit}>
        <label>
          Incident description
          <textarea
            className="intelligence-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            placeholder="e.g. Elevated 5xx from the Core API in us-east-1, starting ~10 min ago, auth errors spiking in logs…"
            required
            disabled={loading}
          />
        </label>
        <div className="row" style={{ marginTop: '0.75rem' }}>
          <button type="submit" disabled={loading || !description.trim()}>
            {loading ? 'Analyzing…' : 'Get recommendations'}
          </button>
        </div>
      </form>

      {result && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Context: similar incidents</h2>
          {result.matchKind && <p className="muted" style={{ marginTop: 0 }}>{matchLabel(result.matchKind)}</p>}
          {similar.length === 0 ? (
            <p className="muted">No incidents in the database to compare against.</p>
          ) : (
            <div style={{ overflow: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Customer</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Opened</th>
                  </tr>
                </thead>
                <tbody>
                  {similar.map((row) => (
                    <tr key={row._id}>
                      <td>
                        <Link to={`/incidents/${row._id}`}>{row.incidentId}</Link>
                      </td>
                      <td>{row.title}</td>
                      <td className="muted">{row.customerName || '—'}</td>
                      <td>
                        <span className={`badge ${row.severity}`}>{row.severity}</span>
                      </td>
                      <td>
                        <span className="pill muted">{row.status}</span>
                      </td>
                      <td className="muted">{row.openedAt ? new Date(row.openedAt).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {result && rec && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Recommended next actions</h2>
          {result.model && (
            <p className="muted" style={{ marginTop: 0, fontSize: '0.85rem' }}>
              Model: {result.model}
            </p>
          )}
          <div className="recommendation-md">
            <ReactMarkdown>{rec}</ReactMarkdown>
          </div>
        </div>
      )}
    </>
  );
}
