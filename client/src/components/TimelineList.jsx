/**
 * @param {object} props
 * @param {any[]} [props.events]
 */
export function TimelineList({ events }) {
  if (!events?.length) {
    return <p className="muted">No timeline events yet.</p>;
  }
  return (
    <ul className="timeline">
      {[...events]
        .sort((a, b) => new Date(b.at) - new Date(a.at))
        .map((ev) => (
          <li key={ev._id || `${ev.at}-${ev.message}`}>
            <div className="meta">
              {new Date(ev.at).toLocaleString()} · {ev.type || 'update'}
              {ev.author ? ` · ${ev.author}` : ''}
            </div>
            <div>{ev.message}</div>
          </li>
        ))}
    </ul>
  );
}
