/**
 * Idempotent seed: clears incidents only (keeps a fresh demo).
 * Run from repo root: npm run seed
 * Or: node server/seed/seedData.js (from incident-intelligence folder)
 * Requires: MONGODB_URI in server/.env
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { connectDB } from '../config/db.js';
import { Customer } from '../models/Customer.js';
import { Service } from '../models/Service.js';
import mongoose from 'mongoose';
import { Incident } from '../models/Incident.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}
function hoursAgo(n) {
  return new Date(Date.now() - n * 60 * 60 * 1000);
}

/** Add milliseconds to a Date (avoid `date + n` which string-coerces) */
function addMs(date, ms) {
  return new Date(date.getTime() + ms);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN(arr, n) {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

function parseCountArg() {
  const defaultCount = 300;
  const argv = process.argv.slice(2);
  const equalsArg = argv.find((arg) => arg.startsWith('--count='));
  const splitArgIndex = argv.findIndex((arg) => arg === '--count');
  const rawValue =
    (equalsArg ? equalsArg.split('=')[1] : null) ??
    (splitArgIndex >= 0 ? argv[splitArgIndex + 1] : null) ??
    process.env.SEED_COUNT ??
    process.env.npm_config_count ??
    String(defaultCount);

  const value = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(value) || value < 8) {
    throw new Error(
      'Invalid count value. Use an integer >= 8 (examples: --count=500, --count 500, or SEED_COUNT=500).'
    );
  }
  return value;
}

async function seed() {
  const totalIncidentCount = parseCountArg();
  await connectDB();
  // eslint-disable-next-line no-console
  console.log(`Seeding: resetting demo data and creating ${totalIncidentCount} incidents...`);
  await Promise.all([Incident.deleteMany({}), Customer.deleteMany({}), Service.deleteMany({})]);

  const customers = await Customer.insertMany([
    {
      name: 'Nimbus Analytics',
      accountTier: 'enterprise',
      contactEmail: 'sre@nimbus.io',
      industry: 'SaaS / Data',
      region: 'us-east-1',
    },
    {
      name: 'Harbor Health Systems',
      accountTier: 'enterprise',
      contactEmail: 'itops@harborhealth.care',
      industry: 'Healthcare',
      region: 'us-west-2',
    },
    {
      name: 'Copperline Retail',
      accountTier: 'standard',
      contactEmail: 'ops@copperline.shop',
      industry: 'Retail / E‑commerce',
      region: 'eu-west-1',
    },
  ]);

  const [nimbus, harbor, copper] = customers;
  if (!nimbus || !harbor || !copper) throw new Error('Customer insert failed');

  const services = await Service.insertMany([
    {
      name: 'Core API',
      type: 'api',
      region: 'us-east-1',
      description: 'Primary GraphQL/REST control plane',
    },
    {
      name: 'Edge CDN',
      type: 'cdn',
      region: 'global',
      description: 'Static assets and application shell',
    },
    {
      name: 'Auth Service',
      type: 'auth',
      region: 'us-east-1',
      description: 'OIDC, sessions, and token issuance',
    },
    {
      name: 'Webhook Delivery',
      type: 'integrations',
      region: 'us-east-1',
      description: 'Outbound event fan-out to customer endpoints',
    },
  ]);
  const [api, cdn, auth, webhooks] = services;
  if (!api || !cdn || !auth || !webhooks) throw new Error('Service insert failed');

  const inc = [
    {
      incidentId: 'INC-2026-0001',
      title: 'SSL certificate expiring on Edge CDN for customer custom domain',
      description:
        'Auto-renewal did not run for a subset of custom domains. Certificate for shop.copperline.shop showed expired chain in ap-southeast-1 edge POPs.',
      severity: 'sev1',
      status: 'mitigating',
      customerId: copper._id,
      serviceIds: [cdn._id],
      tags: ['ssl', 'cdn', 'edge'],
      impactedRegions: ['ap-southeast-1', 'eu-central-1'],
      openedAt: hoursAgo(4),
      owner: 'j.rivera@company.com',
      rootCause: 'DNS validation record missing after DNS provider change; ACME could not complete renewal.',
      remediation: 'Manual cert issuance, restore TXT records, and run validation sweep across tenants.',
      timelineEvents: [
        { at: hoursAgo(4), type: 'detected', message: 'Status page error rate spike; TLS handshake failures reported', author: 'monitoring' },
        { at: hoursAgo(3.5), type: 'triage', message: 'Isolated to Edge CDN in two POPs; origin healthy', author: 'j.rivera' },
        { at: hoursAgo(2), type: 'mitigation', message: 'Temporary cert pinned at edge; working on full renewal', author: 'j.rivera' },
      ],
      customerUpdates: [
        { at: hoursAgo(3.2), channel: 'status_page', message: 'We are investigating TLS errors for some storefront traffic.', author: 'comms' },
        { at: hoursAgo(1), channel: 'email', message: 'Mitigation in place; traffic should recover. Follow-up in 1h with RCA.', author: 'comms' },
      ],
      metadata: { source: 'synthetic', priority: 1 },
    },
    {
      incidentId: 'INC-2026-0002',
      title: 'DNS propagation delay after nameserver change',
      description: 'Nimbus cut over NS records; regional resolvers still serving stale A/AAAA. Internal APIs intermittently fail health checks in eu-west-1.',
      severity: 'sev2',
      status: 'acknowledged',
      customerId: nimbus._id,
      serviceIds: [api._id, cdn._id],
      tags: ['dns', 'propagation', 'network'],
      impactedRegions: ['eu-west-1', 'us-east-1'],
      openedAt: hoursAgo(6),
      owner: 'm.choi@company.com',
      timelineEvents: [
        { at: hoursAgo(6), type: 'created', message: 'Partner reported 503 on api EU routing path', author: 'support' },
        { at: hoursAgo(5.5), type: 'triage', message: 'DNS cache TTLs higher than expected; working with Nimbus to lower TTL on apex', author: 'm.choi' },
      ],
      customerUpdates: [
        { at: hoursAgo(5.7), channel: 'slack', message: 'We see DNS flapping for api.eu. Confirmed in traceroute. Updates every 15m.', author: 'csm' },
      ],
      metadata: { source: 'partner' },
    },
    {
      incidentId: 'INC-2026-0003',
      title: 'P95 API latency spike on Core API (login-adjacent paths)',
      description:
        'Database connection pool near saturation. Login and token refresh endpoints showing elevated latency; no hard failures but risk of timeout storms.',
      severity: 'sev2',
      status: 'open',
      customerId: harbor._id,
      serviceIds: [api._id, auth._id],
      tags: ['latency', 'api', 'database'],
      impactedRegions: ['us-east-1'],
      openedAt: hoursAgo(1.5),
      owner: 'a.ngo@company.com',
      timelineEvents: [
        { at: hoursAgo(1.5), type: 'detected', message: 'SLO burn on auth p95', author: 'slo' },
        { at: hoursAgo(1.2), type: 'triage', message: 'DB pool 87% used; autoscaling for API pods in progress', author: 'a.ngo' },
      ],
      customerUpdates: [
        { at: hoursAgo(1.3), channel: 'status_page', message: 'Login may be slower; we are scaling API capacity and reviewing DB headroom.', author: 'comms' },
      ],
      metadata: { runbook: 'api-latency' },
    },
    {
      incidentId: 'INC-2026-0004',
      title: 'User login outage — Auth Service error budget exhausted',
      description:
        'Bad deploy introduced regression in session validation. Users unable to sign in; incident upgraded to SEV0 until rollback.',
      severity: 'sev0',
      status: 'resolved',
      customerId: copper._id,
      serviceIds: [auth._id, api._id],
      tags: ['auth', 'outage', 'deploy'],
      impactedRegions: ['us-east-1', 'us-west-2'],
      openedAt: daysAgo(2),
      resolvedAt: addMs(daysAgo(2), 90 * 60 * 1000),
      owner: 'p.gold@company.com',
      rootCause: 'Null deref in session middleware under specific cookie shape.',
      remediation: 'Rolled back; added integration test; feature flag for new parser.',
      timelineEvents: [
        { at: daysAgo(2), type: 'created', message: 'Login failure rate crossed critical threshold', author: 'paged' },
        { at: addMs(daysAgo(2), 20 * 60 * 1000), type: 'mitigation', message: 'Initiated controlled rollback to prior release', author: 'p.gold' },
        { at: addMs(daysAgo(2), 90 * 60 * 1000), type: 'resolved', message: 'Error rates back to normal; postmortem scheduled', author: 'p.gold' },
      ],
      customerUpdates: [
        { at: addMs(daysAgo(2), 10 * 60 * 1000), channel: 'status_page', message: 'We are experiencing login issues. Engineering engaged.', author: 'comms' },
        { at: addMs(daysAgo(2), 95 * 60 * 1000), channel: 'email', message: 'Issue resolved. Root cause: deployment regression, now reverted.', author: 'comms' },
      ],
      metadata: { jira: 'OC-4412' },
    },
    {
      incidentId: 'INC-2026-0005',
      title: 'CDN caching misconfiguration for dashboard bundle',
      description:
        'Cache-Control header omitted on new static chunk; some users see stale JavaScript. Mitigated with manual purge and header fix in deploy pipeline.',
      severity: 'sev3',
      status: 'closed',
      customerId: nimbus._id,
      serviceIds: [cdn._id],
      tags: ['cdn', 'caching', 'frontend'],
      impactedRegions: ['global'],
      openedAt: daysAgo(5),
      resolvedAt: addMs(daysAgo(5), 3 * 60 * 60 * 1000),
      owner: 'k.singh@company.com',
      rootCause: 'Build plugin removed headers for code-split assets.',
      remediation: 'Pipeline guard + integration test on headers for hashed assets.',
      timelineEvents: [
        { at: daysAgo(5), type: 'detected', message: 'Console errors: chunk load failed; version skew', author: 'support' },
        { at: addMs(daysAgo(5), 2 * 60 * 60 * 1000), type: 'mitigation', message: 'Purge and emergency deploy to restore headers', author: 'k.singh' },
      ],
      customerUpdates: [
        { at: addMs(daysAgo(5), 30 * 60 * 1000), channel: 'status_page', message: 'Some users may need hard refresh. Fix rolling out.', author: 'comms' },
      ],
      metadata: {},
    },
    {
      incidentId: 'INC-2026-0006',
      title: 'Webhook delivery failure spike for enterprise tenants',
      description:
        'Queue backlog in outbound webhooks. Partner endpoints returning 429; retry policy caused thundering herd. Paged several critical Harbor workflows.',
      severity: 'sev1',
      status: 'mitigating',
      customerId: harbor._id,
      serviceIds: [webhooks._id, api._id],
      tags: ['webhooks', 'integrations', 'queue'],
      impactedRegions: ['us-east-1'],
      openedAt: hoursAgo(8),
      owner: 'd.mercado@company.com',
      rootCause: 'Per-tenant rate limit mis-set after config migration.',
      timelineEvents: [
        { at: hoursAgo(8), type: 'detected', message: 'DLQ growth >2 std dev; alert opened', author: 'monitoring' },
        { at: hoursAgo(7.5), type: 'mitigation', message: 'Paused fan-out, applied exponential backoff cap', author: 'd.mercado' },
        { at: hoursAgo(3), type: 'update', message: 'Reprocessing backlog with throttled workers', author: 'd.mercado' },
      ],
      customerUpdates: [
        { at: hoursAgo(7.8), channel: 'email', message: 'Outbound events delayed; we are throttling to protect your endpoints and ours.', author: 'comms' },
      ],
      metadata: { onCall: 'integrations' },
    },
    {
      incidentId: 'INC-2026-0007',
      title: 'Intermittent 401 on Core API for rotated API keys',
      description:
        'Key rotation job ran twice; some tokens invalidated early. Affects a subset of Nimbus ETL jobs calling Core API in us-east-1.',
      severity: 'sev3',
      status: 'resolved',
      customerId: nimbus._id,
      serviceIds: [api._id, auth._id],
      tags: ['api', 'auth', 'keys'],
      impactedRegions: ['us-east-1'],
      openedAt: daysAgo(1),
      resolvedAt: addMs(daysAgo(1), 2 * 60 * 60 * 1000),
      owner: 'l.patel@company.com',
      rootCause: 'Idempotent key rotation not enforced; race between workers.',
      remediation: 'Distributed lock; expanded audit of rotation jobs.',
      timelineEvents: [
        { at: daysAgo(1), type: 'created', message: '401 errors correlated with new key id in logs', author: 'support' },
        { at: addMs(daysAgo(1), 1 * 60 * 60 * 1000), type: 'mitigation', message: 'Restored last-known-good key material for affected tenants', author: 'l.patel' },
      ],
      customerUpdates: [
        { at: addMs(daysAgo(1), 20 * 60 * 1000), channel: 'ticket', message: 'If you recently rotated API keys, re-issue from console if jobs fail.', author: 'csm' },
      ],
      metadata: {},
    },
    {
      incidentId: 'INC-2026-0008',
      title: 'Status page false positive (monitoring probe misconfigured)',
      description:
        'Synthetic probe for Copperline storefront was hitting a deprecated health URL; triggered incident workflow though production traffic was normal.',
      severity: 'sev4',
      status: 'closed',
      customerId: copper._id,
      serviceIds: [cdn._id, api._id],
      tags: ['monitoring', 'false-positive'],
      impactedRegions: ['us-west-2'],
      openedAt: daysAgo(3),
      resolvedAt: addMs(daysAgo(3), 30 * 60 * 1000),
      owner: 'r.ozawa@company.com',
      rootCause: 'Old probe path after store migration; should have been removed.',
      timelineEvents: [
        { at: daysAgo(3), type: 'acknowledged', message: 'Verified with live user sessions and APM: no user impact', author: 'r.ozawa' },
        { at: addMs(daysAgo(3), 20 * 60 * 1000), type: 'resolved', message: 'Probe updated; no production incident; closing', author: 'r.ozawa' },
      ],
      customerUpdates: [
        { at: addMs(daysAgo(3), 10 * 60 * 1000), channel: 'status_page', message: 'We are reviewing an alert. Early signs point to a monitoring false positive. Updates shortly.', author: 'comms' },
      ],
      metadata: { noise: true },
    },
  ];

  const customersByKey = { nimbus, harbor, copper };
  const servicesByKey = { api, cdn, auth, webhooks };
  const baseCount = inc.length;
  const additionalCount = Math.max(totalIncidentCount - baseCount, 0);
  const startingIncidentNumber = baseCount + 1;

  const templates = [
    {
      key: 'auth-token',
      titlePrefix: 'Token validation failures on Auth Service',
      description:
        'A config drift in token issuer metadata caused intermittent auth validation failures for machine-to-machine traffic.',
      tags: ['auth', 'api', 'tokens'],
      baseSeverity: 'sev2',
      impactedRegions: ['us-east-1', 'us-west-2'],
      customerPool: [customersByKey.nimbus, customersByKey.harbor],
      servicePool: [servicesByKey.auth, servicesByKey.api],
      rootCauses: [
        'OIDC issuer cache held stale metadata after emergency failover.',
        'Token audience validation rule changed without cross-region sync.',
      ],
      remediations: [
        'Flushed issuer cache and rolled back validation config.',
        'Added config consistency check before deployment promotion.',
      ],
    },
    {
      key: 'cdn-cache',
      titlePrefix: 'Stale content served from Edge CDN',
      description:
        'Edge caches retained old bundle metadata after incremental deploy; affected clients received stale app shells.',
      tags: ['cdn', 'caching', 'frontend'],
      baseSeverity: 'sev3',
      impactedRegions: ['global'],
      customerPool: [customersByKey.nimbus, customersByKey.copper],
      servicePool: [servicesByKey.cdn],
      rootCauses: [
        'Cache invalidation webhook failed for a subset of regions.',
        'Header normalization dropped surrogate control directives.',
      ],
      remediations: [
        'Triggered regional purge and enforced cache header contract.',
        'Added deployment check that verifies invalidation completion.',
      ],
    },
    {
      key: 'webhook-backlog',
      titlePrefix: 'Webhook dispatch backlog and retries',
      description:
        'Outbound webhook queue depth increased rapidly, causing delivery delay and elevated retry pressure on workers.',
      tags: ['webhooks', 'queue', 'integrations'],
      baseSeverity: 'sev1',
      impactedRegions: ['us-east-1'],
      customerPool: [customersByKey.harbor, customersByKey.copper],
      servicePool: [servicesByKey.webhooks, servicesByKey.api],
      rootCauses: [
        'Rate limiter thresholds were reduced during config migration.',
        'Partner endpoint latency increased and exhausted worker concurrency.',
      ],
      remediations: [
        'Raised concurrency limits and introduced adaptive backoff.',
        'Segmented retry queues by tenant priority and endpoint health.',
      ],
    },
    {
      key: 'api-latency',
      titlePrefix: 'Core API latency degradation',
      description:
        'P95 latency rose above SLO for read-heavy endpoints due to database saturation and uneven pod scaling.',
      tags: ['api', 'latency', 'database'],
      baseSeverity: 'sev2',
      impactedRegions: ['us-east-1', 'eu-west-1'],
      customerPool: [customersByKey.nimbus, customersByKey.harbor, customersByKey.copper],
      servicePool: [servicesByKey.api],
      rootCauses: [
        'Read replicas lagged after maintenance window, forcing primary pressure.',
        'Autoscaler threshold too conservative during traffic burst.',
      ],
      remediations: [
        'Increased read pool and tuned autoscaling thresholds.',
        'Added canary alarms for replica lag and query saturation.',
      ],
    },
    {
      key: 'dns-routing',
      titlePrefix: 'DNS routing instability for tenant endpoints',
      description:
        'Resolver inconsistencies after DNS changes caused intermittent endpoint resolution and elevated upstream errors.',
      tags: ['dns', 'network', 'routing'],
      baseSeverity: 'sev2',
      impactedRegions: ['eu-west-1', 'us-east-1'],
      customerPool: [customersByKey.nimbus, customersByKey.copper],
      servicePool: [servicesByKey.api, servicesByKey.cdn],
      rootCauses: [
        'TTL values were not lowered ahead of NS cutover.',
        'Regional resolver cache held stale CNAME chain.',
      ],
      remediations: [
        'Reduced TTLs and re-ran propagation validation checks.',
        'Added pre-cutover checklist with resolver sampling gates.',
      ],
    },
  ];

  const severityWeights = ['sev0', 'sev1', 'sev1', 'sev2', 'sev2', 'sev2', 'sev3', 'sev3', 'sev4'];
  const openStatuses = ['open', 'acknowledged', 'mitigating'];
  const resolvedStatuses = ['resolved', 'closed'];
  const owners = [
    'a.ngo@company.com',
    'd.mercado@company.com',
    'j.rivera@company.com',
    'k.singh@company.com',
    'l.patel@company.com',
    'm.choi@company.com',
    'p.gold@company.com',
    'r.ozawa@company.com',
  ];
  const channels = ['email', 'slack', 'status_page', 'phone', 'ticket'];

  const generatedIncidents = Array.from({ length: additionalCount }, (_, i) => {
    const num = startingIncidentNumber + i;
    const template = pick(templates);
    const openedHoursAgo = Math.floor(Math.random() * (24 * 45)) + 1;
    const openedAt = hoursAgo(openedHoursAgo);
    const shouldBeOpen = Math.random() < 0.55;
    const severity = Math.random() < 0.7 ? template.baseSeverity : pick(severityWeights);
    const status = shouldBeOpen ? pick(openStatuses) : pick(resolvedStatuses);
    const customer = pick(template.customerPool);
    const serviceCount = Math.min(1 + Math.floor(Math.random() * 2), template.servicePool.length);
    const selectedServices = pickN(template.servicePool, serviceCount);
    const serviceIds = selectedServices.map((s) => s._id);

    const triageAt = addMs(openedAt, 8 * 60 * 1000);
    const updateAt = addMs(openedAt, 35 * 60 * 1000);
    const resolvedAt =
      status === 'resolved' || status === 'closed'
        ? addMs(openedAt, (45 + Math.floor(Math.random() * 480)) * 60 * 1000)
        : null;

    const timelineEvents = [
      {
        at: openedAt,
        type: 'detected',
        message: `Automated alert triggered for ${template.key.replace('-', ' ')} symptoms`,
        author: 'monitoring',
      },
      {
        at: triageAt,
        type: 'triage',
        message: 'Primary impact isolated; mitigation plan prepared with on-call teams.',
        author: pick(owners),
      },
      {
        at: updateAt,
        type: status === 'open' || status === 'acknowledged' || status === 'mitigating' ? 'mitigation' : 'resolved',
        message:
          status === 'open' || status === 'acknowledged' || status === 'mitigating'
            ? 'Mitigation in progress and customer traffic is partially recovering.'
            : 'Service behavior returned to baseline and recovery checks passed.',
        author: pick(owners),
      },
    ];

    if (resolvedAt) {
      timelineEvents.push({
        at: resolvedAt,
        type: 'resolved',
        message: 'Incident resolved and handoff completed for postmortem follow-up.',
        author: pick(owners),
      });
    }

    const customerUpdates = [
      {
        at: addMs(openedAt, 15 * 60 * 1000),
        channel: pick(channels),
        message: 'We identified elevated errors and are actively mitigating impact.',
        author: 'comms',
      },
      {
        at: addMs(openedAt, 50 * 60 * 1000),
        channel: pick(channels),
        message:
          resolvedAt
            ? 'Issue is resolved. We will share root cause details in the incident follow-up.'
            : 'Mitigation continues. Next update will be shared in 30 minutes.',
        author: 'comms',
      },
    ];

    return {
      incidentId: `INC-2026-${String(num).padStart(4, '0')}`,
      title: `${template.titlePrefix} (${customer.name})`,
      description: template.description,
      severity,
      status,
      customerId: customer._id,
      serviceIds,
      tags: template.tags,
      impactedRegions: template.impactedRegions,
      openedAt,
      resolvedAt,
      owner: pick(owners),
      rootCause: resolvedAt ? pick(template.rootCauses) : undefined,
      remediation: resolvedAt ? pick(template.remediations) : undefined,
      timelineEvents,
      customerUpdates,
      metadata: {
        source: 'synthetic-bulk',
        template: template.key,
      },
    };
  });

  await Incident.insertMany([...inc, ...generatedIncidents]);
  // TODO: in production, avoid dropping all; use upsert by business key or a dedicated demo DB
  // eslint-disable-next-line no-console
  console.log(
    `Seeded: ${customers.length} customers, ${services.length} services, ${inc.length + generatedIncidents.length} incidents.`
  );
  await mongoose.connection.close();
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
