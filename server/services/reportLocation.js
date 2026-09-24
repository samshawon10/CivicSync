export function normalizeReportLocation(raw) {
  if (raw === undefined || raw === null || raw === '') return { value: {} };
  let source = raw;
  if (typeof source === 'string') {
    try { source = JSON.parse(source); } catch { return { error: 'Location must be valid.' }; }
  }
  if (!source || typeof source !== 'object' || Array.isArray(source)) return { error: 'Location must be valid.' };
  const latitudeInput = source.latitude;
  const longitudeInput = source.longitude;
  const hasLatitude = latitudeInput !== undefined && latitudeInput !== null && latitudeInput !== '';
  const hasLongitude = longitudeInput !== undefined && longitudeInput !== null && longitudeInput !== '';
  if (hasLatitude !== hasLongitude) return { error: 'Provide both latitude and longitude, or omit both.' };
  const latitude = Number(latitudeInput);
  const longitude = Number(longitudeInput);
  if (hasLatitude && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
    return { error: 'Location coordinates must be valid latitude/longitude values.' };
  }
  return {
    value: {
      area: String(source.area || '').trim().slice(0, 100),
      address: String(source.address || '').trim().slice(0, 300),
      landmark: String(source.landmark || '').trim().slice(0, 150),
      ...(hasLatitude ? { latitude, longitude } : {})
    }
  };
}
