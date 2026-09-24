import {
  Ambulance, Building2, Construction, Cross, Droplets, Flame, Hospital, House,
  Landmark, MoonStar, Phone, Pill, School, Shield, ShieldCheck, Siren,
  Stethoscope, Toilet, TriangleAlert, Waves
} from 'lucide-react';
import L from 'leaflet';
import { facilityTypeLabels } from '../../services/emergencyService.js';

const iconMap = {
  emergency_center: Siren,
  ambulance: Ambulance,
  fire_station: Flame,
  police: Shield,
  safe_point: ShieldCheck,
  shelter: House,
  flood_shelter: Waves,
  hazard: TriangleAlert,
  road_blockage: Construction,
  hospital: Hospital,
  pharmacy: Pill,
  clinic: Stethoscope,
  first_aid_center: Cross,
  mosque: MoonStar,
  school: School,
  government_office: Landmark,
  help_center: Phone,
  safe_water_point: Droplets,
  public_toilet: Toilet
};

const colors = {
  emergency_center: '#dc2626', ambulance: '#e11d48', fire_station: '#ea580c', police: '#1d4ed8', safe_point: '#059669', shelter: '#7c3aed', flood_shelter: '#0369a1', hazard: '#b45309', road_blockage: '#475569', hospital: '#dc2626', pharmacy: '#16a34a', clinic: '#0891b2', first_aid_center: '#ea580c', mosque: '#047857', school: '#7c3aed', government_office: '#334155', help_center: '#2563eb', safe_water_point: '#0284c7', public_toilet: '#4f46e5'
};

const shortLabels = {
  emergency_center: 'EC', ambulance: 'A', fire_station: 'FS', police: 'P', safe_point: 'S', shelter: 'SH', flood_shelter: 'FL', hazard: '!', road_blockage: 'RB', hospital: 'H', pharmacy: 'Rx', clinic: 'C', first_aid_center: '+', mosque: 'M', school: 'SC', government_office: 'G', help_center: 'HC', safe_water_point: 'W', public_toilet: 'PT'
};

export function FacilityIcon({ type, size = 18, ...props }) {
  const Icon = iconMap[type] || Building2;
  return <Icon size={size} aria-hidden="true" {...props} />;
}

export const facilityColor = (type) => colors[type] || '#2563eb';
export const facilityLabel = (type) => facilityTypeLabels[type] || String(type || 'Service').replaceAll('_', ' ');

export function createFacilityIcon(type) {
  const color = facilityColor(type);
  return L.divIcon({
    className: 'civic-map-marker-wrapper',
    html: `<div class="civic-map-marker civic-map-marker--service" style="--marker-color:${color}" title="${facilityLabel(type)}"><span>${shortLabels[type] || '+'}</span></div>`,
    iconSize: [38, 46], iconAnchor: [19, 44], popupAnchor: [0, -40]
  });
}

export function createEmergencyIcon(severity = 'high', selected = false) {
  const color = { critical: '#dc2626', high: '#f97316', medium: '#eab308', low: '#64748b' }[severity] || '#2563eb';
  return L.divIcon({
    className: 'civic-map-marker-wrapper',
    html: `<div class="civic-map-marker civic-map-marker--emergency${selected ? ' is-selected' : ''}" style="--marker-color:${color}" title="Active emergency"><span>!</span></div>`,
    iconSize: [40, 48], iconAnchor: [20, 46], popupAnchor: [0, -42]
  });
}

export function createUserLocationIcon() {
  return L.divIcon({
    className: 'civic-map-marker-wrapper',
    html: '<div class="civic-user-marker" title="Your current location"><span></span></div>',
    iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -14]
  });
}

export function createClusterIcon(cluster) {
  const count = cluster.getChildCount();
  const size = count > 100 ? 48 : count > 25 ? 44 : 40;
  return L.divIcon({
    className: 'civic-map-cluster-wrapper',
    html: `<div class="civic-map-cluster" style="--cluster-size:${size}px"><span>${count}</span></div>`,
    iconSize: [size, size], iconAnchor: [size / 2, size / 2]
  });
}
