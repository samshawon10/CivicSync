const configuredRadius = Number(process.env.DUPLICATE_REPORT_RADIUS_METERS);

export const DUPLICATE_REPORT_RADIUS_METERS = Number.isFinite(configuredRadius)
  && configuredRadius >= 25
  && configuredRadius <= 1000
  ? configuredRadius
  : 100;

export const DUPLICATE_REPORT_THRESHOLDS = Object.freeze({
  candidate: 0.4,
  medium: 0.58,
  high: 0.78
});
