import mongoose from 'mongoose';
import { Customer } from '../models/Customer.js';
import { Incident } from '../models/Incident.js';
import { Service } from '../models/Service.js';

const ALLOWED_SEVERITY = new Set(['sev0', 'sev1', 'sev2', 'sev3', 'sev4']);
const ALLOWED_STATUS = new Set(['open', 'acknowledged', 'mitigating', 'resolved', 'closed']);

function buildFilter(query) {
  const filter = {};

  if (query.severity) {
    const s = String(query.severity);
    if (ALLOWED_SEVERITY.has(s)) filter.severity = s;
  }
  if (query.status) {
    const st = String(query.status);
    if (ALLOWED_STATUS.has(st)) filter.status = st;
  }
  if (query.customerId && mongoose.isValidObjectId(query.customerId)) {
    filter.customerId = new mongoose.Types.ObjectId(query.customerId);
  }
  if (query.tag) {
    filter.tags = String(query.tag);
  }
  if (query.q) {
    filter.$text = { $search: String(query.q) };
  }
  const { dateFrom, dateTo } = query;
  if (dateFrom || dateTo) {
    filter.openedAt = {};
    if (dateFrom) {
      const d = new Date(dateFrom);
      if (!Number.isNaN(d.getTime())) filter.openedAt.$gte = d;
    }
    if (dateTo) {
      const d = new Date(dateTo);
      if (!Number.isNaN(d.getTime())) filter.openedAt.$lte = d;
    }
    if (Object.keys(filter.openedAt).length === 0) delete filter.openedAt;
  }

  return filter;
}

const ALLOWED_LIST_SORT = new Set(['openedAt', 'incidentId', 'title', 'severity', 'status', 'customer']);

/**
 * GET /api/incidents
 * Query: severity, status, customerId, tag, q (text), dateFrom, dateTo, page, limit, sort, order
 */
export async function listIncidents(req, res, next) {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
    const hasText = Boolean(req.query.q);
    const orderParam = String(req.query.order || 'desc') === 'asc' ? 'asc' : 'desc';
    const dir = orderParam === 'asc' ? 1 : -1;
    const sortKeyRaw = String(req.query.sort || 'openedAt');
    const sortKey = !hasText && ALLOWED_LIST_SORT.has(sortKeyRaw) ? sortKeyRaw : 'openedAt';

    const filter = buildFilter(req.query);
    const skip = (page - 1) * limit;

    const customersColl = Customer.collection.name;
    const servicesColl = Service.collection.name;

    const shapeRows = (items) =>
      items.map((i) => ({
        ...i,
        customer: i.customerId,
        services: i.serviceIds,
      }));

    if (hasText) {
      const [rows, total] = await Promise.all([
        Incident.find(filter)
          .select({ score: { $meta: 'textScore' } })
          .sort({ score: { $meta: 'textScore' } })
          .skip(skip)
          .limit(limit)
          .populate('customerId', 'name accountTier')
          .populate('serviceIds', 'name type region')
          .lean()
          .exec(),
        Incident.countDocuments(filter).exec(),
      ]);
      const shaped = shapeRows(rows);
      return res.json({
        data: shaped,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
      });
    }

    if (sortKey === 'customer') {
      const pipeline = [
        { $match: filter },
        {
          $lookup: {
            from: customersColl,
            localField: 'customerId',
            foreignField: '_id',
            as: '__custForSort',
          },
        },
        {
          $addFields: {
            __customerSortName: {
              $toLower: { $ifNull: [{ $arrayElemAt: ['$__custForSort.name', 0] }, ''] },
            },
          },
        },
        { $sort: { __customerSortName: dir, _id: dir } },
        { $skip: skip },
        { $limit: limit },
        {
          $addFields: {
            customerId: { $arrayElemAt: ['$__custForSort', 0] },
          },
        },
        {
          $project: {
            __custForSort: 0,
            __customerSortName: 0,
          },
        },
        {
          $lookup: {
            from: servicesColl,
            localField: 'serviceIds',
            foreignField: '_id',
            as: 'serviceIds',
          },
        },
      ];
      const [rows, total] = await Promise.all([
        Incident.aggregate(pipeline).exec(),
        Incident.countDocuments(filter).exec(),
      ]);
      const shaped = shapeRows(rows);
      return res.json({
        data: shaped,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
      });
    }

    const sortField = { [sortKey]: dir, _id: dir };

    const [rows, total] = await Promise.all([
      Incident.find(filter)
        .sort(sortField)
        .skip(skip)
        .limit(limit)
        .populate('customerId', 'name accountTier')
        .populate('serviceIds', 'name type region')
        .lean()
        .exec(),
      Incident.countDocuments(filter).exec(),
    ]);
    const shaped = shapeRows(rows);

    res.json({
      data: shaped,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/incidents/:id
 */
export async function getIncidentById(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid incident id' });
    }
    const doc = await Incident.findById(id)
      .populate('customerId', 'name accountTier contactEmail industry region')
      .populate('serviceIds', 'name type region status')
      .lean()
      .exec();

    if (!doc) return res.status(404).json({ error: 'Incident not found' });

    return res.json({
      data: {
        ...doc,
        customer: doc.customerId,
        services: doc.serviceIds,
      },
    });
  } catch (err) {
    next(err);
  }
}

function nextIncidentId() {
  // Human-readable for demos; in production use a proper sequence or ULID
  return `INC-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/**
 * POST /api/incidents
 * Body: title, description, severity, status, customerId, serviceIds[], tags[], etc.
 */
export async function createIncident(req, res, next) {
  try {
    const {
      title,
      description,
      severity,
      status,
      customerId,
      serviceIds = [],
      tags = [],
      impactedRegions = [],
      owner,
    } = req.body;

    if (!title || !description || !severity || !status || !customerId) {
      return res.status(400).json({ error: 'title, description, severity, status, and customerId are required' });
    }
    if (!ALLOWED_SEVERITY.has(String(severity)) || !ALLOWED_STATUS.has(String(status))) {
      return res.status(400).json({ error: 'Invalid severity or status' });
    }
    if (!mongoose.isValidObjectId(String(customerId))) {
      return res.status(400).json({ error: 'Invalid customerId' });
    }
    const customer = await Customer.findById(customerId).lean();
    if (!customer) return res.status(400).json({ error: 'Customer not found' });

    for (const sid of serviceIds) {
      if (!mongoose.isValidObjectId(String(sid))) {
        return res.status(400).json({ error: 'Invalid service id in serviceIds' });
      }
    }
    if (serviceIds.length) {
      const count = await Service.countDocuments({ _id: { $in: serviceIds } });
      if (count !== serviceIds.length) {
        return res.status(400).json({ error: 'One or more services not found' });
      }
    }

    const doc = await Incident.create({
      incidentId: nextIncidentId(),
      title: String(title).trim(),
      description: String(description).trim(),
      severity,
      status,
      customerId,
      serviceIds,
      tags,
      impactedRegions,
      owner: owner || undefined,
      openedAt: new Date(),
      timelineEvents: [
        { at: new Date(), type: 'created', message: 'Incident created', author: 'system' },
      ],
      customerUpdates: [],
    });

    const populated = await Incident.findById(doc._id)
      .populate('customerId', 'name accountTier')
      .populate('serviceIds', 'name type region')
      .lean();

    return res.status(201).json({
      data: {
        ...populated,
        customer: populated.customerId,
        services: populated.serviceIds,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/incidents/:id
 */
export async function updateIncident(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid incident id' });
    }

    const updatable = [
      'title',
      'description',
      'severity',
      'status',
      'serviceIds',
      'tags',
      'impactedRegions',
      'owner',
      'rootCause',
      'remediation',
      'resolvedAt',
      'metadata',
    ];
    const patch = {};
    for (const k of updatable) {
      if (Object.prototype.hasOwnProperty.call(req.body, k)) patch[k] = req.body[k];
    }

    if (patch.severity && !ALLOWED_SEVERITY.has(String(patch.severity))) {
      return res.status(400).json({ error: 'Invalid severity' });
    }
    if (patch.status && !ALLOWED_STATUS.has(String(patch.status))) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    if (patch.serviceIds) {
      if (!Array.isArray(patch.serviceIds)) {
        return res.status(400).json({ error: 'serviceIds must be an array' });
      }
      for (const sid of patch.serviceIds) {
        if (!mongoose.isValidObjectId(String(sid))) return res.status(400).json({ error: 'Invalid service id' });
      }
      if (patch.serviceIds.length) {
        const c = await Service.countDocuments({ _id: { $in: patch.serviceIds } });
        if (c !== patch.serviceIds.length) return res.status(400).json({ error: 'One or more services not found' });
      }
    }

    if (patch.resolvedAt && typeof patch.resolvedAt === 'string') {
      patch.resolvedAt = new Date(patch.resolvedAt);
    }
    if (patch.status === 'resolved' || patch.status === 'closed') {
      if (!patch.resolvedAt) patch.resolvedAt = new Date();
    }

    const doc = await Incident.findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true })
      .populate('customerId', 'name accountTier')
      .populate('serviceIds', 'name type region')
      .lean();

    if (!doc) return res.status(404).json({ error: 'Incident not found' });
    return res.json({
      data: {
        ...doc,
        customer: doc.customerId,
        services: doc.serviceIds,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/incidents/:id/timeline
 * Body: message, type?, author?
 */
export async function addTimelineEvent(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid incident id' });
    }
    const { message, type, author } = req.body;
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'message is required' });
    }

    const at = new Date();
    const event = { at, type: type || 'update', message: String(message).trim(), author: author || 'ops' };

    const doc = await Incident.findByIdAndUpdate(
      id,
      { $push: { timelineEvents: event } },
      { new: true, runValidators: true }
    )
      .populate('customerId', 'name accountTier')
      .populate('serviceIds', 'name type region')
      .lean();

    if (!doc) return res.status(404).json({ error: 'Incident not found' });
    return res.status(201).json({
      data: {
        ...doc,
        customer: doc.customerId,
        services: doc.serviceIds,
        addedEvent: { ...event, _id: doc.timelineEvents[doc.timelineEvents.length - 1]?._id },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/incidents/:id/customer-update
 * Body: message, channel?, author?
 */
export async function addCustomerUpdate(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid incident id' });
    }
    const { message, channel, author } = req.body;
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'message is required' });
    }

    const at = new Date();
    const update = {
      at,
      channel: channel || 'status_page',
      message: String(message).trim(),
      author: author || 'support',
    };

    const doc = await Incident.findByIdAndUpdate(
      id,
      { $push: { customerUpdates: update } },
      { new: true, runValidators: true }
    )
      .populate('customerId', 'name accountTier')
      .populate('serviceIds', 'name type region')
      .lean();

    if (!doc) return res.status(404).json({ error: 'Incident not found' });
    return res.status(201).json({
      data: {
        ...doc,
        customer: doc.customerId,
        services: doc.serviceIds,
        addedUpdate: { ...update, _id: doc.customerUpdates[doc.customerUpdates.length - 1]?._id },
      },
    });
  } catch (err) {
    next(err);
  }
}
