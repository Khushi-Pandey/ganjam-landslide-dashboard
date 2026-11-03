const { GEO, DATA } = window;
const S = DATA.summary;
const BOX = [84.18, 19.90, 84.52, 20.22], PBOX = [84.20, 19.90, 84.50, 20.12];
const VIEW = [[84.32, 19.935], [84.53, 20.02]];
const SAT = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const REF = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = s => document.querySelector(s);
const corners = b => [[b[0], b[3]], [b[2], b[3]], [b[2], b[1]], [b[0], b[1]]];
const smooth = x => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k); };
const dayOf = d => Date.parse(d + 'T00:00:00Z') / 864e5;
const isoOf = t => new Date(Math.floor(t) * 864e5).toISOString().slice(0, 10);
const fmt = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

const T0 = dayOf('2026-09-24'), T1 = dayOf('2026-11-03'), T28 = dayOf('2026-10-28'), T30 = dayOf('2026-10-30') + .01;
const EVENT = '2026-10-28';
const rainBy = Object.fromEntries(DATA.rain);
const EVENTS = [
  ['2026-10-23', 'Last clear Sentinel-2 view'],
  ['2026-10-27', 'Heavy rain begins'],
  ['2026-10-28', 'Landslide reported, 3 am. 150 mm of rain'],
  ['2026-10-30', `Radar pass: ${S.patches} damage patches, ${S.ha} ha`],
  ['2026-11-01', 'PlanetScope: first part-clear view'],
].map(([d, txt], i, a) => ({ d, txt, t: dayOf(d) + (d === '2026-10-30' ? .01 : 0), end: Math.min(dayOf(d) + 2, a[i + 1] ? dayOf(a[i + 1][0]) : T1 + 1) }));

/* Sensors and dates */
const SENS = { s1: 'Sentinel-1', s2: 'Sentinel-2', planet: 'PlanetScope', sat: 'Satellite' };
const boxOf = s => (s === 'planet' ? PBOX : BOX);
const cloudOf = (s, d) => s === 's2' ? (DATA.passes.s2.find(p => p.d === d)?.cloud ?? 0) : s === 'planet' ? Math.round((DATA.passes.planet.find(p => p.d === d)?.cloud ?? 0) * 100) : 0;
const datesOf = s => (DATA.frames[s] || []).filter(d => s === 's1' || d >= '2026-10-01');
const FR = {};
Object.entries(DATA.frames).forEach(([s, days]) => {
  FR[s] = days.map(d => ({ d, t: dayOf(d) + (s === 's1' ? .01 : .22), id: `fr_${s}_${d}`, src: `f/${s}_${d}.webp`, box: boxOf(s), s }));
});
function bestDate(s, after) {
  const list = datesOf(s).filter(d => (after ? d >= EVENT : d < EVENT));
  return list.reduce((best, d) => (!best || cloudOf(s, d) <= cloudOf(s, best) ? d : best), null);
}

/* State */
const LAYERS = [
  { k: 'damage', n: 'Damage detected', v: `${S.ha} ha`, sw: 'dmg', ids: ['d_heat', 'd_halo', 'd_fill', 'd_line', 'd_dot'], timed: true },
  { k: 'near', n: 'Buildings within 100 m', v: S.buildings.near, sw: 'near', ids: ['b_near'], timed: true },
  { k: 'bld', n: 'Buildings', v: '', sw: 'bld', ids: ['bld'] },
  { k: 'river', n: 'Rivers and streams', v: '', sw: 'river', ids: ['river'] },
  { k: 'road', n: 'Roads', v: '', sw: 'road', ids: ['road_c', 'road'] },
  { k: 'label', n: 'Place names', v: '', sw: 'label', ids: ['ref'] },
];
const on = { damage: 1, near: 1, bld: 1, river: 1, road: 1, label: 1, outline: 1 };
const state = { tab: 'timeline', base: 's1', cmp: { a: ['s1', '2026-10-18'], b: ['s1', '2026-10-30'] }, patch: null };
const tl = { t: dayOf(new URLSearchParams(location.search).get('d') || '2026-10-12'), playing: false, speed: 1, last: 0, ready: {}, shown: {}, ev: undefined, day: null, dk: -1 };
const PATCH = Object.fromEntries(GEO.damage.features.map(f => [f.properties.id, f.properties]));

/* Maps */
function makeMap(container) {
  const m = new maplibregl.Map({
    container, bounds: VIEW, fitBoundsOptions: { padding: 20 }, minZoom: 9, maxZoom: 17.5, dragRotate: false, pitchWithRotate: false, attributionControl: { compact: true },
    style: {
      version: 8,
      sources: {
        sat: { type: 'raster', tiles: [SAT], tileSize: 256, maxzoom: 18, attribution: 'Esri, Maxar' },
        ref: { type: 'raster', tiles: [REF], tileSize: 256, maxzoom: 18 },
        e: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      },
      layers: [{ id: 'sat', type: 'raster', source: 'sat' }, { id: 'anchor', type: 'line', source: 'e' }],
    },
  });
  m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  m.on('mousemove', e => { $('#coord').textContent = `${e.lngLat.lat.toFixed(4)}°N, ${e.lngLat.lng.toFixed(4)}°E`; });
  m.on('click', e => {
    const ids = ['d_fill', 'd_dot', 'b_out'].filter(id => m.getLayer(id) && m.getLayoutProperty(id, 'visibility') !== 'none');
    const f = ids.length && m.queryRenderedFeatures([[e.point.x - 8, e.point.y - 8], [e.point.x + 8, e.point.y + 8]], { layers: ids })[0];
    if (f) openPatch(f.properties.id, m);
  });
  ['d_fill', 'd_dot', 'b_out'].forEach(id => {
    m.on('mouseenter', id, () => { m.getCanvas().style.cursor = 'pointer'; });
    m.on('mouseleave', id, () => { m.getCanvas().style.cursor = ''; });
  });
  return m;
}
const map = makeMap('map');
map.addControl(new maplibregl.ScaleControl(), 'bottom-right');
const dots = { type: 'FeatureCollection', features: GEO.damage.features.map(f => ({ type: 'Feature', properties: f.properties, geometry: { type: 'Point', coordinates: [f.properties.clon, f.properties.clat] } })) };
const labels = [['Tadama', 84.352, 19.9913], ['Baiballi', 84.3945, 19.9607], ['Kilapanga', 84.3015, 20.0209], ['Balingia', 84.3102, 20.0246]]
  .map(([n, lo, la]) => new maplibregl.Marker({ element: Object.assign(document.createElement('div'), { className: 'mlabel', textContent: n }) }).setLngLat([lo, la]));

const ready = new Promise(res => map.on('load', () => {
  map.addSource('damage', { type: 'geojson', data: GEO.damage });
  map.addSource('dots', { type: 'geojson', data: dots });
  map.addSource('near', { type: 'geojson', data: GEO.bnear });
  map.addSource('rivers', { type: 'geojson', data: GEO.rivers });
  map.addSource('roads', { type: 'geojson', data: GEO.roads });
  map.addSource('bld', { type: 'image', url: 'b/buildings.webp', coordinates: corners(BOX) });
  const round = { 'line-cap': 'round', 'line-join': 'round' };
  map.addLayer({ id: 'river', type: 'line', source: 'rivers', layout: round, paint: { 'line-color': '#3d9bf0', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, ['match', ['get', 'class'], 3, 2, 2, 1.2, .6], 15, ['match', ['get', 'class'], 3, 5, 2, 3, 1.6]] } });
  map.addLayer({ id: 'road_c', type: 'line', source: 'roads', layout: round, paint: { 'line-color': '#1b1b1b', 'line-opacity': .7, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2.4, 15, 6] } });
  map.addLayer({ id: 'road', type: 'line', source: 'roads', layout: round, paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 15, 3.4] } });
  map.addLayer({ id: 'bld', type: 'raster', source: 'bld', paint: { 'raster-fade-duration': 0, 'raster-resampling': 'nearest' } });
  map.addLayer({ id: 'ref', type: 'raster', source: 'ref', paint: { 'raster-fade-duration': 0 } });
  map.addLayer({ id: 'd_heat', type: 'heatmap', source: 'dots', maxzoom: 15, paint: {
    'heatmap-weight': ['interpolate', ['linear'], ['get', 'ha'], 0, .35, 4, 1],
    'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 9, .9, 14, 2],
    'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 9, 16, 12, 32, 14.5, 60],
    'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(255,214,0,0)', .12, 'rgba(255,214,0,.4)', .35, 'rgba(255,140,0,.72)', .65, 'rgba(255,48,20,.88)', 1, 'rgba(170,0,0,.95)'],
    'heatmap-opacity': 0,
  } });
  map.addLayer({ id: 'd_halo', type: 'line', source: 'damage', layout: round, paint: { 'line-color': '#5c0000', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 3, 16, 8], 'line-blur': 1.5, 'line-opacity': 0 } });
  map.addLayer({ id: 'd_fill', type: 'fill', source: 'damage', paint: { 'fill-color': '#ff3b1f', 'fill-opacity': 0 } });
  map.addLayer({ id: 'd_line', type: 'line', source: 'damage', layout: round, paint: { 'line-color': '#fff4d6', 'line-width': 1.4, 'line-opacity': 0 } });
  map.addLayer({ id: 'd_dot', type: 'circle', source: 'dots', maxzoom: 13.6, paint: { 'circle-color': '#ff3b1f', 'circle-radius': ['+', 3.5, ['*', 1.8, ['sqrt', ['get', 'ha']]]], 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5, 'circle-opacity': 0, 'circle-stroke-opacity': 0 } });
  selLayers(map);
  map.addLayer({ id: 'b_near', type: 'circle', source: 'near', paint: { 'circle-color': '#ffe066', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3, 15, 7], 'circle-stroke-color': '#111', 'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 1.6, 15, 3] } });
  res();
}));

const setVis = (m, id, v) => { if (m && m.getLayer(id)) m.setLayoutProperty(id, 'visibility', v ? 'visible' : 'none'); };
function applyLayers() {
  const cmp = state.tab === 'compare';
  LAYERS.forEach(L => L.ids.forEach(id => setVis(map, id, on[L.k] && !(cmp && L.k !== 'label') && (!L.timed || tl.t >= T30))));
  labels.forEach(m => (on.label ? m.addTo(map) : m.remove()));
  if (mapB) { setVis(mapB, 'b_halo', on.outline); setVis(mapB, 'b_out', on.outline); }
}
function damageAlpha(k) {
  if (!map.getLayer('d_fill')) return;
  map.setPaintProperty('d_heat', 'heatmap-opacity', ['interpolate', ['linear'], ['zoom'], 12.8, .9 * k, 15, 0]);
  map.setPaintProperty('d_halo', 'line-opacity', .6 * k);
  map.setPaintProperty('d_fill', 'fill-opacity', .82 * k);
  map.setPaintProperty('d_line', 'line-opacity', k);
  map.setPaintProperty('d_dot', 'circle-opacity', ['interpolate', ['linear'], ['zoom'], 12.8, k, 13.6, 0]);
  map.setPaintProperty('d_dot', 'circle-stroke-opacity', ['interpolate', ['linear'], ['zoom'], 12.8, k, 13.6, 0]);
  map.setPaintProperty('b_near', 'circle-opacity', k);
  map.setPaintProperty('b_near', 'circle-stroke-opacity', k);
}

/* Patch preview */
const SEL = id => ['==', ['get', 'id'], id];
function selLayers(m) {
  m.addLayer({ id: 'sel_glow', type: 'line', source: 'damage', filter: SEL(-1), paint: { 'line-color': '#ffe066', 'line-width': 12, 'line-blur': 7, 'line-opacity': .9 } });
  m.addLayer({ id: 'sel', type: 'line', source: 'damage', filter: SEL(-1), paint: { 'line-color': '#ffe066', 'line-width': 3 } });
}
function select(id) { [map, mapB].forEach(m => { if (m && m.getLayer('sel')) { m.setFilter('sel', SEL(id)); m.setFilter('sel_glow', SEL(id)); } }); }
function closePatch() {
  state.patch = null;
  $('#pvcard').hidden = true;
  select(-1);
  document.querySelectorAll('[data-patch]').forEach(b => b.setAttribute('aria-current', 'false'));
}
function openPatch(id, m = map) {
  const p = PATCH[id];
  if (!p) return;
  state.patch = id;
  document.querySelectorAll('[data-patch]').forEach(b => b.setAttribute('aria-current', +b.dataset.patch === id));
  const tile = (r, k, label) => `<div class="chip" style="background-image:url(c/${id}.webp);background-position:${k * 100}% ${r * 50}%"><i>${label}</i></div>`;
  const pl = d => (d ? fmt(d) + (d === '2026-10-27' ? ', cloud' : '') : 'No image');
  const card = $('#pvcard');
  card.innerHTML = `<button class="pvx" type="button" aria-label="Close">×</button><div class="pv"><h3>Patch ${id}<span>${p.ha} ha</span></h3><div class="where">${p.where}${p.stream ? ', along a stream' : ''}</div>
    <div class="pvg"><span></span><span class="h">Before</span><span class="h">After</span>
      <span class="s">Sentinel-1</span>${tile(0, 0, '18 Oct')}${tile(0, 1, '30 Oct')}
      <span class="s">Sentinel-2</span>${tile(1, 0, '23 Oct')}${tile(1, 1, '2 Nov, cloud')}
      <span class="s">PlanetScope</span>${tile(2, 0, pl(p.pb))}${tile(2, 1, pl(p.pa))}</div>
    <div class="facts">Radar signal fell ${Math.abs(p.dVV)} dB (VV) and ${Math.abs(p.dVH)} dB (VH). Height ${p.elev} m, slope ${p.slope}°.</div></div>`;
  card.hidden = false;
  card.querySelector('.pvx').onclick = closePatch;
  select(id);
  // keep the patch in the open part of the map, to the right of the card
  const wide = $('#stage').clientWidth > 700;
  m.easeTo({ center: [p.clon, p.clat], zoom: Math.max(m.getZoom(), 15), offset: wide ? [(card.offsetWidth + 14) / 2, 0] : [0, 0], duration: REDUCED ? 0 : 900 });
}

/* Frames for the timeline */
const showLoading = t => { $('#loading').hidden = false; $('#loadingText').textContent = t; };
function ensureFrames(s) {
  if (s === 'sat') return Promise.resolve();
  if (tl.ready[s]) return tl.ready[s];
  const fs = FR[s];
  let n = 0;
  showLoading(`Loading images 0 of ${fs.length}`);
  tl.ready[s] = Promise.all(fs.map(f => new Promise(res => {
    const im = new Image();
    im.onload = im.onerror = () => { n++; if (state.base === s) showLoading(`Loading images ${n} of ${fs.length}`); res(); };
    im.src = f.src;
  }))).then(() => ready).then(() => {
    fs.forEach(f => {
      map.addSource(f.id, { type: 'image', url: f.src, coordinates: corners(f.box) });
      map.addLayer({ id: f.id, type: 'raster', source: f.id, layout: { visibility: 'none' }, paint: { 'raster-opacity': 0, 'raster-fade-duration': 0, ...(f.d === '2026-10-27' && s === 'planet' ? { 'raster-brightness-max': .8 } : {}) } }, 'anchor');
    });
    $('#loading').hidden = true;
  });
  return tl.ready[s];
}
function hideFrames() {
  Object.keys(tl.shown).forEach(id => { map.setPaintProperty(id, 'raster-opacity', 0); map.setLayoutProperty(id, 'visibility', 'none'); });
  tl.shown = {};
}
function paintFrames(t) {
  const fs = FR[state.base];
  if (state.tab === 'compare' || !fs || !map.getLayer(fs[0].id)) return;
  let i = 0;
  fs.forEach((f, k) => { if (f.t <= t) i = k; });
  const cur = fs[i], next = fs[i + 1];
  let a = 0;
  if (next && t >= cur.t) { const gap = next.t - cur.t, w = Math.min(gap * .8, 2.4); a = smooth((t - (next.t - w)) / w); }
  const want = { [cur.id]: 1 };
  if (i > 0) want[fs[i - 1].id] = 1;  // partial scenes show the previous image in their gaps
  if (next && a > .004) want[next.id] = a;
  Object.keys(tl.shown).forEach(id => { if (!(id in want)) { map.setPaintProperty(id, 'raster-opacity', 0); map.setLayoutProperty(id, 'visibility', 'none'); delete tl.shown[id]; } });
  Object.entries(want).forEach(([id, v]) => {
    if (!(id in tl.shown)) map.setLayoutProperty(id, 'visibility', 'visible');
    if (Math.abs((tl.shown[id] ?? -1) - v) > .004) { map.setPaintProperty(id, 'raster-opacity', v); tl.shown[id] = v; }
  });
  const d = (a > .5 && next ? next : cur).d;
  document.querySelectorAll('#dates [data-date]').forEach(b => b.setAttribute('aria-pressed', b.dataset.date === d));
}
async function setBase(k) {
  state.base = k;
  renderSide();
  hideFrames();
  await ensureFrames(k);
  if (state.base === k) paintT(true);
}

/* Before / after */
let mapB = null, syncing = false;
function ensureB() {
  if (mapB) return mapB.__ready;
  $('#mapB').hidden = false;
  mapB = makeMap('mapB');
  mapB.jumpTo({ center: map.getCenter(), zoom: map.getZoom() });
  mapB.__ready = new Promise(res => mapB.on('load', () => {
    mapB.addSource('damage', { type: 'geojson', data: GEO.damage });
    mapB.addLayer({ id: 'ref', type: 'raster', source: 'ref', paint: { 'raster-fade-duration': 0 } });
    mapB.addLayer({ id: 'b_halo', type: 'line', source: 'damage', paint: { 'line-color': '#5c0000', 'line-width': 5, 'line-blur': 1.5, 'line-opacity': .6 } });
    mapB.addLayer({ id: 'b_out', type: 'line', source: 'damage', paint: { 'line-color': '#ff3b1f', 'line-width': 2.2 } });
    selLayers(mapB); if (state.patch) select(state.patch);
    res();
  }));
  const sync = (a, b) => a.on('move', () => { if (syncing) return; syncing = true; b.jumpTo({ center: a.getCenter(), zoom: a.getZoom() }); syncing = false; });
  sync(map, mapB); sync(mapB, map);
  return mapB.__ready;
}
function setImg(m, s, d) {
  const src = s === 'sat' ? null : s === 's1' ? `f/s1g_${d}.webp` : `f/${s}_${d}.webp`;
  if (!src) { setVis(m, 'cmp', false); return; }
  if (m.getSource('cmp')) m.getSource('cmp').updateImage({ url: src, coordinates: corners(boxOf(s)) });
  else { m.addSource('cmp', { type: 'image', url: src, coordinates: corners(boxOf(s)) }); m.addLayer({ id: 'cmp', type: 'raster', source: 'cmp', paint: { 'raster-fade-duration': 0 } }, 'anchor'); }
  setVis(m, 'cmp', true);
}
const tagOf = (k, [s, d]) => `<b>${k}</b>${SENS[s]}${s === 'sat' ? '' : `, ${fmt(d)}`}`;
async function paintCompare() {
  await Promise.all([ready, ensureB()]);
  if (state.tab !== 'compare') return;
  setImg(map, ...state.cmp.a); setImg(mapB, ...state.cmp.b);
  $('#tagA').innerHTML = tagOf('Before', state.cmp.a); $('#tagB').innerHTML = tagOf('After', state.cmp.b);
  applyLayers();
}
function setSplit(pct) {
  pct = Math.max(2, Math.min(98, pct));
  $('#stage').style.setProperty('--split', `${pct}%`);
  $('#handle').setAttribute('aria-valuenow', Math.round(pct));
}
{
  const h = $('#handle');
  let drag = false;
  h.onpointerdown = e => { drag = true; h.setPointerCapture(e.pointerId); };
  h.onpointermove = e => { if (!drag) return; const r = $('#stage').getBoundingClientRect(); setSplit((e.clientX - r.left) / r.width * 100); };
  h.onpointerup = () => { drag = false; };
  h.onkeydown = e => { const v = +h.getAttribute('aria-valuenow'); if (e.key === 'ArrowLeft') setSplit(v - 4); if (e.key === 'ArrowRight') setSplit(v + 4); };
}

/* Tabs and side panel */
const ICON = {
  timeline: '<circle cx="12" cy="12" r="8.5"/><path d="m10 8.5 5.5 3.5-5.5 3.5v-7Z"/>',
  compare: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M12 3v18"/><path d="m8.5 10-2 2 2 2M15.5 10l2 2-2 2"/>',
  damage: '<path d="M12 3.5 21 19H3L12 3.5Z"/><path d="M12 10v4.2M12 16.8v.2"/>',
};
const TABS = [['timeline', 'Timeline'], ['compare', 'Before / after'], ['damage', 'Damage']];
$('#tabs').innerHTML = TABS.map(([k, n]) => `<button class="tab" type="button" role="tab" data-tab="${k}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>${n}</button>`).join('');
$('#tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); };

const seg = (items, cur, attr) => `<div class="seg" role="radiogroup" style="--n:${items.length > 3 ? 2 : items.length}">${items.map(k => `<button type="button" role="radio" ${attr}="${k}" aria-checked="${k === cur}">${SENS[k]}</button>`).join('')}</div>`;
const chips = (s, cur, side = '') => s === 'sat' ? '' : `<div class="dates" ${side ? '' : 'id="dates"'}>${datesOf(s).map(d => {
  const c = cloudOf(s, d);
  return `<button type="button" class="dchip${c >= 40 ? ' cloud' : ''}${d >= EVENT ? ' post' : ''}" data-date="${d}" ${side ? `data-side="${side}"` : ''} aria-pressed="${d === cur}" data-tip="${fmt(d)}${s === 's1' ? ': radar, sees through cloud' : `: ${c}% cloud`}">${fmt(d)}</button>`;
}).join('')}</div>`;
const layerRow = L => `<button class="layer" type="button" role="switch" data-layer="${L.k}" aria-checked="${!!on[L.k]}"><i class="sw ${L.sw}"></i><span class="name">${L.n}</span><span class="val">${L.v}</span><span class="switch"></span></button>`;
function renderSide() {
  const t = state.tab;
  let html = '';
  if (t === 'timeline') {
    html = `<section><h2>Basemap</h2>${seg(['s1', 's2', 'planet', 'sat'], state.base, 'data-base')}${chips(state.base, null)}
      ${state.base === 's1' ? '<div class="note">Red: radar signal dropped compared with before the storm</div><div class="ramp"></div><div class="ends"><span>No change</span><span>Strong drop</span></div>' : ''}</section>
      <section><h2>Layers</h2>${LAYERS.map(layerRow).join('')}</section>`;
  } else if (t === 'compare') {
    const side = (k, name) => `<section><h2>${name}</h2>${seg(['s1', 's2', 'planet', 'sat'], state.cmp[k][0], `data-cs="${k}" data-sens`)}${chips(state.cmp[k][0], state.cmp[k][1], k)}</section>`;
    html = side('a', 'Before') + side('b', 'After') + `<section>${layerRow({ k: 'outline', n: 'Damage outline, after side', v: '', sw: 'dmg' })}</section>`;
  } else {
    const st = [[S.ha, 'ha damage detected', 1], [S.patches, 'damage patches'], [S.buildings.near, 'buildings within 100 m'], [S.rivers.in.toFixed(1), 'km of river in damage']];
    html = `<section><h2>Damage on 30 Oct</h2><div class="stats">${st.map(([v, l, hot]) => `<div class="stat${hot ? ' hot' : ''}"><b>${v}</b><span>${l}</span></div>`).join('')}</div></section>
      <section><h2>Patches, largest first</h2><div class="plist">${GEO.damage.features.map(({ properties: p }) => `<button class="prow" type="button" data-patch="${p.id}" aria-current="${p.id === state.patch}"><span class="th" style="background-image:url(c/${p.id}.webp)"></span><span><b>Patch ${p.id}<span>${p.ha} ha</span></b><small>${p.where}</small><small>${p.elev} m, radar ${p.dVV} dB</small></span></button>`).join('')}</div></section>`;
  }
  $('#side').innerHTML = html;
  if (t === 'timeline') paintFrames(tl.t);
}
$('#side').onclick = e => {
  const el = e.target.closest('button');
  if (!el) return;
  if (el.dataset.base) return setBase(el.dataset.base);
  if (el.dataset.layer) {
    on[el.dataset.layer] = on[el.dataset.layer] ? 0 : 1;
    el.setAttribute('aria-checked', !!on[el.dataset.layer]);
    return ready.then(applyLayers);
  }
  if (el.dataset.patch) return openPatch(+el.dataset.patch, map);
  if (el.dataset.cs) {
    const s = el.dataset.sens, k = el.dataset.cs;
    state.cmp[k] = [s, s === 'sat' ? null : bestDate(s, k === 'b')];
    renderSide(); return paintCompare();
  }
  if (el.dataset.side) { state.cmp[el.dataset.side][1] = el.dataset.date; renderSide(); return paintCompare(); }
  if (el.dataset.date) { pause(); setT(dayOf(el.dataset.date) + .5); }
};
function setTab(t) {
  const prev = state.tab;
  if (t === prev) return;
  state.tab = t;
  $('#app').dataset.tab = t;
  document.querySelectorAll('[data-tab]').forEach(b => b.getAttribute('role') === 'tab' && b.setAttribute('aria-selected', b.dataset.tab === t));
  closePatch();
  pause();
  $('#event').hidden = true; tl.ev = undefined;
  const cmp = t === 'compare';
  $('#swipe').hidden = !cmp;
  if (mapB) $('#mapB').hidden = !cmp;
  if (cmp) { hideFrames(); paintCompare(); } else { setVis(map, 'cmp', false); }
  if (t === 'damage') setT(dayOf('2026-10-31'));
  renderSide();
  ready.then(() => { applyLayers(); if (!cmp) paintT(true); });
}

/* Timeline track */
const PLAY = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M3.5 1.5v13l11-6.5z"/></svg>';
const PAUSE = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="3" y="2" width="3.6" height="12" rx="1"/><rect x="9.4" y="2" width="3.6" height="12" rx="1"/></svg>';
let W = 600, H = 140, TL = 84;
const TR = 8;
const tx = t => TL + (t - T0) / (T1 - T0) * (W - TL - TR);
function drawTrack() {
  const el = $('#track');
  if (!el.clientWidth) return;
  W = Math.max(el.clientWidth, 280); H = Math.max(el.clientHeight, 110);
  TL = W < 480 ? 54 : 84;
  const rb = H - 76, rt = 16, maxR = Math.max(...DATA.rain.map(r => r[1]));
  const bw = Math.max((W - TL - TR) / (T1 - T0) - 2, 1.5);
  const bars = DATA.rain.map(([d, v]) => {
    const h = v >= 1 ? Math.max(v / maxR * (rb - rt), 2) : 0;
    return h ? `<rect x="${tx(dayOf(d)).toFixed(1)}" y="${(rb - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="${d >= '2026-10-27' && d <= '2026-10-29' ? '#1c7ed6' : '#74b5e8'}" data-tip="${fmt(d)}: ${v} mm rain"/>` : '';
  }).join('');
  const ticks = [];
  for (let t = T0 + 7; t < T1; t += W < 480 ? 14 : 7) ticks.push(`<text x="${tx(t)}" y="${H - 3}" text-anchor="middle">${fmt(isoOf(t))}</text>`);
  const lanes = [
    ['planet', W < 480 ? 'Planet' : 'PlanetScope', H - 60, DATA.passes.planet.filter(p => p.used).map(p => ({ d: p.d, ok: p.cloud < .4, tip: `${Math.round(p.cloud * 100)}% cloud` }))],
    ['s2', W < 480 ? 'S-2' : 'Sentinel-2', H - 42, DATA.passes.s2.map(p => ({ d: p.d, ok: p.cloud < 40, tip: `${p.cloud}% cloud` }))],
    ['s1', W < 480 ? 'S-1' : 'Sentinel-1', H - 24, DATA.frames.s1.map(d => ({ d, ok: true, hot: d === '2026-10-30', tip: 'radar, sees through cloud' }))],
  ].map(([s, label, y, list]) => `<text class="lane" x="${TL - 10}" y="${y + 4}" text-anchor="end">${label}</text><line x1="${TL}" x2="${W - TR}" y1="${y}" y2="${y}" stroke="#e3e7e1"/>`
    + list.map(p => `<circle cx="${tx(dayOf(p.d) + .4).toFixed(1)}" cy="${y}" r="${p.hot ? 5.5 : 4}" fill="${p.hot ? '#e8261a' : p.ok ? '#0b3c2c' : '#fff'}" stroke="${p.hot ? '#e8261a' : '#0b3c2c'}" stroke-width="1.5" data-tip="${label}, ${fmt(p.d)}: ${p.tip}"/>`).join('')).join('');
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="slider" tabindex="0" aria-label="Date" id="trackSvg">
    <rect x="${tx(T28)}" y="0" width="${tx(T30 + 1) - tx(T28)}" height="${H - 14}" fill="#e8261a" opacity=".09"/>
    <line x1="${tx(T28)}" x2="${tx(T28)}" y1="0" y2="${H - 14}" stroke="#e8261a" stroke-dasharray="3 3"/>
    <text class="mark" x="${tx(T28) - 5}" y="10" text-anchor="end">Landslide</text>
    ${W < 480 ? '' : `<text class="lane" x="${TL - 10}" y="${rb - 4}" text-anchor="end">Rain</text>`}
    ${bars}${ticks.join('')}${lanes}
    <g id="head"><line y1="0" y2="${H - 14}" stroke="#12211b" stroke-width="2"/><circle cy="4" r="5.5" fill="#12211b"/></g></svg>`;
  tl.day = null;
  paintT(true);
}
function paintT(force) {
  const t = tl.t;
  const head = $('#head');
  if (head) head.setAttribute('transform', `translate(${tx(t).toFixed(1)} 0)`);
  const day = Math.floor(t);
  if (day !== tl.day || force) {
    tl.day = day;
    const iso = isoOf(t);
    $('#date').textContent = new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    $('#rain').textContent = rainBy[iso] != null ? `Rain ${Math.round(rainBy[iso])} mm` : '';
    const svg = $('#trackSvg'); if (svg) svg.setAttribute('aria-valuetext', iso);
    paintSignal();
  }
  paintFrames(t);
  const k = smooth((t - T30) / .3);
  if (Math.abs(k - tl.dk) > .01 || force) {
    const was = tl.dk;
    tl.dk = k;
    if (map.getLayer('d_fill')) { applyLayers(); damageAlpha(k); }
    if (was <= 0 && k > 0) { pulse(); kpis(true); } else if (k <= 0 && was > 0) kpis(false);
  }
  if (state.tab !== 'timeline') return;
  let cur = -1;
  EVENTS.forEach((e, i) => { if (t >= e.t && t < e.end) cur = i; });
  if (cur !== tl.ev) {
    tl.ev = cur;
    const ev = $('#event');
    ev.hidden = true;
    if (cur >= 0) { ev.innerHTML = `<b>${fmt(EVENTS[cur].d)}</b>${EVENTS[cur].txt}`; void ev.offsetWidth; ev.hidden = false; }
  }
}
function pulse() {
  if (REDUCED || !map.getLayer('d_halo')) return;
  const t0 = performance.now();
  const step = now => {
    const p = Math.min((now - t0) / 2000, 1), q = (1 - p) * (1 - p);
    map.setPaintProperty('d_halo', 'line-width', ['interpolate', ['linear'], ['zoom'], 11, 3 + 20 * q, 16, 8 + 30 * q]);
    map.setPaintProperty('d_heat', 'heatmap-radius', ['interpolate', ['linear'], ['zoom'], 9, 16 * (1 + 1.5 * q), 12, 32 * (1 + 1.5 * q), 14.5, 60 * (1 + 1.5 * q)]);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
const setT = t => { tl.t = Math.max(T0, Math.min(T1, t)); paintT(); };
const warp = t => (t > dayOf('2026-10-26') + .5 && t < dayOf('2026-11-01') ? .35 : 1);
function play() {
  if (state.tab === 'compare') return;
  if (tl.t >= T1 - .01) setT(T0);
  tl.playing = true; tl.last = performance.now();
  $('#play').innerHTML = PAUSE; $('#play').setAttribute('aria-label', 'Pause');
  requestAnimationFrame(tick);
}
function pause() {
  tl.playing = false;
  $('#play').innerHTML = PLAY; $('#play').setAttribute('aria-label', 'Play');
}
function tick(now) {
  if (!tl.playing) return;
  const dt = Math.min((now - tl.last) / 1000, .08);
  tl.last = now;
  const nt = tl.t + dt * 1.6 * tl.speed * warp(tl.t);
  if (nt >= T1) { setT(T1); pause(); return; }
  setT(nt);
  requestAnimationFrame(tick);
}
$('#play').innerHTML = PLAY;
$('#play').onclick = () => (tl.playing ? pause() : play());
const SPEEDS = [.5, 1, 2, 4];
$('#speed').onclick = e => { tl.speed = SPEEDS[(SPEEDS.indexOf(tl.speed) + 1) % SPEEDS.length]; e.currentTarget.textContent = `${tl.speed}x`; };
{
  const track = $('#track');
  const toT = e => { const r = track.getBoundingClientRect(); return T0 + ((e.clientX - r.left) / r.width * W - TL) / (W - TL - TR) * (T1 - T0); };
  let drag = false;
  track.onpointerdown = e => { drag = true; track.setPointerCapture(e.pointerId); pause(); setT(toT(e)); };
  track.onpointermove = e => { if (drag) setT(toT(e)); };
  track.onpointerup = () => { drag = false; };
  track.onkeydown = e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); pause(); setT(Math.floor(tl.t) + (e.key === 'ArrowRight' ? 1 : -1) + .5); }
    if (e.key === ' ') { e.preventDefault(); tl.playing ? pause() : play(); }
  };
}

/* Numbers and chart */
function kpis(live) {
  const items = [[`${S.ha}`, 'ha damage detected', true], [S.patches, 'damage patches'], [S.buildings.near, 'buildings within 100 m'], [S.rivers.in.toFixed(1), 'km of river in damage']];
  $('#kpis').innerHTML = items.map(([v, l, hot]) => `<div class="kpi${hot ? ' hot' : ''}"><b data-v="${v}">${live ? (REDUCED ? v : 0) : '–'}</b><span>${l}</span></div>`).join('');
  if (!live || REDUCED) return;
  const t0 = performance.now();
  const els = [...document.querySelectorAll('.kpi b')];
  const step = now => {
    const p = smooth((now - t0) / 900);
    els.forEach(el => { const v = +el.dataset.v; el.textContent = Number.isInteger(v) ? Math.round(v * p) : (v * p).toFixed(1); });
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function paintSignal() {
  // Mean radar signal (VV, dB) at the damaged spots and in a ring of ground around them, every pass
  const el = $('#signal');
  if (!el.clientWidth) return;
  const w = el.clientWidth, h = Math.max(el.clientHeight, 70), P = S.series;
  const L = 30, R = 96, top = 6, bot = h - 16, lo = -14, hi = -5;
  const x = i => L + i / (P.length - 1) * (w - L - R), y = v => top + (hi - v) / (hi - lo) * (bot - top);
  let cur = -1;
  P.forEach((p, i) => { if (dayOf(p.d) + .01 <= tl.t) cur = i; });
  const line = k => P.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p[k]).toFixed(1)}`).join('');
  const grid = [-6, -10, -14].map(v => `<line x1="${L}" x2="${w - R}" y1="${y(v)}" y2="${y(v)}" stroke="#eef1ee"/><text x="${L - 5}" y="${y(v) + 3.5}" text-anchor="end">${v}</text>`).join('');
  const last = P.length - 1;
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}">${grid}
    <path d="${line('ring')}" fill="none" stroke="#8d9a93" stroke-width="2"/>
    <path d="${line('site')}" fill="none" stroke="#e8261a" stroke-width="2"/>
    ${P.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.site)}" r="${i === cur ? 5.5 : 3.5}" fill="#e8261a" stroke="#fff" stroke-width="2"/><circle cx="${x(i)}" cy="${y(p.ring)}" r="${i === cur ? 4.5 : 3}" fill="#8d9a93" stroke="#fff" stroke-width="1.5"/>
      <text x="${x(i)}" y="${h - 3}" text-anchor="middle" ${i === cur ? 'style="fill:#12211b;font-weight:700"' : ''}>${fmt(p.d)}</text>
      <rect class="hit" x="${x(i) - 14}" y="0" width="28" height="${h}" data-tip="${fmt(p.d)}: damaged spots ${p.site} dB, ground around ${p.ring} dB"/>`).join('')}
    <text class="v" x="${x(last) + 8}" y="${y(P[last].site) + 4}" style="fill:#c92a2a">Damaged spots</text>
    <text x="${x(last) + 8}" y="${y(P[last].ring) + 4}">Ground around</text></svg>`;
}

/* Tooltip */
const tip = $('#tip');
document.addEventListener('pointermove', e => {
  const t = e.target.closest && e.target.closest('[data-tip]');
  if (!t) { tip.hidden = true; return; }
  tip.textContent = t.dataset.tip; tip.hidden = false;
  tip.style.left = `${e.clientX}px`; tip.style.top = `${e.clientY}px`;
});

/* Start */
document.querySelector('[data-tab="timeline"]').setAttribute('aria-selected', 'true');
renderSide();
kpis(tl.t >= T30);
new ResizeObserver(() => { drawTrack(); paintSignal(); }).observe($('.dock'));
new ResizeObserver(() => { map.resize(); if (mapB) mapB.resize(); }).observe($('#stage'));
ready.then(async () => {
  applyLayers();
  paintT(true);
  await ensureFrames(state.base);
  paintT(true);
  if (!REDUCED && state.tab === 'timeline') setTimeout(play, 600);
});
