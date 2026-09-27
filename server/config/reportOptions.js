
/** Canonical display order + the department that owns each category. */
export const defaultReportCategories = [
  { key: 'road_infrastructure', label: 'Road & Infrastructure', defaultDepartment: 'Roads & Infrastructure', order: 10, description: 'Potholes, damaged carriageways, road markings and general road defects.' },
  { key: 'street_light', label: 'Street Light', defaultDepartment: 'Roads & Infrastructure', order: 20, description: 'Street lights that are out, flickering or damaged.' },
  { key: 'garbage_waste', label: 'Garbage & Waste', defaultDepartment: 'Waste Management', order: 30, description: 'Missed collections, illegal dumping and overflowing public bins.' },
  { key: 'drainage', label: 'Drainage', defaultDepartment: 'Water & Sewerage', order: 40, description: 'Blocked drains, waterlogging and open manholes.' },
  { key: 'water_supply', label: 'Water Supply', defaultDepartment: 'Water & Sewerage', order: 50, description: 'Supply interruptions, contamination and low pressure.' },
  { key: 'sewerage', label: 'Sewerage', defaultDepartment: 'Water & Sewerage', order: 60, description: 'Broken or overflowing sewer lines.' },
  { key: 'traffic', label: 'Traffic', defaultDepartment: 'Traffic Management', order: 70, description: 'Traffic signals, signage, junctions and congestion hazards.' },
  { key: 'public_transport', label: 'Public Transport', defaultDepartment: 'Traffic Management', order: 80, description: 'Bus stops, shelters, service disruption and vehicle condition.' },
  { key: 'footpath', label: 'Footpath', defaultDepartment: 'Roads & Infrastructure', order: 90, description: 'Damaged, blocked or missing pavements.' },
  { key: 'illegal_parking', label: 'Illegal Parking', defaultDepartment: 'Traffic Management', order: 100, description: 'Vehicles parked on pavements, junctions or restricted roads.' },
  { key: 'public_health', label: 'Public Health', defaultDepartment: 'Public Health', order: 110, description: 'Sanitation, hygiene and public health hazards in shared spaces.' },
  { key: 'electricity', label: 'Electricity', defaultDepartment: 'Electricity', order: 120, description: 'Power outages, exposed wiring and damaged poles.' },
  { key: 'public_safety', label: 'Public Safety', defaultDepartment: 'Public Safety', order: 130, description: 'Unsafe situations, harassment and citizen security concerns.' },
  { key: 'noise_pollution', label: 'Noise Pollution', defaultDepartment: 'Environment', order: 140, description: 'Excessive noise from construction, events or businesses.' },
  { key: 'air_pollution', label: 'Air Pollution', defaultDepartment: 'Environment', order: 150, description: 'Smoke, dust and industrial emissions.' },
  { key: 'water_pollution', label: 'Water Pollution', defaultDepartment: 'Environment', order: 160, description: 'Polluted drains, water bodies and discharge into drains.' },
  { key: 'public_property_damage', label: 'Public Property Damage', defaultDepartment: 'Roads & Infrastructure', order: 170, description: 'Damage to public buildings, fences, signs and other civic assets.' },
  { key: 'parks_recreation', label: 'Parks & Recreation', defaultDepartment: 'Parks & Recreation', order: 180, description: 'Parks, playgrounds, benches and open-space maintenance.' },
  { key: 'mosquito_pest_control', label: 'Mosquito / Pest Control', defaultDepartment: 'Public Health', order: 190, description: 'Mosquito breeding, rodents, insects and other pest outbreaks.' },
  { key: 'tree_environment', label: 'Tree / Environment', defaultDepartment: 'Environment', order: 200, description: 'Fallen or dangerous trees and green cover maintenance.' },
  { key: 'illegal_construction', label: 'Illegal Construction', defaultDepartment: 'Urban Planning', order: 210, description: 'Unauthorised structures, encroachments and construction without approval.' },
  { key: 'other', label: 'Other', defaultDepartment: 'Other', order: 900, description: 'Anything that does not fit the categories above.' }
];

export const defaultReportDepartments = [
  { name: 'Roads & Infrastructure', code: 'ROADS_INFRASTRUCTURE', icon: 'wrench', color: '#2563eb', description: 'Road network, street lighting, footpaths and public property maintenance.' },
  { name: 'Waste Management', code: 'WASTE_MANAGEMENT', icon: 'trash2', color: '#65a30d', description: 'Solid waste collection, disposal and street cleanliness.' },
  { name: 'Water & Sewerage', code: 'WATER_SEWERAGE', icon: 'droplets', color: '#0891b2', description: 'Water supply, sewerage networks and storm drainage.' },
  { name: 'Electricity', code: 'ELECTRICITY', icon: 'zap', color: '#d97706', description: 'Power distribution and electricity faults.' },
  { name: 'Traffic Management', code: 'TRAFFIC_MANAGEMENT', icon: 'car', color: '#dc2626', description: 'Traffic control, parking enforcement and public transport.' },
  { name: 'Public Health', code: 'PUBLIC_HEALTH', icon: 'hospital', color: '#059669', description: 'Public health, sanitation and vector-borne disease response.' },
  { name: 'Environment', code: 'ENVIRONMENT', icon: 'leaf', color: '#16a34a', description: 'Noise, air and water pollution control and environmental monitoring.' },
  { name: 'Parks & Recreation', code: 'PARKS_RECREATION', icon: 'treeDeciduous', color: '#0f766e', description: 'Parks, playgrounds and open-space maintenance.' },
  { name: 'Public Safety', code: 'PUBLIC_SAFETY', icon: 'shield', color: '#7c3aed', description: 'Citizen security, unsafe situations and public safety response.' },
  { name: 'Urban Planning', code: 'URBAN_PLANNING', icon: 'building2', color: '#db2777', description: 'Land use, construction regulation and development approvals.' },
  { name: 'Other', code: 'OTHER', icon: 'building2', color: '#64748b', description: 'General civic enquiries that do not match a specialist department.' }
];

/** Real-time events pushed to every client when the catalogue changes. */
export const reportCategoryEvents = {
  created: 'REPORT_CATEGORY_CREATED',
  updated: 'REPORT_CATEGORY_UPDATED',
  deleted: 'REPORT_CATEGORY_DELETED',
  restored: 'REPORT_CATEGORY_RESTORED'
};

export const reportCategories = defaultReportCategories.map((category) => category.key);

export const reportDepartments = [
  'Roads & Infrastructure', 'Waste Management', 'Water & Sewerage', 'Electricity', 'Traffic Management', 'Public Health', 'Environment', 'Parks & Recreation', 'Public Safety', 'Urban Planning', 'Other'
];

export const reportPriorities = ['low', 'medium', 'high', 'urgent'];
export const reportStatuses = ['pending', 'verified', 'assigned', 'in_progress', 'under_review', 'completed', 'closed'];
export const editableStatuses = ['pending', 'verified'];
