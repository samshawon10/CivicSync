/**
 * Emergency intelligence helpers.
 *
 * NOTE ON "AI": this project has no external AI/LLM infrastructure (no
 * OPENAI_API_KEY integration exists). Rather than faking an AI service, this
 * module provides a deterministic, transparent, rule-based advisory
 * classifier. Its output is ALWAYS advisory: the Emergency Head can apply,
 * override, or ignore it. It never makes irreversible decisions on its own.
 */
import { sensitiveCategories } from '../config/emergencyOptions.js';

const criticalWords = ['unconscious', 'not breathing', 'chest pain', 'heart attack', 'severe bleeding', 'trapped', 'explosion', 'collapsed', 'dying', 'no pulse', 'choking', 'shot', 'bleeding heavily'];

const categoryRules = [
  { category: 'fire_disaster', responseTypes: ['Fire'], words: ['fire', 'smoke', 'burning', 'blaze', 'gas leak', 'explosion', 'flood', 'earthquake', 'storm', 'landslide', 'building collapse', 'structure collapse'] },
  { category: 'medical', responseTypes: ['Medical'], words: ['injury', 'injured', 'unconscious', 'breathing', 'heart', 'chest pain', 'bleeding', 'ambulance', 'medical', 'fainted', 'seizure', 'stroke', 'fracture', 'accident victim'] },
  { category: 'women_safety', responseTypes: ['Security'], words: ['harassment', 'harassed', 'stalking', 'stalker', 'following me', 'unsafe transport', 'eve teasing', 'molest', 'domestic violence', 'threatening behavior', 'unsafe'] },
  { category: 'child_safety', responseTypes: ['Security'], words: ['child', 'kid', 'minor', 'schoolboy', 'schoolgirl', 'lost child', 'missing child'] },
  { category: 'missing_person', responseTypes: ['Security'], words: ['missing', 'disappeared', 'last seen', 'not seen since', 'lost person', 'elderly missing'] },
  { category: 'road_traffic', responseTypes: ['Medical', 'Security', 'Traffic'], words: ['accident', 'collision', 'crash', 'vehicle', 'car hit', 'bike hit', 'motorcycle', 'pedestrian', 'pothole', 'road block', 'roadblock', 'traffic signal', 'fallen tree', 'road debris', 'road collapse', 'hit and run'] },
  { category: 'security_crime', responseTypes: ['Security'], words: ['robbery', 'robbed', 'theft', 'stolen', 'snatch', 'assault', 'attacked', 'threat', 'suspicious', 'vandalism', 'break in', 'burglary', 'weapon', 'fighting', 'gang'] },
  { category: 'infrastructure', responseTypes: ['Infrastructure'], words: ['manhole', 'exposed wire', 'electric shock', 'live wire', 'utility pole', 'pole fell', 'gas pipeline', 'water pipeline', 'damaged bridge', 'dangerous construction', 'open manhole'] },
  { category: 'environmental_disaster', responseTypes: ['Disaster'], words: ['contamination', 'contaminated water', 'landslide', 'environmental', 'chemical spill', 'pollution incident'] }
];
const subcategoryRules = {
  road_traffic: [{ key: 'road_accident', words: ['accident', 'collision', 'crash', 'hit'] }, { key: 'pedestrian_accident', words: ['pedestrian', 'person hit'] }, { key: 'motorcycle_accident', words: ['motorcycle', 'bike'] }, { key: 'road_blockage', words: ['block', 'blocked', 'blockage'] }, { key: 'fallen_tree', words: ['tree'] }, { key: 'major_pothole_hazard', words: ['pothole'] }],
  fire_disaster: [{ key: 'gas_leak', words: ['gas leak', 'gas smell'] }, { key: 'building_fire', words: ['building fire', 'house fire', 'shop fire'] }, { key: 'electrical_fire', words: ['electrical fire', 'wire fire'] }, { key: 'vehicle_fire', words: ['vehicle fire', 'car fire'] }, { key: 'building_collapse', words: ['collapse', 'collapsed'] }, { key: 'flood', words: ['flood', 'flooding', 'waterlogged'] }, { key: 'earthquake', words: ['earthquake'] }, { key: 'storm', words: ['storm', 'cyclone'] }],
  medical: [{ key: 'heart_emergency', words: ['heart', 'chest pain'] }, { key: 'unconscious_person', words: ['unconscious', 'unresponsive', 'fainted'] }, { key: 'breathing_difficulty', words: ['breathing', 'choking', 'asthma'] }, { key: 'severe_bleeding', words: ['bleeding', 'blood'] }, { key: 'serious_injury', words: ['injured', 'injury', 'fracture', 'broken'] }, { key: 'ambulance_request', words: ['ambulance'] }],
  missing_person: [{ key: 'missing_child', words: ['child', 'kid', 'minor'] }, { key: 'missing_elderly_person', words: ['elderly', 'old person', 'senior'] }, { key: 'vulnerable_person_missing', words: ['vulnerable', 'patient', 'disability'] }],
  security_crime: [{ key: 'robbery', words: ['robbery', 'robbed'] }, { key: 'theft', words: ['theft', 'stolen', 'stole'] }, { key: 'snatching', words: ['snatch', 'chain snatching'] }, { key: 'assault', words: ['assault', 'attacked', 'beat'] }, { key: 'break_in', words: ['break in', 'burglary', 'forced entry'] }, { key: 'crime_in_progress', words: ['in progress', 'right now', 'currently'] }],
  women_safety: [{ key: 'stalking', words: ['stalking', 'stalker', 'following me'] }, { key: 'harassment', words: ['harassment', 'harassed', 'eve teasing'] }, { key: 'domestic_violence_emergency', words: ['domestic violence', 'husband beating', 'home violence'] }, { key: 'unsafe_transport', words: ['unsafe transport', 'driver unsafe', 'rickshaw unsafe', 'cab unsafe'] }, { key: 'threatening_behavior', words: ['threatening', 'threat'] }, { key: 'unsafe_public_area', words: ['unsafe area', 'dark area', 'no one around'] }],
  child_safety: [{ key: 'missing_child', words: ['missing', 'lost'] }, { key: 'child_harassment', words: ['harassment', 'harassed', 'abuse'] }, { key: 'child_medical_emergency', words: ['injured', 'medical', 'fainted', 'bleeding'] }],
  infrastructure: [{ key: 'open_manhole', words: ['manhole'] }, { key: 'electrical_hazard', words: ['wire', 'electric', 'shock'] }, { key: 'damaged_bridge', words: ['bridge'] }, { key: 'fallen_utility_pole', words: ['pole'] }, { key: 'gas_pipeline_hazard', words: ['gas'] }]
};

function matchScore(text, words) {
  return words.reduce((score, word) => (text.includes(word) ? score + word.split(' ').length : score), 0);
}

export function isSensitiveCategory(category) {
  return sensitiveCategories.includes(category);
}

/** Advisory classification from free text. Reversible, human-approvable only. */
export function suggestEmergencyClassification(title = '', description = '') {
  const text = `${title} ${description}`.toLowerCase().trim();
  const summary = String(description || title || '').trim().slice(0, 300);
  if (!text) return { category: 'not_sure', subcategory: 'other', severity: 'high', responseTypes: [], summary: '', confidence: 'low', source: 'rule_engine', suggestedAt: new Date() };
  const scored = categoryRules
    .map((rule) => ({ ...rule, score: matchScore(text, rule.words) }))
    .filter((rule) => rule.score > 0)
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  const severity = criticalWords.some((word) => text.includes(word)) ? 'critical' : 'high';
  if (!best) return { category: 'not_sure', subcategory: 'other', severity, responseTypes: [], summary, confidence: 'low', source: 'rule_engine', suggestedAt: new Date() };
  const subRules = subcategoryRules[best.category] || [];
  let subcategory = subRules
    .map((rule) => ({ key: rule.key, score: matchScore(text, rule.words) }))
    .filter((rule) => rule.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.key || '';
  if (!subcategory && best.category === 'missing_person') subcategory = 'missing_person';
  if (!subcategory) subcategory = 'other';
  return { category: best.category, subcategory, severity, responseTypes: best.responseTypes, summary, confidence: best.score >= 2 ? 'high' : 'medium', source: 'rule_engine', suggestedAt: new Date() };
}

/** Great-circle distance in kilometers. */
export function haversineKm(lat1, lon1, lat2, lon2) {
  if (![lat1, lon1, lat2, lon2].every((value) => Number.isFinite(Number(value)))) return null;
  const toRad = (value) => (Number(value) * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

/** Map an emergency category to the response team types that usually apply. */
export function suggestedTeamTypes(category) {
  return ({
    medical: ['medical'],
    fire_disaster: ['fire'],
    security_crime: ['security'],
    women_safety: ['security'],
    child_safety: ['security'],
    missing_person: ['security'],
    road_traffic: ['medical', 'security', 'traffic'],
    infrastructure: ['infrastructure'],
    environmental_disaster: ['disaster', 'rescue']
  })[category] || [];
}