import { useCallback, useEffect, useState } from 'react';
import { getIncidents } from '../api.js';
import { IncidentFilters } from '../components/IncidentFilters.js';
import { IncidentTable } from '../components/IncidentTable.js';

function defaultOrderForColumn(column) {
  return column === 'openedAt' ? 'desc' : 'asc';
}

export function IncidentListPage() {
  const [filters, setFilters] = useState({ severity: '', status: '' });
  const [sort, setSort] = useState('openedAt');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const handleSort = useCallback((column) => {
    if (column === sort) {
      setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(column);
      setOrder(defaultOrderForColumn(column));
    }
    setPage(1);
  }, [sort]);

  const handleFiltersChange = useCallback((next) => {
    setFilters(next);
    setPage(1);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getIncidents({ ...filters, page, limit: 50, sort, order });
      setData(res);
    } catch (e) {
      setError(e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filters, page, sort, order]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (data?.pagination?.pages && page > data.pagination.pages) {
      setPage(data.pagination.pages);
    }
  }, [data, page]);

  const totalPages = data?.pagination?.pages || 1;
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;
  const maxVisiblePages = 5;
  const firstVisiblePage = Math.max(1, Math.min(page - 2, totalPages - (maxVisiblePages - 1)));
  const lastVisiblePage = Math.min(totalPages, firstVisiblePage + (maxVisiblePages - 1));
  const visiblePages = Array.from(
    { length: lastVisiblePage - firstVisiblePage + 1 },
    (_, i) => firstVisiblePage + i
  );
  const renderPaginationNav = (ariaLabel) => (
    <nav aria-label={ariaLabel} style={{ display: 'inline-flex', gap: '0.5rem' }}>
      {canGoPrev ? (
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage((p) => Math.max(1, p - 1));
          }}
        >
          {'<<'}
        </a>
      ) : (
        <span className="muted">{'<<'}</span>
      )}

      {visiblePages.map((p) =>
        p === page ? (
          <strong key={p} aria-current="page">
            {p}
          </strong>
        ) : (
          <a
            key={p}
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setPage(p);
            }}
          >
            {p}
          </a>
        )
      )}

      {canGoNext ? (
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage((p) => Math.min(totalPages, p + 1));
          }}
        >
          {'>>'}
        </a>
      ) : (
        <span className="muted">{'>>'}</span>
      )}
    </nav>
  );

  return (
    <>
      <h2>Incidents</h2>
      <p className="muted">Filter by operational fields stored on each incident document (MongoDB query-friendly).</p>
      {error && <div className="error-banner">Could not load incidents: {error.message}</div>}
      <IncidentFilters
        value={filters}
        onChange={handleFiltersChange}
        rightContent={data?.pagination ? renderPaginationNav('Incident list pagination top') : null}
      />
      <IncidentTable
        items={data?.data}
        loading={loading}
        sort={sort}
        order={order}
        onSort={handleSort}
      />
      {data?.pagination && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
          {renderPaginationNav('Incident list pagination')}
          <p className="muted" style={{ margin: 0 }}>
            Page {data.pagination.page} of {data.pagination.pages} — {data.pagination.total} total
          </p>
        </div>
      )}
    </>
  );
}
