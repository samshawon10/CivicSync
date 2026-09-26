import { useEffect, useMemo, useState } from 'react';
import { Filter, Layers3, LocateFixed, MapPin, Navigation, Search, ShieldCheck, Siren, X } from 'lucide-react';
import CitizenLayout from '../../components/citizen/CitizenLayout.jsx';
import EmergencyMap from '../../components/emergency/EmergencyMap.jsx';
import NearbyServiceCard from '../../components/emergency/NearbyServiceCard.jsx';
import PageHead from '../../components/ui/PageHead.jsx';
import { emergencyApi, facilitiesApi, facilityGroups, facilityTypeLabels, nearestHelpTypes } from '../../services/emergencyService.js';
import { apiMessage } from '../../services/api.js';
import useGeolocation from '../../hooks/useGeolocation.js';
import AIBriefingCard from '../../components/ai/AIBriefingCard.jsx';

const densityRanges = [[7, '7 days'], [30, '30 days'], [90, '3 months'], [180, '6 months'], [365, '1 year']];
const incidentCategories = [
  ['', 'All incident types'], ['medical', 'Medical'], ['fire_disaster', 'Fire / disaster'], ['security_crime', 'Security / crime'],
  ['road_traffic', 'Accident / road hazard'], ['women_safety', 'Women safety'], ['child_safety', 'Child safety'],
  ['missing_person', 'Missing person'], ['infrastructure', 'Infrastructure'], ['environmental_disaster', 'Environmental'], ['other', 'Other'], ['not_sure', 'Not sure']
];

function normaliseArea(area = {}, active = false) {
  const id = area._id || {};
  const latitude = Number(id.latitude);
  const longitude = Number(id.longitude);
  return {
    _id: { latitude, longitude, category: id.category || 'other' },
    count: Math.max(0, Number(area.count) || 0),
    latestAt: area.latestAt || null,
    active
  };
}


function FilterGroup({ group, available, selected, onToggle, onAll }) {
  const visibleTypes = group.types.filter((type) => available.has(type));
  if (!visibleTypes.length) return null;
  return (
    <fieldset className="border-t border-slate-100 dark:border-slate-800 py-3 first:border-t-0">
      <legend className="mb-2 flex w-full items-center justify-between text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {group.label}
        <button type="button" className="text-[11px] font-bold normal-case tracking-normal text-civic-600 dark:text-civic-300" onClick={() => onAll(group.types, visibleTypes)}>Select all</button>
      </legend>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {visibleTypes.map((type) => (
          <label key={type} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm hover:bg-slate-50 hover:bg-slate-800">
            <input type="checkbox" checked={selected.has(type)} onChange={() => onToggle(type)} className="h-4 w-4 accent-civic-600" />
            <span>{facilityTypeLabels[type]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function SafetyMap() {
  const [days, setDays] = useState(30);
  const [incidentCategory, setIncidentCategory] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTypes, setSelectedTypes] = useState(() => new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showActiveAreas, setShowActiveAreas] = useState(true);
  const [showDensity, setShowDensity] = useState(true);
  const [facilities, setFacilities] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [activeAreas, setActiveAreas] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [location, setLocation] = useState(null);
  const [locationState, setLocationState] = useState('idle');
  const [nearest, setNearest] = useState([]);
  const [nearestBusy, setNearestBusy] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const geolocation = useGeolocation();

  async function load() {
    setLoading(true);
    try {
      const [densityResult, activeResult, facilityResult] = await Promise.all([
        emergencyApi.hotspots({ days, category: incidentCategory, minCount: 2 }),
        emergencyApi.hotspots({ days, category: incidentCategory, minCount: 1, activeOnly: true }),
        facilitiesApi.list({ active: true, limit: 500 })
      ]);
      setHotspots((densityResult.data.areas || []).map((area) => normaliseArea(area)));
      setActiveAreas((activeResult.data.areas || []).map((area) => normaliseArea(area, true)));
      setMeta(densityResult.data);
      setFacilities(facilityResult.data.facilities || []);
      setError('');
    } catch (err) { setError(apiMessage(err)); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [days, incidentCategory]);

  useEffect(() => {
    const available = new Set(facilities.map((facility) => facility.type));
    setSelectedTypes((current) => current.size ? new Set([...current].filter((type) => available.has(type))) : new Set(available));
  }, [facilities]);

  const availableTypes = useMemo(() => new Set(facilities.filter((facility) => facility.active !== false).map((facility) => facility.type)), [facilities]);
  const visibleFacilities = useMemo(() => {
    const term = search.trim().toLowerCase();
    return facilities.filter((facility) => selectedTypes.has(facility.type) && (!term || `${facility.name} ${facility.address || ''} ${facilityTypeLabels[facility.type] || ''}`.toLowerCase().includes(term)));
  }, [facilities, selectedTypes, search]);

  function toggleType(type) {
    setSelectedTypes((current) => { const next = new Set(current); if (next.has(type)) next.delete(type); else next.add(type); return next; });
  }

  function selectGroup(types, visible) {
    setSelectedTypes((current) => { const next = new Set(current); const allSelected = visible.every((type) => next.has(type)); visible.forEach((type) => allSelected ? next.delete(type) : next.add(type)); return next; });
  }

  async function shareLocation() {
    setLocationState('requesting');
    const result = await geolocation.capture();
    if (!result.ok) { setLocationState('error'); return; }
    setLocation(result.location);
    setLocationState('detected');
  }

  async function findNearestHelp() {
    let origin = location;
    if (!origin) {
      setLocationState('requesting');
      const result = await geolocation.capture();
      if (!result.ok) { setLocationState('error'); return; }
      origin = result.location;
      setLocation(origin);
      setLocationState('detected');
    }
    setNearestBusy(true);
    try {
      const { data } = await facilitiesApi.nearby({ lat: origin.latitude, lng: origin.longitude, types: nearestHelpTypes, nearestPerType: true, limit: 50 });
      setNearest(data.facilities || []);
    } catch (err) { toastlessError(apiMessage(err)); } finally { setNearestBusy(false); }
  }

  function toastlessError(message) { setError(message); }
  const allAreas = useMemo(() => [
    ...(showActiveAreas ? activeAreas : []),
    ...(showDensity ? hotspots : [])
  ], [activeAreas, hotspots, showActiveAreas, showDensity]);

  return (
    <CitizenLayout title="Safety Map">
      <PageHead title="Smart Safety Map" description="Interactive civic safety map with real public services, aggregated incident density, and nearest emergency help." />
      <section className="mt-4"><AIBriefingCard presetKey="map" context={{ areaLabel: location ? 'Current map area' : 'All areas' }} title="Ask about this map" subtitle="Safety information for what you're looking at" description="Ask about nearby safety facilities, active emergencies or services in this area. CivicSync Intelligence answers from real CivicSync data for your location." actionLabel="Ask About This Map" className="border-civic-200 bg-civic-50/50 dark:border-civic-900 dark:bg-surface-2" /></section>
      <div className="space-y-4">
        <section className="civic-card overflow-hidden">
          <div className="grid lg:grid-cols-[19rem_1fr]">
            <aside className={`${filtersOpen ? 'block' : 'hidden'} border-b border-slate-200 bg-white p-4 lg:block lg:border-r lg:border-b-0`} aria-label="Safety map filters">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><Filter className="h-5 w-5 text-civic-600 dark:text-civic-300" /><h2 className="font-black text-ink dark:text-slate-100">Map filters</h2></div>
                <button type="button" className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 hover:bg-slate-800 lg:hidden" aria-label="Close filters" onClick={() => setFiltersOpen(false)}><X size={18} /></button>
              </div>
              <label className="relative mt-4 block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full pl-9" placeholder="Search services or area" aria-label="Search mapped services or area" />
              </label>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-xs font-bold"><input type="checkbox" className="h-4 w-4 accent-red-600" checked={showActiveAreas} onChange={(event) => setShowActiveAreas(event.target.checked)} /><Siren size={15} className="text-red-600" /> Active areas</label>
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-xs font-bold"><input type="checkbox" className="h-4 w-4 accent-amber-600" checked={showDensity} onChange={(event) => setShowDensity(event.target.checked)} /><Layers3 size={15} className="text-amber-600" /> Incident density</label>
              </div>
              <div className="mt-3">
                {facilityGroups.map((group) => <FilterGroup key={group.key} group={group} available={availableTypes} selected={selectedTypes} onToggle={toggleType} onAll={selectGroup} />)}
                {!availableTypes.size ? <p className="rounded-lg bg-slate-50 dark:bg-slate-900 p-3 text-xs text-slate-500 dark:text-slate-400">No service categories have registered locations yet. Nothing is shown until real records exist.</p> : null}
              </div>
            </aside>

            <div className="min-w-0 bg-slate-50 dark:bg-slate-900 p-3 sm:p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button type="button" className="civic-secondary lg:hidden" onClick={() => setFiltersOpen(true)}><Filter size={16} /> Filters</button>
                <select value={days} onChange={(event) => setDays(Number(event.target.value))} aria-label="Incident date range" className="w-auto">
                  {densityRanges.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                </select>
                <select value={incidentCategory} onChange={(event) => setIncidentCategory(event.target.value)} aria-label="Incident category" className="w-auto">
                  {incidentCategories.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                </select>
                <div className="ml-auto flex flex-wrap gap-2">
                  <button type="button" className="civic-secondary" onClick={shareLocation} disabled={geolocation.loading}>
                    <LocateFixed size={16} /> {locationState === 'requesting' ? 'Requesting permission…' : location ? 'Update my location' : 'Share my location'}
                  </button>
                  <button type="button" className="civic-primary" onClick={findNearestHelp} disabled={nearestBusy}>
                    <Navigation size={16} /> {nearestBusy ? 'Finding help…' : 'Find nearest help'}
                  </button>
                </div>
              </div>
              {locationState === 'detected' ? <p className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300"><MapPin size={15} /> Current location detected{Number.isFinite(Number(location?.accuracy)) ? ` · accuracy ±${Math.round(Number(location.accuracy))} m` : ''}. It is shown only to you on this page.</p> : null}
              {locationState === 'error' ? <p className="mb-3 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs font-semibold text-amber-800 dark:text-amber-300">{geolocation.error || 'Location permission was not granted.'} You can still browse the map and public directory.</p> : null}
              {error ? <div className="mb-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3 text-sm font-semibold text-red-700 dark:text-red-300">{error}</div> : null}
              {loading ? <div className="grid h-[32rem] place-items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"><div className="text-center"><ShieldCheck className="mx-auto h-8 w-8 animate-pulse text-civic-600 dark:text-civic-300" /><p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">Loading real safety map data…</p></div></div> : (
                <>
                  {!activeAreas.length && meta?.insufficientData ? <div className="mb-3 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-4 text-sm font-semibold text-amber-800 dark:text-amber-300">Not enough incident data available for this area. Try a longer date range or another incident category.</div> : null}
                  <EmergencyMap
                    height="h-[32rem] min-h-[28rem]"
                    hotspots={allAreas}
                    facilities={visibleFacilities}
                    userLocation={location}
                    onFacilitySelect={setSelectedFacility}
                    showControls={false}
                    autoFit
                  />
                </>
              )}
              <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">Active emergencies and reported density are rounded geographic aggregates. Individual citizen report locations are never returned to this public map. {meta?.totalReports || 0} standard report(s) matched the density period.</p>
            </div>
          </div>
        </section>
        {selectedFacility ? (
          <section className="civic-card p-4" aria-live="polite">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs font-black uppercase tracking-wide text-civic-600 dark:text-civic-300">Selected service</p><h2 className="text-lg font-black text-ink dark:text-slate-100">{selectedFacility.name}</h2><p className="text-sm text-slate-500 dark:text-slate-400">{facilityTypeLabels[selectedFacility.type]}{selectedFacility.address ? ` · ${selectedFacility.address}` : ''}</p></div>
              <button type="button" className="civic-secondary" onClick={() => setSelectedFacility(null)}>Close</button>
            </div>
            <div className="mt-3"><NearbyServiceCard facility={selectedFacility} origin={location} /></div>
          </section>
        ) : null}

        <section className="civic-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-lg font-black text-ink dark:text-slate-100">Nearest help</h2><p className="text-sm text-slate-500 dark:text-slate-400">Results come from registered service locations and are sorted by actual geographic distance.</p></div>
            <button type="button" className="civic-primary" onClick={findNearestHelp} disabled={nearestBusy}><Navigation size={16} /> Find nearest help</button>
          </div>
          <div className="mt-4">
            {nearestBusy ? <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-6 text-center text-sm text-slate-500 dark:text-slate-400">Calculating proximity using the server-side geospatial index…</p> : nearest.length ? <div className="grid gap-3 md:grid-cols-2">{nearest.map((facility) => <NearbyServiceCard key={facility._id} facility={facility} origin={location} />)}</div> : <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-6 text-center text-sm text-slate-500 dark:text-slate-400">Share your location or choose Find nearest help. No distances are shown until a real position and real service records are available.</p>}
          </div>
        </section>
      </div>
    </CitizenLayout>
  );
}
