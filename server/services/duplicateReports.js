import { DUPLICATE_REPORT_RADIUS_METERS, DUPLICATE_REPORT_THRESHOLDS } from '../config/duplicateReports.js';
import Report from '../models/Report.js';

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'is', 'it', 'near', 'of',
  'on', 'the', 'to', 'with', 'road', 'issue', 'problem', 'there', 'this'
]);
const ACTIVE_STAGE_FILTER = { $nin: ['RESOLVED', 'CANCELLED'] };
const ACTIVE_STATUS_FILTER = { $nin: ['closed'] };

export function normalizeIssueText(value = '') {
  return String(value)
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

export function descriptionSimilarity(left, right) {
  const leftWords = new Set(normalizeIssueText(left));
  const rightWords = new Set(normalizeIssueText(right));
  if (!leftWords.size || !rightWords.size) return 0;
  const overlap = [...leftWords].filter((word) => rightWords.has(word)).length;
  const union = new Set([...leftWords, ...rightWords]).size;
  const containment = overlap / Math.min(leftWords.size, rightWords.size);
  return Math.max(overlap / union, containment * 0.65);
}

export function distanceBetweenMeters(left, right) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const latitudeDelta = radians(right.latitude - left.latitude);
  const longitudeDelta = radians(right.longitude - left.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(left.latitude)) * Math.cos(radians(right.latitude))
    * Math.sin(longitudeDelta / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function hasCoordinates(location = {}) {
  return Number.isFinite(location.latitude) && Number.isFinite(location.longitude);
}

function classify(score) {
  if (score >= DUPLICATE_REPORT_THRESHOLDS.high) return 'HIGH';
  if (score >= DUPLICATE_REPORT_THRESHOLDS.medium) return 'MEDIUM';
  return 'LOW';
}

export function sanitizePublicIssueText(value = '') {
  return String(value)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[contact details removed]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[contact details removed]')
    .slice(0, 240);
}

export function publicDuplicateCandidate(report, distanceMeters, confidence) {
  const roundedDistance = Math.max(10, Math.round(distanceMeters / 10) * 10);
  return {
    id: String(report._id),
    title: sanitizePublicIssueText(report.title),
    description: sanitizePublicIssueText(report.description),
    category: report.category,
    departmentName: report.departmentName,
    location: {
      area: sanitizePublicIssueText(report.location?.area || ''),
      address: '',
      distanceMeters: roundedDistance
    },
    status: report.workflowStage || report.status,
    confidence
  };
}

export async function findPotentialDuplicateReports({
  title,
  description,
  category,
  departmentName,
  location,
  excludeReportId
}) {
  if (!hasCoordinates(location)) return [];

  const radius = DUPLICATE_REPORT_RADIUS_METERS;
  const latitudeDelta = radius / 111320;
  const longitudeDelta = radius / (111320 * Math.max(0.01, Math.cos(location.latitude * Math.PI / 180)));
  const longitudeRanges = location.longitude - longitudeDelta < -180
    ? [{ $gte: -180 }, { $lte: location.longitude + longitudeDelta }]
    : location.longitude + longitudeDelta > 180
      ? [{ $gte: location.longitude - longitudeDelta }, { $lte: 180 }]
      : [{ $gte: location.longitude - longitudeDelta, $lte: location.longitude + longitudeDelta }];
  const filter = {
    departmentName,
    category: String(category).toLowerCase(),
    'location.latitude': { $gte: Math.max(-90, location.latitude - latitudeDelta), $lte: Math.min(90, location.latitude + latitudeDelta) },
    status: ACTIVE_STATUS_FILTER,
    workflowStage: ACTIVE_STAGE_FILTER,
    $and: [
      { $or: [{ relationType: { $ne: 'DUPLICATE' } }, { relationType: { $exists: false } }] },
      { $or: [{ isMasterReport: true }, { isMasterReport: { $exists: false } }] }
    ]
  };
  if (longitudeRanges.length === 1) {
    filter['location.longitude'] = longitudeRanges[0];
  } else {
    filter.$and.push({ $or: longitudeRanges.map((range) => ({ 'location.longitude': range })) });
  }
  if (excludeReportId) filter._id = { $ne: excludeReportId };

  const reports = await Report.find(filter)
    .select('_id title description category departmentName location status workflowStage masterCaseId')
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean();
  const submittedText = `${title || ''} ${description || ''}`;

  return reports
    .map((report) => {
      const distance = distanceBetweenMeters(location, report.location);
      const similarity = descriptionSimilarity(submittedText, `${report.title} ${report.description}`);
      const locationScore = Math.max(0, 1 - distance / radius);
      const score = locationScore * 0.4 + similarity * 0.6;
      return { report, distance, score, similarity };
    })
    .filter(({ distance, score, similarity }) =>
      distance <= radius
      && similarity >= 0.2
      && score >= DUPLICATE_REPORT_THRESHOLDS.candidate
    )
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map(({ report, distance, score }) => publicDuplicateCandidate(report, distance, classify(score)));
}

export function isDuplicateReport(report) {
  return report?.relationType === 'DUPLICATE'
    || Boolean(report?.masterCaseId && String(report.masterCaseId) !== String(report._id));
}

export function isMasterReport(report) {
  return !isDuplicateReport(report)
    && report?.relationType !== 'RELATED'
    && report?.isMasterReport !== false;
}
