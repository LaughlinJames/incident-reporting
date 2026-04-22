import { Link } from 'react-router-dom';

function statusClass(status) {
  if (['open', 'acknowledged', 'mitigating'].includes(status)) return 'warn';
  return 'muted';
}

const SORT_COLUMNS = [
  { key: 'incidentId', label: 'ID' },
  { key: 'title', label: 'Title' },
  { key: 'customer', label: 'Customer' },
  { key: 'severity', label: 'Severity' },
  { key: 'status', label: 'Status' },
  { key: 'openedAt', label: 'Opened' },
];

/**
 * @param {object} props
 * @param {any[]} [props.items]
 * @param {boolean} [props.loading]
 * @param {string} [props.sort]
 * @param {'asc'|'desc'} [props.order]
 * @param {(key: string) => void} [props.onSort]
 */
export function IncidentTable({ items, loading, sort, order, onSort }) {
  if (loading) {
    return <p className="loading">Loading incidents…</p>;
  }
  if (!items?.length) {
    return <p className="muted">No incidents match your filters.</p>;
  }
  return (
    <div className="card" style={{ padding: 0, overflow: 'auto' }}>
      <table>
        <thead>
          <tr>
            {SORT_COLUMNS.map(({ key, label }) => {
              const active = sort === key;
              return (
                <th key={key} {...(active ? { 'aria-sort': order === 'asc' ? 'ascending' : 'descending' } : {})}>
                  <button
                    type="button"
                    className="th-sort"
                    onClick={() => onSort?.(key)}
                    aria-label={`Sort by ${label}${active ? `, ${order === 'asc' ? 'ascending' : 'descending'}` : ''}`}
                  >
                    <span>{label}</span>
                    {active && <span className="th-sort-indicator">{order === 'asc' ? '↑' : '↓'}</span>}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row._id}>
              <td>
                <Link to={`/incidents/${row._id}`}>{row.incidentId}</Link>
              </td>
              <td>{row.title}</td>
              <td className="muted">{row.customer?.name || '—'}</td>
              <td>
                <span className={`badge ${row.severity}`}>{row.severity}</span>
              </td>
              <td>
                <span className={`pill ${statusClass(row.status)}`}>{row.status}</span>
              </td>
              <td className="muted">{row.openedAt ? new Date(row.openedAt).toLocaleString() : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
