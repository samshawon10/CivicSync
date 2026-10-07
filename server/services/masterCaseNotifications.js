import Notification from '../models/Notification.js';
import Report from '../models/Report.js';

export async function notifyMasterCaseReporters(report, message) {
  if (!report?._id || !message) return;
  try {
    const reports = await Report.find({
      $or: [{ _id: report._id }, { masterCaseId: report._id }]
    }).select('_id createdBy').lean();
    const reporters = new Map();
    for (const item of reports) {
      const reporterId = String(item.createdBy);
      if (!reporters.has(reporterId)) reporters.set(reporterId, { recipient: item.createdBy, reportId: item._id });
    }
    await Promise.all([...reporters.values()].map(({ recipient, reportId }) =>
      Notification.create({ recipient, report: reportId, type: 'report_status', message })
    ));
  } catch (error) {
    console.error('[notification] unable to notify master-case reporters:', error.message);
  }
}
