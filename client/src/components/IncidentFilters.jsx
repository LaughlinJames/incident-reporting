/**
 * @param {object} props
 * @param {{ severity: string, status: string }} [props.value]
 * @param {(p: { severity: string, status: string }) => void} [props.onChange]
 * @param {import('react').ReactNode} [props.rightContent]
 */
export function IncidentFilters({ value = { severity: '', status: '' }, onChange, rightContent }) {
  return (
    <div className="card">
      <div className="row">
        <label>
          Severity
          <select
            value={value.severity}
            onChange={(e) => onChange && onChange({ ...value, severity: e.target.value })}
          >
            <option value="">All</option>
            <option value="sev0">sev0</option>
            <option value="sev1">sev1</option>
            <option value="sev2">sev2</option>
            <option value="sev3">sev3</option>
            <option value="sev4">sev4</option>
          </select>
        </label>
        <label>
          Status
          <select
            value={value.status}
            onChange={(e) => onChange && onChange({ ...value, status: e.target.value })}
          >
            <option value="">All</option>
            <option value="open">open</option>
            <option value="acknowledged">acknowledged</option>
            <option value="mitigating">mitigating</option>
            <option value="resolved">resolved</option>
            <option value="closed">closed</option>
          </select>
        </label>
        {rightContent ? <div style={{ marginLeft: 'auto' }}>{rightContent}</div> : null}
      </div>
    </div>
  );
}
