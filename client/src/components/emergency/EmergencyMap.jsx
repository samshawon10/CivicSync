import { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { label } from '../../services/emergencyService.js';

const DEFAULT_CENTER = [23.8103, 90.4125]; // Dhaka fallback until data/user location is available
const DEFAULT_ZOOM = 11;

const severityColor = (severity) => ({ critical: '#dc2626', high: '#f97316', medium: '#f59e0b', low: '#64748b' }[severity] || '#2563eb');

function FitBounds({ points, enabled }) {
  const map = useMap();
  const lastKey = useRef('');
  useEffect(() => {
    if (!enabled || !points.length) return;
    const key = points.map((point) => point.join(',')).join('|');
    if (key === lastKey.current) return;
    lastKey.current = key;
    map.fitBounds(L.latLngBounds(points).pad(0.2), { maxZoom: 14 });
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

const categoryChips = [
  ['all', 'All'],
  ['medical', 'Medical'],
  ['fire_disaster', 'Fire/Disaster'],
  ['security_crime', 'Security'],
  ['women_safety', 'Women Safety'],
  ['child_safety', 'Child Safety'],
  ['missing_person', 'Missing'],
  ['road_traffic', 'Accident/Traffic'],
  ['infrastructure', 'Infrastructure'],
  ['environmental_disaster', 'Environmental']
];

/**
 * Emergency GIS map: live incidents (severity-colored), reported-incident
 * density areas, safety services, and responder positions — each toggleable.
 */
export default function EmergencyMap({
  emergencies = [],
  hotspots = [],
  facilities = [],
  responders = [],
  selectedId = null,
  onSelect,
  onMapClick,
  height = 'h-96',
  showControls = true,
  autoFit = true,
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM
}) {
  const [category, setCategory] = useState('all');
  const [showHotspots, setShowHotspots] = useState(true);
  const [showFacilities, setShowFacilities] = useState(true);
  const [showResponders, setShowResponders] = useState(true);
  const [criticalOnly, setCriticalOnly] = useState(false);

  const located = useMemo(() => emergencies.filter((item) => Number.isFinite(item.location?.latitude) && Number.isFinite(item.location?.longitude)), [emergencies]);
  const visible = useMemo(() => located.filter((item) => (category === 'all' || item.category === category) && (!criticalOnly || item.severity === 'critical')), [located, category, criticalOnly]);

  const points = useMemo(() => [
    ...visible.map((item) => [item.location.latitude, item.location.longitude]),
    ...((showHotspots ? hotspots : [])).map((area) => [area._id?.latitude, area._id?.longitude]).filter(([lat]) => Number.isFinite(lat)),
    ...((showFacilities ? facilities : [])).map((facility) => [facility.latitude, facility.longitude]).filter(([lat]) => Number.isFinite(lat)),
    ...((showResponders ? responders : [])).map((position) => [position.latitude, position.longitude]).filter(([lat]) => Number.isFinite(lat))
  ], [visible, hotspots, facilities, responders, showHotspots, showFacilities, showResponders]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {showControls && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
          {categoryChips.map(([key, text]) => (
            <button key={key} onClick={() => setCategory(key)} className={`rounded-full px-2.5 py-1 text-[11px] font-black transition ${category === key ? 'bg-ink text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-civic-300'}`}>{text}</button>
          ))}
          <span className="mx-1 h-4 w-px bg-slate-300" />
          <button onClick={() => setCriticalOnly((value) => !value)} className={`rounded-full px-2.5 py-1 text-[11px] font-black transition ${criticalOnly ? 'bg-red-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>Critical only</button>
          <button onClick={() => setShowHotspots((value) => !value)} className={`rounded-full px-2.5 py-1 text-[11px] font-black transition ${showHotspots ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>Density</button>
          <button onClick={() => setShowFacilities((value) => !value)} className={`rounded-full px-2.5 py-1 text-[11px] font-black transition ${showFacilities ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>Services</button>
          <button onClick={() => setShowResponders((value) => !value)} className={`rounded-full px-2.5 py-1 text-[11px] font-black transition ${showResponders ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>Responders</button>
        </div>
      )}
      <MapContainer center={center} zoom={zoom} className={height} scrollWheelZoom style={{ height: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} enabled={autoFit} />
        <ClickCapture onMapClick={onMapClick} />

        {visible.map((item) => (
          <CircleMarker
            key={item._id}
            center={[item.location.latitude, item.location.longitude]}
            radius={selectedId === item._id ? 14 : 10}
            pathOptions={{ color: severityColor(item.severity), fillColor: severityColor(item.severity), fillOpacity: item.severity === 'critical' ? 0.9 : 0.7, weight: selectedId === item._id ? 4 : 2 }}
            eventHandlers={onSelect ? { click: () => onSelect(item) } : undefined}
          >
            <Popup>
              <div className="min-w-40 text-sm">
                <p className="font-black">{item.emergencyId}</p>
                <p>{item.title || label(item.category)}</p>
                <p className="text-xs text-slate-500">{label(item.category)} · {label(item.severity)} · {label(item.status)}</p>
                <p className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {showHotspots && hotspots.filter((area) => Number.isFinite(area._id?.latitude)).map((area, index) => (
          <Circle
            key={`${area._id.latitude}-${area._id.longitude}-${area._id.category}-${index}`}
            center={[area._id.latitude, area._id.longitude]}
            radius={250 + Math.min(area.count, 20) * 140}
            pathOptions={{ color: '#d97706', weight: 1, fillColor: '#f59e0b', fillOpacity: Math.min(0.05 + area.count * 0.03, 0.4) }}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-black">Reported Incident Area</p>
                <p>{area.count} report(s) · {label(area._id.category)}</p>
                <p className="text-xs text-slate-500">Latest: {new Date(area.latestAt).toLocaleString()}</p>
                <p className="mt-1 text-xs text-slate-500">Based on citizen reports — not a guarantee of risk.</p>
              </div>
            </Popup>
          </Circle>
        ))}

        {showFacilities && facilities.filter((facility) => Number.isFinite(facility.latitude)).map((facility) => (
          <CircleMarker key={facility._id} center={[facility.latitude, facility.longitude]} radius={9} pathOptions={{ color: '#047857', fillColor: '#10b981', fillOpacity: 0.85, weight: 2 }}>
            <Popup>
              <div className="min-w-40 text-sm">
                <p className="font-black">{facility.name}</p>
                <p className="text-xs capitalize text-slate-500">{label(facility.type)}{facility.distanceKm != null ? ` · ${facility.distanceKm} km` : ''}</p>
                <p className="text-xs text-slate-500">{facility.address}</p>
                {facility.phone && <a className="text-xs font-bold text-civic-600" href={`tel:${facility.phone}`}>Call {facility.phone}</a>}
                <br />
                <a className="text-xs font-bold text-civic-600" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/directions?to=${facility.latitude}%2C${facility.longitude}`}>Directions</a>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {showResponders && responders.filter((position) => Number.isFinite(position.latitude)).map((position) => (
          <CircleMarker key={`${position.responder?._id || position._id}`} center={[position.latitude, position.longitude]} radius={8} pathOptions={{ color: '#4338ca', fillColor: '#6366f1', fillOpacity: 0.85, weight: 2 }}>
            <Popup>
              <div className="text-sm">
                <p className="font-black">{position.responder?.name || 'Responder'}</p>
                <p className="text-xs text-slate-500">{label(position.responder?.role)} · updated {new Date(position.recordedAt).toLocaleTimeString()}</p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 bg-white px-3 py-2 text-[11px] text-slate-500">
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-red-600" /> Critical</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-500" /> High</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" /> Medium</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-500" /> Low</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" /> Services</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-indigo-500" /> Responders</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" /> Density</span>
        {!points.length && <span className="font-semibold text-slate-400">No mapped data for the current filters.</span>}
      </div>
    </div>
  );
}