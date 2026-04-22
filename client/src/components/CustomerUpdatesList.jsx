/**
 * @param {object} props
 * @param {any[]} [props.updates]
 */
export function CustomerUpdatesList({ updates }) {
  if (!updates?.length) {
    return <p className="muted">No customer-facing updates yet.</p>;
  }
  return (
    <ul className="updates">
      {[...updates]
        .sort((a, b) => new Date(b.at) - new Date(a.at))
        .map((u) => (
          <li key={u._id || `${u.at}-${u.message}`}>
            <div className="meta">
              {new Date(u.at).toLocaleString()} · {u.channel || 'message'}
              {u.author ? ` · ${u.author}` : ''}
            </div>
            <div>{u.message}</div>
          </li>
        ))}
    </ul>
  );
}
