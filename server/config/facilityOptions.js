export const facilityGroups = [
  {
    key: 'emergency',
    label: 'Emergency',
    types: ['emergency_center', 'ambulance', 'fire_station']
  },
  {
    key: 'safety',
    label: 'Safety',
    types: ['police', 'safe_point', 'shelter', 'flood_shelter', 'hazard', 'road_blockage']
  },
  {
    key: 'healthcare',
    label: 'Healthcare',
    types: ['hospital', 'pharmacy', 'clinic', 'first_aid_center']
  },
  {
    key: 'community',
    label: 'Civic / Community',
    types: ['mosque', 'school', 'government_office', 'help_center', 'safe_water_point', 'public_toilet']
  }
];

export const facilityTypeLabels = {
  emergency_center: 'Emergency Center',
  ambulance: 'Ambulance',
  fire_station: 'Fire Station',
  police: 'Police Station',
  safe_point: 'Safe Point',
  shelter: 'Emergency Shelter',
  flood_shelter: 'Flood Shelter',
  hazard: 'Hazard / Dangerous Area',
  road_blockage: 'Road Blockage',
  hospital: 'Hospital',
  pharmacy: 'Pharmacy',
  clinic: 'Clinic',
  first_aid_center: 'First Aid Center',
  mosque: 'Mosque',
  school: 'School',
  government_office: 'Government Office',
  help_center: 'Help Center',
  safe_water_point: 'Safe Water Point',
  public_toilet: 'Public Toilet'
};

export const facilityTypes = Object.keys(facilityTypeLabels);
export const nearestHelpTypes = ['police', 'ambulance', 'hospital', 'fire_station', 'safe_point', 'shelter', 'pharmacy'];

export function facilityTypeMeta(type) {
  const group = facilityGroups.find((item) => item.types.includes(type));
  return { type, label: facilityTypeLabels[type] || type, group: group?.key || 'other', groupLabel: group?.label || 'Other' };
}

export function facilityPoint(latitude, longitude) {
  if ([latitude, longitude].some((value) => value === null || value === undefined || value === '')) return undefined;
  if (![latitude, longitude].every((value) => Number.isFinite(Number(value)))) return undefined;
  return { type: 'Point', coordinates: [Number(longitude), Number(latitude)] };
}
