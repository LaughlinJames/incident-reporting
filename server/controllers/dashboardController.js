import { Incident } from '../models/Incident.js';

/**
 * GET /api/dashboard/summary
 * Counts and recent activity for the dashboard.
 */
export async function getSummary(req, res, next) {
  try {
    const [statusCounts, severityCounts, openCount, last24h] = await Promise.all([
      Incident.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]).exec(),
      Incident.aggregate([
        { $group: { _id: '$severity', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]).exec(),
      Incident.countDocuments({ status: { $in: ['open', 'acknowledged', 'mitigating'] } }).exec(),
      (() => {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return Incident.countDocuments({ openedAt: { $gte: since } }).exec();
      })(),
    ]);

    res.json({
      data: {
        byStatus: statusCounts,
        bySeverity: severityCounts,
        openExcludingResolved: openCount,
        openedLast24Hours: last24h,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/dashboard/by-severity
 * Open / active incidents grouped by severity.
 */
export async function getBySeverity(req, res, next) {
  try {
    const pipeline = [
      { $match: { status: { $in: ['open', 'acknowledged', 'mitigating'] } } },
      { $group: { _id: '$severity', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ];
    const rows = await Incident.aggregate(pipeline).exec();
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/dashboard/open-by-customer
 * $lookup to join customer name for reporting.
 * TODO: add pagination if customer base is large; consider $facet for top-N.
 */
export async function getOpenByCustomer(req, res, next) {
  try {
    const pipeline = [
      { $match: { status: { $in: ['open', 'acknowledged', 'mitigating'] } } },
      {
        $group: {
          _id: '$customerId',
          count: { $sum: 1 },
          lastOpened: { $max: '$openedAt' },
        },
      },
      {
        $lookup: {
          from: 'customers',
          localField: '_id',
          foreignField: '_id',
          as: 'customer',
        },
      },
      { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          customerId: '$_id',
          name: { $ifNull: ['$customer.name', 'Unknown'] },
          count: 1,
          lastOpened: 1,
        },
      },
      { $sort: { count: -1, lastOpened: -1 } },
    ];
    const rows = await Incident.aggregate(pipeline).exec();
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
}

/**
 * For debugging index usage, use explain in tests or a REPL, e.g.:
 * Incident.find({ status: 'open' }).sort({ openedAt: -1 }).explain('queryPlanner')
 */
