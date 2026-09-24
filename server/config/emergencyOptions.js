export const emergencyStatuses = ['reported', 'received', 'assessing', 'verified', 'dispatched', 'en_route', 'on_scene', 'responding', 'resolved', 'closed', 'cancelled', 'false_report', 'reassigned', 'escalated', 'requires_backup'];
export const emergencySeverities = ['low', 'medium', 'high', 'critical'];
export const emergencyCategories = [
  'medical', 'fire_disaster', 'security_crime', 'women_safety', 'child_safety',
  'missing_person', 'road_traffic', 'infrastructure', 'environmental_disaster', 'other', 'not_sure'
];
export const activeEmergencyStatuses = emergencyStatuses.filter((status) => !['resolved', 'closed', 'cancelled', 'false_report', 'reassigned'].includes(status));
export const emergencyRoleGroups = {
  // Only the Emergency Head and Super Admin can perform command operations.
  command: ['admin', 'emergency_department_head'],
  // The department-officer key is retained as a compatibility alias for older records,
  // but it is deliberately not granted command authority.
  responders: ['emergency_department_officer', 'emergency_officer', 'emergency_field_worker'],
  allStaff: ['admin', 'emergency_department_head', 'emergency_department_officer', 'emergency_officer', 'emergency_field_worker']
};

// Categories whose details require granular visibility (never exposed on public aggregates).
export const sensitiveCategories = ['women_safety', 'child_safety', 'missing_person', 'security_crime'];

// Lifecycle of an individual EmergencyResponseAssignment.
export const assignmentStatuses = ['assigned', 'accepted', 'en_route', 'on_scene', 'responding', 'completed', 'cancelled'];

// Suggested response branch labels (free text is still allowed when dispatching).
export const responseTypes = ['Medical', 'Fire', 'Security', 'Traffic', 'Disaster', 'Rescue', 'Infrastructure', 'Other'];

export const emergencyTypeCatalog = [
  { key: 'medical', label: 'Medical', subcategories: ['medical_emergency', 'serious_injury', 'unconscious_person', 'breathing_difficulty', 'heart_emergency', 'severe_bleeding', 'elderly_assistance', 'ambulance_request', 'public_medical_incident'] },
  { key: 'fire_disaster', label: 'Fire & Disaster', subcategories: ['building_fire', 'electrical_fire', 'vehicle_fire', 'gas_leak', 'explosion', 'smoke_hazard', 'flood', 'earthquake', 'storm', 'natural_disaster', 'building_collapse'] },
  { key: 'security_crime', label: 'Security & Crime', subcategories: ['crime_in_progress', 'robbery', 'theft', 'snatching', 'assault', 'threat', 'suspicious_activity', 'vandalism', 'break_in', 'public_safety_threat'] },
  { key: 'women_safety', label: 'Women Safety', subcategories: ['harassment', 'sexual_harassment', 'stalking', 'following', 'threatening_behavior', 'unsafe_public_area', 'domestic_violence_emergency', 'attempted_assault', 'suspicious_person', 'unsafe_transport'] },
  { key: 'child_safety', label: 'Child Safety', subcategories: ['missing_child', 'lost_child', 'child_harassment', 'child_abuse_emergency', 'suspicious_person_around_child', 'child_medical_emergency', 'school_area_safety'] },
  { key: 'missing_person', label: 'Missing Person', subcategories: ['missing_person', 'missing_child', 'missing_elderly_person', 'vulnerable_person_missing'] },
  { key: 'road_traffic', label: 'Road & Traffic', subcategories: ['road_accident', 'vehicle_collision', 'motorcycle_accident', 'pedestrian_accident', 'road_blockage', 'traffic_emergency', 'dangerous_road', 'fallen_tree', 'broken_traffic_signal', 'major_pothole_hazard', 'road_collapse', 'vehicle_fire', 'road_debris'] },
  { key: 'infrastructure', label: 'Infrastructure', subcategories: ['building_hazard', 'electrical_hazard', 'gas_pipeline_hazard', 'water_pipeline_emergency', 'dangerous_construction', 'infrastructure_failure', 'open_manhole', 'damaged_bridge', 'fallen_utility_pole'] },
  { key: 'environmental_disaster', label: 'Environmental & Disaster', subcategories: ['flood', 'landslide', 'severe_storm', 'water_contamination', 'environmental_incident'] },
  { key: 'other', label: 'Other', subcategories: ['other'] },
  { key: 'not_sure', label: "I'm not sure", subcategories: ['other'] }
];
