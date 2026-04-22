import { Incident } from '../models/Incident.js';

const MAX_SEARCH_LEN = 2000;
const MAX_INCIDENTS = 8;
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const TRUNC = 500;

/**
 * @param {string} text
 * @param {number} max
 */
function clip(text, max) {
  if (!text || text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function shapeIncident(doc) {
  let customerName = null;
  if (doc.customerId && typeof doc.customerId === 'object' && doc.customerId.name != null) {
    customerName = doc.customerId.name;
  }
  return {
    _id: doc._id,
    incidentId: doc.incidentId,
    title: doc.title,
    description: doc.description,
    severity: doc.severity,
    status: doc.status,
    openedAt: doc.openedAt,
    resolvedAt: doc.resolvedAt,
    rootCause: doc.rootCause,
    remediation: doc.remediation,
    tags: doc.tags,
    textScore: doc.score,
    customerName,
  };
}

export async function findSimilarIncidents(q) {
  const search = String(q || '').trim().slice(0, MAX_SEARCH_LEN);
  if (!search) return { incidents: [], matchKind: 'empty' };

  let rows = [];
  try {
    rows = await Incident.find({ $text: { $search: search } })
      .select({ score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' } })
      .limit(MAX_INCIDENTS)
      .populate('customerId', 'name')
      .lean()
      .exec();
  } catch (e) {
    // Missing text index, bad $search string, or other server-side issues — fall back below
    // eslint-disable-next-line no-console
    console.warn('[intelligence] text search failed:', e?.message || e);
  }

  if (rows.length) {
    return {
      incidents: rows.map((r) => shapeIncident(r)),
      matchKind: 'text',
    };
  }

  rows = await Incident.find()
    .sort({ openedAt: -1 })
    .limit(5)
    .populate('customerId', 'name')
    .lean()
    .exec();

  return {
    incidents: rows.map((r) => shapeIncident(r)),
    matchKind: 'recent',
  };
}

/**
 * @param {string} userDescription
 * @param {Awaited<ReturnType<findSimilarIncidents>>['incidents']} incidents
 */
function buildPrompt(userDescription, incidents) {
  if (!incidents.length) {
    return `${userDescription}\n\nThere are no historical incidents in the database. Give general SRE / incident-management best practices for the situation above (triage, mitigation, communications, escalation). Use clear bullet points.`;
  }
  const lines = incidents.map((inc, i) => {
    const parts = [
      `### Similar incident ${i + 1} (${inc.incidentId})`,
      `Title: ${inc.title}`,
      `Severity: ${inc.severity}, Status: ${inc.status}, Customer: ${inc.customerName || 'n/a'}`,
      `Description: ${clip(inc.description, TRUNC)}`,
    ];
    if (inc.rootCause) parts.push(`Root cause (known): ${clip(inc.rootCause, 300)}`);
    if (inc.remediation) parts.push(`Remediation (past): ${clip(inc.remediation, 300)}`);
    return parts.join('\n');
  });

  return `New incident to assess:\n\n${userDescription}\n\n---\n\nPast incidents (most relevant by text search, or the most recent records if there was no strong text match):\n\n${lines.join('\n\n')}\n\nProvide recommended next actions for the new incident (triage, mitigation, communications, escalation). Use clear bullet points. Reference patterns from the past incidents only when helpful.`;
}

/**
 * @param {string} userDescription
 * @param {Awaited<ReturnType<findSimilarIncidents>>['incidents']} incidents
 */
export async function getChatRecommendation(userDescription, incidents) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    const err = new Error('OpenAI is not configured (set OPENAI_API_KEY in server/.env)');
    err.status = 503;
    throw err;
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const system =
    'You are an experienced SRE and incident manager. You help triage new incidents by learning from past incidents in the same organization. Be practical, safe, and concise. If historical data is thin, say so and give general best-practice steps.';

  const user = buildPrompt(userDescription, incidents);

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.4,
      max_tokens: 1200,
    }),
  });

  const data = res.ok ? await res.json() : null;
  if (!res.ok) {
    const body = !data && (await res.text().catch(() => ''));
    const msg = data?.error?.message || (typeof body === 'string' ? body : res.statusText) || 'OpenAI request failed';
    const err = new Error(msg);
    err.status = 502;
    throw err;
  }

  const text = data?.choices?.[0]?.message?.content?.trim() || '';
  if (!text) {
    const err = new Error('OpenAI returned an empty response');
    err.status = 502;
    throw err;
  }
  return { text, model };
}

/**
 * POST /api/intelligence/recommend
 * Body: { description: string }
 */
export async function recommend(req, res, next) {
  try {
    const description = String(req.body?.description || '').trim();
    if (!description) {
      return res.status(400).json({ error: 'description is required' });
    }

    const { incidents, matchKind } = await findSimilarIncidents(description);
    const { text, model } = await getChatRecommendation(description, incidents);

    res.json({
      recommendation: text,
      model,
      matchKind,
      similarIncidents: incidents,
    });
  } catch (e) {
    next(e);
  }
}
