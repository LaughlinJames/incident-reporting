const base = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

/**
 * @param {string} path
 * @param {RequestInit} [init]
 */
export async function request(path, init = {}) {
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = { 'Content-Type': 'application/json', ...init.headers };
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  if (!res.ok) {
    const msg = (data && data.error) || res.statusText || 'Request failed';
    const err = new Error(msg);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

export function getIncidents(params) {
  const q = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
    });
  }
  const suffix = q.toString() ? `?${q}` : '';
  return request(`/api/incidents${suffix}`);
}

export function getIncident(id) {
  return request(`/api/incidents/${id}`);
}

export function getSummary() {
  return request('/api/dashboard/summary');
}

export function getBySeverity() {
  return request('/api/dashboard/by-severity');
}

export function getOpenByCustomer() {
  return request('/api/dashboard/open-by-customer');
}

export function postIntelligenceRecommend(description) {
  return request('/api/intelligence/recommend', {
    method: 'POST',
    body: JSON.stringify({ description }),
  });
}
