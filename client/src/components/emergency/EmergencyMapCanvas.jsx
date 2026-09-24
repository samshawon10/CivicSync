import { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css';
import { directionsUrl, label } from '../../services/emergencyService.js';
import { FacilityIcon, createClusterIcon, createEmergencyIcon, createFacilityIcon, createUserLocationIcon } from './mapVisuals.jsx';

const DEFAULT_CENTER = [23.8103, 90.4125];
const DEFAULT_ZOOM = 11;
const categoryChips = [
  ['all', 'All'], ['medical', 'Medical'], ['fire_disaster', 'Fire / disaster'], ['security_crime', 'Security'],
  ['women_safety', 'Women safety'], ['child_safety', 'Child safety'], ['missing_person', 'Missing'],
  ['road_traffic', 'Accident / traffic'], ['infrastructure', 'Infrastructure'], ['environmental_disaster', 'Environmental']
];

function hotspotLevel(area, maximum) {
  if (maximum <= 1) return 'low';
  const ratio = Number(area.count || 0) / maximum;
  if (ratio >= 0.67) return 'high';
  if (ratio >= 0.34) return 'medium';
  return 'low';
}

function validPoint(item) {
  const latitude = Number(item?.latitude);
  const longitude = Number(item?.longitude);
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
    && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

function FitBounds({ points, enabled }) {
  const map = useMap();
  const lastKey = useRef('');
  useEffect(() => {
    if (!enabled || !points.length) return;
    const key = points.map((point) => point.join(',')).join('|');
    if (key === lastKey.current) return;
    lastKey.current = key;
    map.fitBounds(L.latLngBounds(points).pad(0.2), { maxZoom: 15 });
  }, [points, enabled, map]);
  return null;
}

function ClickCapture({ onMapClick }) {
  const map = useMap();
  useEffect(() => {
    if (!onMapClick) return undefined;
    const handler = (event) => onMapClick({ latitude: Number(event.latlng.lat.toFixed(6)), longitude: Number(event.latlng.lng.toFixed(6)) });
    map.on('click', handler);
    return () => map.off('click', handler);
  }, [map, onMapClick]);
  return null;
}

function EmergencyPopup({ item, detailsHref }) {
  const href = detailsHref?.(item);
  return (
    <Popup>
      <div className="min-w-44 text-sm">
        <p className="font-black text-ink">{item.emergencyId || 'Emergency'}</p>
        <p className="font-semibold">{item.title || label(item.category)}</p>
        <p className="mt-1 text-xs text-slate-500">{label(item.category)} · {label(item.severity)} · {label(item.status)}</p>
        <p className="text-xs text-slate-500">Reported {new Date(item.createdAt).toLocaleString()}</p>
        {item.assignedDepartment?.name || item.emergencyHead?.name || item.responseAssignments?.length ? <p className="mt-1 text-xs font-semibold text-slate-600">Response: {[item.assignedDepartment?.name, item.emergencyHead?.name, ...(item.responseAssignments || []).map((assignment) => `${assignment.responseType || 'Team'} (${label(assignment.status)})`)].filter(Boolean).join(' · ')}</p> : null}
        {href ? <a className="mt-2 inline-flex text-xs font-bold text-civic-600 hover:underline" href={href}>View details</a> : null}
      </div>
    </Popup>
  );
}

function FacilityPopup({ facility, origin, onDetails }) {
  const directions = directionsUrl(facility, origin);
  return (
    <Popup>
      <div className="min-w-48 text-sm">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 text-civic-600"><FacilityIcon type={facility.type} size={18} /></span>
          <div><p className="font-black text-ink">{facility.name}</p><p className="text-xs text-slate-500">{label(facility.type)}{facility.distanceKm != null ? ` · ${facility.distanceKm} km` : ''}</p></div>
        </div>
        {facility.address ? <p className="mt-2 text-xs text-slate-600">{facility.address}</p> : null}
        <p className="mt-1 text-xs font-semibold" style={{ color: facility.active === false ? '#b45309' : '#047857' }}>{facility.active === false ? 'Inactive' : facility.available === false ? 'Temporarily unavailable' : 'Available'}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
          {facility.phone ? <a className="text-civic-600" href={`tel:${facility.phone}`}>Contact</a> : null}
          {directions ? <a className="text-civic-600" href={directions} target="_blank" rel="noreferrer">Get directions</a> : null}
          {onDetails ? <button type="button" className="text-civic-600" onClick={() => onDetails(facility)}>View details</button> : null}
        </div>
      </div>
    </Popup>
  );
}

export default function EmergencyMap({
  emergencies = [], hotspots = [], facilities = [], responders = [], userLocation = null, selectedId = null,
  onSelect, onFacilitySelect, onMapClick, emergencyDetailsHref, height = 'h-96', showControls = true,
  autoFit = true, center = DEFAULT_CENTER, zoom = DEFAULT_ZOOM, cluster = true
}) {
  const [category, setCategory] = useState('all');
  const [showHotspots, setShowHotspots] = useState(true);
  const [showFacilities, setShowFacilities] = useState(true);
  const [showResponders, setShowResponders] = useState(true);
  const [criticalOnly, setCriticalOnly] = useState(false);

  const located = useMemo(() => emergencies.filter((item) => validPoint(item.location)), [emergencies]);
  const visible = useMemo(() => located.filter((item) => (category === 'all' || item.category === category) && (!criticalOnly || item.severity === 'critical')), [located, category, criticalOnly]);
  const serviceRows = useMemo(() => facilities.filter(validPoint), [facilities]);
  const maxHotspotCount = useMemo(() => Math.max(0, ...hotspots.map((area) => Number(area.count) || 0)), [hotspots]);
  const points = useMemo(() => [
    ...visible.map((item) => [Number(item.location.latitude), Number(item.location.longitude)]),
    ...(showHotspots ? hotspots.filter((area) => validPoint(area?._id)) : []).map((area) => [Number(area._id.latitude), Number(area._id.longitude)]),
    ...(showFacilities ? serviceRows : []).map((item) => [Number(item.latitude), Number(item.longitude)]),
    ...(showResponders ? responders.filter(validPoint) : []).map((item) => [Number(item.latitude), Number(item.longitude)]),
    ...(validPoint(userLocation) ? [[Number(userLocation.latitude), Number(userLocation.longitude)]] : [])
  ], [visible, hotspots, serviceRows, responders, showHotspots, showFacilities, showResponders, userLocation]);

  const incidentMarkers = visible.map((item) => (
    <Marker key={item._id} position={[item.location.latitude, item.location.longitude]} icon={createEmergencyIcon(item.severity, selectedId === item._id)} eventHandlers={onSelect ? { click: () => onSelect(item) } : undefined}>
      <EmergencyPopup item={item} detailsHref={emergencyDetailsHref} />
    </Marker>
  ));
  const facilityMarkers = showFacilities ? serviceRows.map((facility) => (
    <Marker key={facility._id} position={[facility.latitude, facility.longitude]} icon={createFacilityIcon(facility.type)}>
      <FacilityPopup facility={facility} origin={userLocation} onDetails={onFacilitySelect} />
    </Marker>
  )) : [];
  const markers = cluster ? (
    <MarkerClusterGroup chunkedLoading maxClusterRadius={55} iconCreateFunction={createClusterIcon}>{incidentMarkers}{facilityMarkers}</MarkerClusterGroup>
  ) : <>{incidentMarkers}{facilityMarkers}</>;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {showControls ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
          {categoryChips.map(([key, text]) => <button key={key} type="button" aria-pressed={category === key} onClick={() => setCategory(key)} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${category === key ? 'bg-ink text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{text}</button>)}
          <span className="mx-1 h-4 w-px bg-slate-300" />
          {[
            ['Critical only', criticalOnly, () => setCriticalOnly((value) => !value), 'bg-red-600'],
            ['Density', showHotspots, () => setShowHotspots((value) => !value), 'bg-amber-500'],
            ['Services', showFacilities, () => setShowFacilities((value) => !value), 'bg-emerald-600'],
            ['Responders', showResponders, () => setShowResponders((value) => !value), 'bg-indigo-600']
          ].map(([text, active, action, color]) => <button key={text} type="button" aria-pressed={active} onClick={action} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${active ? `${color} text-white` : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{text}</button>)}
        </div>
      ) : null}
      <MapContainer center={center} zoom={zoom} className={height} scrollWheelZoom style={{ height: '100%' }}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitBounds points={points} enabled={autoFit} />
        <ClickCapture onMapClick={onMapClick} />
        {markers}

        {showHotspots ? hotspots.filter((area) => validPoint(area?._id)).map((area, index) => {
          const level = hotspotLevel(area, maxHotspotCount);
          const colors = { high: ['#dc2626', '#ef4444'], medium: ['#ea580c', '#f97316'], low: ['#ca8a04', '#facc15'] }[level];
          return (
          <Circle key={`${area._id.latitude}-${area._id.longitude}-${area._id.category}-${index}`} center={[area._id.latitude, area._id.longitude]} radius={250 + Math.min(area.count, 20) * 140} pathOptions={{ color: colors[0], fillColor: colors[1], fillOpacity: Math.min(0.06 + area.count * 0.025, 0.36) }}>
            <Popup><div className="text-sm"><p className="font-black">{area.active ? 'Active emergency area' : `${level[0].toUpperCase()}${level.slice(1)} reported concentration`}</p><p>{area.count} actual report(s) · {label(area._id.category)}</p><p className="text-xs text-slate-500">Relative density only. Location is aggregated; no individual position is shown.</p></div></Popup>
          </Circle>
          );
        }) : null}

        {showResponders ? responders.filter(validPoint).map((position) => (
          <CircleMarker key={position.responder?._id || position._id} center={[position.latitude, position.longitude]} radius={8} pathOptions={{ color: '#4338ca', fillColor: '#6366f1', fillOpacity: 0.85, weight: 2 }}>
            <Popup><div className="text-sm"><p className="font-black">{position.responder?.name || 'Responder'}</p><p className="text-xs text-slate-500">{label(position.responder?.role)} · updated {new Date(position.recordedAt).toLocaleTimeString()}</p></div></Popup>
          </CircleMarker>
        )) : null}
        {validPoint(userLocation) ? (
          <Marker position={[userLocation.latitude, userLocation.longitude]} icon={createUserLocationIcon()}>
            <Popup><div className="text-sm"><p className="font-black">Your current location</p>{Number.isFinite(Number(userLocation.accuracy)) ? <p className="text-xs text-slate-500">Accuracy ±{Math.round(Number(userLocation.accuracy))} m · visible only in this session</p> : null}</div></Popup>
          </Marker>
        ) : null}
      </MapContainer>
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 bg-white px-3 py-2 text-[11px] text-slate-500">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-600" /> Active / high concentration</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> Medium concentration</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-yellow-400" /> Low concentration</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> Public service</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-indigo-600" /> Responder</span>
        {!points.length ? <span className="font-semibold text-slate-400">No mapped data for the current filters.</span> : null}
      </div>
    </div>
  );
}


