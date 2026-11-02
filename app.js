const { GEO, DATA } = window;
const BOX = [84.18, 19.90, 84.52, 20.22];
const PBOX = [84.20, 19.90, 84.50, 20.12];
const FOCUS = [[84.285, 19.925], [84.515, 20.035]];
const AOI_RING = [[BOX[0], BOX[1]], [BOX[2], BOX[1]], [BOX[2], BOX[3]], [BOX[0], BOX[3]], [BOX[0], BOX[1]]];
const LIGHT = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const LIGHT_LABELS = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}';
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = s => document.querySelector(s);
const corners = b => [[b[0], b[3]], [b[2], b[3]], [b[2], b[1]], [b[0], b[1]]];
const smooth = x => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k); };
const fmt = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const num = n => n.toLocaleString('en-IN');

const CLS = {
  site: { n: 'Reported site', c: '#0B3C2C' }, debris: { n: 'Debris flow', c: '#E8590C' }, slope: { n: 'Slope failure', c: '#C2255C' },
  flood: { n: 'Flood and silt', c: '#1971C2' }, water: { n: 'Tank or field water', c: '#0F9D8A' },
};
const CONF = { Strong: 'High', Possible: 'Medium', Weak: 'Low', 'Best match': 'Best match' };
const TIER = { 3: { n: 'Inside damage', c: '#D6001C' }, 2: { n: 'Close to damage', c: '#F59F00' }, 1: { n: 'Low ground or steep slope', c: '#FFE066' } };
const LC = [['Dense forest', '#21573A'], ['Fields and scrub', '#B2C470'], ['Bare ground', '#D6BA91'], ['River and water', '#267DC8'], ['Buildings', '#48423E']];
const S = DATA.summary;

const IMG = {
  s2: ['b/s2_before.webp', BOX], s2_after: ['f/s2_2026-11-02.webp', BOX], planet: ['f/planet_2026-10-22.webp', PBOX], planet_after: ['f/planet_2026-11-01.webp', PBOX],
  s1: ['b/s1_before.webp', BOX], s1_after: ['b/s1_after.webp', BOX], lc: ['b/landcover.webp', BOX],
  o_change: ['b/change.webp', BOX], o_prone: ['b/prone.webp', BOX], o_all: ['b/buildings.webp', BOX],
};
const BASES = [
  { k: 's2', n: 'Sentinel-2', d: '23 Oct, before' }, { k: 'planet_after', n: 'PlanetScope', d: '1 Nov, after' }, { k: 's1_after', n: 'Sentinel-1', d: '30 Oct, after' },
  { k: 'lc', n: 'Land cover', d: 'Classified, before' }, { k: 'hires', n: 'High detail', d: 'Older archive' },
];
const SLIDE = [[84.322, 19.945], [84.428, 20.014]];
const PLACE_VIEWS = [['Slide area', SLIDE], ['Whole area', FOCUS], ['Tadama', [[84.33, 19.975], [84.375, 20.01]]], ['Baiballi', [[84.385, 19.948], [84.42, 19.972]]], ['Lower valley', [[84.435, 19.945], [84.47, 19.98]]], ['Main river', [[84.48, 19.935], [84.52, 19.97]]]];
const LABELS = [['Tadama', 84.35204, 19.99131, 'left', [16, 0]], ['Baiballi', 84.39448, 19.96069, 'right', [-6, -3]], ['Kilapanga', 84.30152, 20.02092, 'right', [-4, 0]], ['Balingia', 84.31016, 20.02461, 'left', [4, -2]]];

const state = {
  mode: null, base: 's2', place: null, filter: null,
  vis: { debris: 1, slope: 1, flood: 1, water: 1, route: 1, places: 1, t3: 1, t2: 1, t1: 0, all: 0, riverHit: 1, rivers: 1, cuts: 1, roads: 0, change: 0, prone: 0 },
};
const NONE = { debris: 0, slope: 0, flood: 0, water: 0, route: 0, places: 0, t3: 0, t2: 0, t1: 0, all: 0, riverHit: 0, rivers: 0, cuts: 0, roads: 0, change: 0, prone: 0 };

/* Map */
const routeCoords = GEO.route.features[0].geometry.coordinates;
const routeLen = (() => { const out = [0]; for (let i = 1; i < routeCoords.length; i++) out.push(out[i - 1] + Math.hypot((routeCoords[i][0] - routeCoords[i - 1][0]) * 104600, (routeCoords[i][1] - routeCoords[i - 1][1]) * 110540)); return out; })();
const empty = { type: 'FeatureCollection', features: [] };
const centroids = { type: 'FeatureCollection', features: GEO.damage.features.map(f => {
  const flat = f.geometry.coordinates.flat(f.geometry.type === 'Polygon' ? 1 : 2);
  const xs = flat.map(p => p[0]), ys = flat.map(p => p[1]);
  return { type: 'Feature', properties: f.properties, geometry: { type: 'Point', coordinates: [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2] } };
}) };
const clsColor = ['match', ['get', 'cls'], 'debris', CLS.debris.c, 'slope', CLS.slope.c, 'flood', CLS.flood.c, CLS.water.c];
const tierColor = ['match', ['get', 'tier'], 3, TIER[3].c, 2, TIER[2].c, TIER[1].c];

function makeMap(id) {
  const m = new maplibregl.Map({
    container: id, bounds: FOCUS, fitBoundsOptions: { padding: 30 }, minZoom: 8.5, maxZoom: 17.4, dragRotate: false, pitchWithRotate: false, attributionControl: { compact: true },
    style: { version: 8, transition: { duration: 0, delay: 0 }, sources: {
      light: { type: 'raster', tiles: [LIGHT], tileSize: 256, maxzoom: 16, attribution: 'Esri' },
      lightl: { type: 'raster', tiles: [LIGHT_LABELS], tileSize: 256, maxzoom: 16 },
      hires: { type: 'raster', tiles: [ESRI], tileSize: 256, maxzoom: 18, attribution: 'Esri, Maxar' },
      e: { type: 'geojson', data: empty },
    }, layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#EEF0EC' } },
      { id: 'light', type: 'raster', source: 'light', paint: { 'raster-fade-duration': 0 } },
      { id: 'lightl', type: 'raster', source: 'lightl', paint: { 'raster-fade-duration': 0 } },
      { id: 'hires', type: 'raster', source: 'hires', layout: { visibility: 'none' } },
      { id: 'a_img', type: 'line', source: 'e' }, { id: 'a_over', type: 'line', source: 'e' },
    ] },
  });
  m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  m.__imgs = new Set();
  m.__ready = new Promise(res => m.on('load', () => { addVectors(m); res(); }));
  return m;
}
function addVectors(m) {
  const add = (id, data) => m.addSource(id, { type: 'geojson', data });
  add('aoi', { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: AOI_RING } });
  add('rivers', GEO.rivers); add('roads', GEO.roads); add('river_hit', GEO.river_hit); add('buildings', GEO.buildings);
  add('damage', GEO.damage); add('dots', centroids); add('route', GEO.route); add('runout', GEO.runout); add('cuts', GEO.road_cuts); add('head', empty);
  const L = (id, type, source, paint, extra = {}) => m.addLayer({ id, type, source, paint, layout: { visibility: 'none', ...(extra.layout || {}) }, ...(extra.filter ? { filter: extra.filter } : {}), ...(extra.minzoom ? { minzoom: extra.minzoom } : {}), ...(extra.maxzoom ? { maxzoom: extra.maxzoom } : {}) });
  m.addLayer({ id: 'aoi', type: 'line', source: 'aoi', paint: { 'line-color': '#0B3C2C', 'line-width': 1.6 } });
  L('rivers', 'line', 'rivers', { 'line-color': '#7CC8FF', 'line-opacity': .8, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, ['match', ['get', 'class'], 3, 1.6, 2, 1, .4], 15, ['match', ['get', 'class'], 3, 4, 2, 2.6, 1.3]] }, { layout: { 'line-cap': 'round', 'line-join': 'round' } });
  L('roads', 'line', 'roads', { 'line-color': '#FFFFFF', 'line-opacity': .85, 'line-width': ['match', ['get', 'class'], 'trunk', 2.4, 'primary', 2.4, 'secondary', 1.8, 1.2] }, { layout: { 'line-cap': 'round' } });
  L('river_hit_c', 'line', 'river_hit', { 'line-color': '#FFFFFF', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2.6, 15, 6.5] }, { layout: { 'line-cap': 'round', 'line-join': 'round' } });
  L('river_hit', 'line', 'river_hit', { 'line-color': '#00A6F2', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 15, 4.5] }, { layout: { 'line-cap': 'round', 'line-join': 'round' } });
  L('runout', 'line', 'runout', { 'line-color': '#FFFFFF', 'line-opacity': .7, 'line-width': 1.2, 'line-dasharray': [1.5, 1.5] });
  L('b_dot', 'circle', 'buildings', { 'circle-color': tierColor, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 1.8, 13, 2.8, 15.4, 4], 'circle-stroke-color': '#111', 'circle-stroke-width': .6 }, { maxzoom: 15.4 });
  L('b_fill', 'fill', 'buildings', { 'fill-color': tierColor, 'fill-outline-color': '#111' }, { minzoom: 15.4 });
  L('d_fill', 'fill', 'damage', { 'fill-color': clsColor, 'fill-opacity': ['case', ['==', ['get', 'rating'], 'Not reviewed'], .5, .86] });
  L('d_line', 'line', 'damage', { 'line-color': '#FFFFFF', 'line-width': 1 });
  L('d_dot', 'circle', 'dots', { 'circle-color': clsColor, 'circle-opacity': ['interpolate', ['linear'], ['zoom'], 12.6, .95, 14, 0], 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, ['+', 2.5, ['*', 1.2, ['sqrt', ['get', 'ha']]]], 13, ['+', 3.5, ['*', 1.8, ['sqrt', ['get', 'ha']]]]], 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 1, 'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 12.6, 1, 14, 0] }, { maxzoom: 14 });
  L('route_c', 'line', 'route', { 'line-color': '#0A2B20', 'line-width': 4.5, 'line-opacity': .55 }, { layout: { 'line-cap': 'round', 'line-join': 'round' } });
  L('route', 'line', 'route', { 'line-color': '#FFFFFF', 'line-width': 2, 'line-dasharray': [2.4, 1.6] }, { layout: { 'line-cap': 'round', 'line-join': 'round' } });
  L('head', 'circle', 'head', { 'circle-color': '#FFFFFF', 'circle-radius': 6, 'circle-stroke-color': CLS.debris.c, 'circle-stroke-width': 3 });
  L('cuts', 'circle', 'cuts', { 'circle-color': '#111', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3.5, 15, 6.5], 'circle-stroke-color': '#FFF', 'circle-stroke-width': 2 });
  LABELS.forEach(([n, lo, la, anchor, offset]) => new maplibregl.Marker({ element: Object.assign(document.createElement('div'), { className: 'mlabel', textContent: n }), anchor, offset }).setLngLat([lo, la]).addTo(m));
}
const setVis = (m, id, on) => { if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); };
function ensureImage(m, key, anchor = 'a_img') {
  const id = 'i_' + key;
  if (!m.__imgs.has(key)) {
    const [url, box] = IMG[key];
    m.addSource(id, { type: 'image', url, coordinates: corners(box) });
    m.addLayer({ id, type: 'raster', source: id, layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 0, 'raster-resampling': 'linear' } }, anchor);
    m.__imgs.add(key);
  }
  return id;
}
function setBase(m, key, quiet) {
  m.__imgs.forEach(k => { if (!k.startsWith('o_')) setVis(m, 'i_' + k, false); });
  setVis(m, 'hires', key === 'hires');
  if (key && key !== 'hires') setVis(m, ensureImage(m, key), true);
  if (!quiet && key) watchLoad(m);
}
function applyVis(m, v, outline) {
  const cls = ['debris', 'slope', 'flood', 'water'].filter(k => v[k]);
  const tiers = [3, 2, 1].filter(k => v['t' + k]);
  const fc = ['in', ['get', 'cls'], ['literal', cls]], ft = ['in', ['get', 'tier'], ['literal', tiers]];
  ['d_fill', 'd_line', 'd_dot'].forEach(id => { setVis(m, id, cls.length); if (m.getLayer(id)) m.setFilter(id, fc); });
  setVis(m, 'd_fill', cls.length && !outline);
  ['b_dot', 'b_fill'].forEach(id => { setVis(m, id, tiers.length); if (m.getLayer(id)) m.setFilter(id, ft); });
  if (m.getLayer('d_line')) { m.setPaintProperty('d_line', 'line-color', outline ? clsColor : '#FFFFFF'); m.setPaintProperty('d_line', 'line-width', outline ? 2.4 : 1); m.setPaintProperty('d_line', 'line-opacity', 1); }
  [['route', 'route'], ['route_c', 'route'], ['runout', 'route'], ['river_hit', 'riverHit'], ['river_hit_c', 'riverHit'], ['rivers', 'rivers'], ['cuts', 'cuts'], ['roads', 'roads']].forEach(([id, k]) => setVis(m, id, v[k]));
  [['o_change', 'change'], ['o_prone', 'prone'], ['o_all', 'all']].forEach(([key, k]) => { if (v[k]) setVis(m, ensureImage(m, key, 'a_over'), true); else if (m.__imgs.has(key)) setVis(m, 'i_' + key, false); });
}
let loadTimer;
function showLoading(text) { $('#loading').hidden = false; $('#loadingText').textContent = text; }
function hideLoading() { $('#loading').hidden = true; }
function watchLoad(m) {
  clearTimeout(loadTimer);
  loadTimer = setTimeout(() => showLoading('Loading image'), 250);
  const done = () => { clearTimeout(loadTimer); hideLoading(); };
  m.once('idle', done);
  setTimeout(done, 9000);
}

const mapA = makeMap('mapA');
let mapB = null;
mapA.on('mousemove', e => { $('#coord').textContent = `${e.lngLat.lat.toFixed(4)}°N, ${e.lngLat.lng.toFixed(4)}°E`; });

/* Pins */
const pinEls = {};
const routeOrigin = [84.3362, 20.0028];
const placeByNum = n => DATA.places.find(p => String(p.num) === String(n));
const pinDist = {};
DATA.places.forEach(p => {
  pinDist[p.num] = Math.hypot((p.lon - routeOrigin[0]) * 104600, (p.lat - routeOrigin[1]) * 110540);
  const wrap = document.createElement('div');
  const b = document.createElement('button');
  b.className = 'pin'; b.style.background = CLS[p.cls].c; b.textContent = p.num; b.type = 'button'; b.setAttribute('aria-label', p.name);
  b.onclick = e => { e.stopPropagation(); openPlace(p.num); };
  wrap.append(b);
  new maplibregl.Marker({ element: wrap }).setLngLat([p.lon, p.lat]).addTo(mapA);
  pinEls[p.num] = b;
});
const maxDist = Math.max(...Object.values(pinDist));
function paintPins() {
  DATA.places.forEach(p => {
    const el = pinEls[p.num];
    el.classList.toggle('off', !state.vis.places || state.mode === 'compare');
    el.classList.toggle('dim', !!state.filter && p.cls !== state.filter);
    el.classList.toggle('active', String(state.place) === String(p.num));
  });
}

/* Panel pieces */
const ICON = {
  damage: '<path d="M12 3.5 21 19H3L12 3.5Z"/><path d="M12 10v4.2M12 16.8v.2"/>',
  timeline: '<circle cx="12" cy="12" r="8.5"/><path d="m10 8.5 5.5 3.5-5.5 3.5v-7Z"/>',
  compare: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M12 3v18"/><path d="m8.5 10-2 2 2 2M15.5 10l2 2-2 2"/>',
  places: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
  risk: '<path d="m3.5 11 8.5-7 8.5 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5.5h4V20"/>',
  method: '<path d="M6 3.5h9l3.5 3.5v13.5H6z"/><path d="M9 11h6.5M9 14.5h6.5M9 18h3.5"/>',
};
const MODES = [['damage', 'Damage'], ['timeline', 'Timeline'], ['compare', 'Compare'], ['places', 'Places'], ['risk', 'At risk'], ['method', 'Method']];
$('#rail').innerHTML = MODES.map(([k, n]) => `<button class="railbtn" type="button" data-mode="${k}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>${n}</button>`).join('');
$('#rail').onclick = e => { const b = e.target.closest('[data-mode]'); if (b) setMode(b.dataset.mode); };
$('#imagebar').innerHTML = BASES.map(b => `<button class="imgbtn" type="button" data-base="${b.k}"><b>${b.n}</b><span>${b.d}</span></button>`).join('');
$('#imagebar').onclick = e => { const b = e.target.closest('[data-base]'); if (b) { state.base = b.dataset.base; paintBase(); renderPanelFor(); } };
function paintKey() {
  const show = state.base === 'lc' && ['places', 'risk', 'method'].includes(state.mode);
  $('#mapkey').hidden = !show;
  if (show) $('#mapkey').innerHTML = LC.map(([n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join('');
}
function paintBase() {
  paintKey();
  document.querySelectorAll('[data-base]').forEach(b => b.setAttribute('aria-pressed', b.dataset.base === state.base));
  mapA.__ready.then(() => setBase(mapA, state.base));
}
function syncA() { mapA.__ready.then(() => { applyVis(mapA, state.vis); paintPins(); }); }

const swatch = (kind, color) => `<i class="sw ${kind || ''}" style="background:${color}"></i>`;
const rowsDef = () => ({
  damage: [
    ['debris', 'dot', CLS.debris.c, CLS.debris.n, `${S.patches.debris.ha} ha`], ['slope', 'dot', CLS.slope.c, CLS.slope.n, `${S.patches.slope.ha} ha`],
    ['flood', 'dot', CLS.flood.c, CLS.flood.n, `${S.patches.flood.ha} ha`], ['water', 'dot', CLS.water.c, CLS.water.n, `${S.patches.water.ha} ha`],
    ['route', 'dash', '#333', 'Likely flow path', `${(routeLen[routeLen.length - 1] / 1000).toFixed(1)} km`], ['places', 'dot', '#12211B', 'Numbered places', DATA.places.length],
  ],
  buildings: [['t3', '', TIER[3].c, TIER[3].n, num(S.tiers[3])], ['t2', '', TIER[2].c, TIER[2].n, num(S.tiers[2])], ['t1', '', TIER[1].c, TIER[1].n, num(S.tiers[1])], ['all', '', '#E7E1CE', 'All buildings', num(Object.values(S.tiers).reduce((a, b) => a + b, 0))]],
  rivers: [['riverHit', 'line', '#00A6F2', 'River reach in damage', `${riverKm} km`], ['rivers', 'line', '#7CC8FF', 'Rivers and streams', ''], ['cuts', 'dot', '#111', 'Possible road cuts', S.road_cuts], ['roads', 'line', '#9AA39D', 'Main roads', '']],
  more: [['change', '', 'linear-gradient(90deg,#F04612 50%,#46A0EB 50%)', 'Radar change, drop and rise', ''], ['prone', '', 'linear-gradient(90deg,#F0C450 50%,#D63C28 50%)', 'Landslide-prone ground', '']],
});
const riverKm = Object.values(S.river_km).reduce((a, b) => a + b, 0).toFixed(1);
const lrow = ([k, kind, color, name, val]) => `<button class="lrow" type="button" data-layer="${k}" aria-pressed="${!!state.vis[k]}">${swatch(kind, color)}<span>${name}</span><span class="val">${val}</span></button>`;
const landLegend = () => `<div class="grouphead">Land cover before the storm</div>` + LC.map(([n, c]) => `<div class="lrow">${swatch('', c)}<span>${n}</span><span class="val">${num(S.land_cover_ha[n])} ha</span></div>`).join('');
const legendBlock = () => {
  const r = rowsDef();
  return `${state.base === 'lc' ? landLegend() : ''}
    <div class="grouphead">Damage after the storm</div>${r.damage.map(lrow).join('')}
    <div class="grouphead">Buildings</div>${r.buildings.map(lrow).join('')}
    <div class="grouphead">Rivers and roads</div>${r.rivers.map(lrow).join('')}
    <details class="more"><summary>More layers</summary>${r.more.map(lrow).join('')}</details>`;
};
$('#panel').addEventListener('click', e => {
  const b = e.target.closest('[data-layer]');
  if (!b) return;
  const k = b.dataset.layer;
  state.vis[k] = state.vis[k] ? 0 : 1;
  b.setAttribute('aria-pressed', !!state.vis[k]);
  syncA();
});

function fieldsHit() {
  const u = S.under;
  const sum = n => ['debris', 'slope', 'flood', 'water'].reduce((a, k) => a + u[k][n], 0);
  return { fields: sum('Fields and scrub').toFixed(1), forest: sum('Dense forest').toFixed(1) };
}
function panelDamage() {
  const h = fieldsHit();
  const n = Object.values(S.patches).reduce((a, b) => a + b.n, 0);
  $('#panel').innerHTML = `<h1>Ganjam landslide damage</h1>
    <p class="meta">Ganjam-Kandhamal border, Odisha. Storm of 28 Oct 2026. Assessed 3 Nov.</p>
    <div class="kpis">
      <div class="kpi"><b>${S.total_ha} ha</b><span>damage mapped in ${n} patches</span></div>
      <div class="kpi"><b>${DATA.places.length}</b><span>places reviewed</span></div>
      <div class="kpi"><b>${S.tiers[3]}</b><span>buildings inside damage</span></div>
      <div class="kpi"><b>${S.tiers[2]}</b><span>buildings close to damage</span></div>
      <div class="kpi"><b>${riverKm} km</b><span>of rivers touch damage</span></div>
      <div class="kpi"><b>${S.road_cuts}</b><span>possible road cuts</span></div>
      <div class="kpi"><b>${h.fields} ha</b><span>fields under damage</span></div>
      <div class="kpi"><b>${h.forest} ha</b><span>forest under damage</span></div>
    </div>
    <p class="caveat">From satellite data. Not yet field-checked.</p>
    ${legendBlock()}`;
}

/* Places */
function panelPlaces() {
  const ord = ['site', 'debris', 'slope', 'flood', 'water'];
  const shown = DATA.places.filter(p => !state.filter || p.cls === state.filter);
  const chips = `<button class="chip" type="button" data-filter="" aria-pressed="${!state.filter}">All ${DATA.places.length}</button>` + ord.map(k => `<button class="chip" type="button" data-filter="${k}" aria-pressed="${state.filter === k}"><i style="background:${CLS[k].c}"></i>${CLS[k].n} ${DATA.places.filter(p => p.cls === k).length}</button>`).join('');
  $('#panel').innerHTML = `<h2>${DATA.places.length} places, by damage type</h2><div class="chips">${chips}</div>` + ord.map(k => {
    const list = shown.filter(p => p.cls === k);
    return list.length ? `<div class="grouphead">${CLS[k].n}</div>` + list.map(p => `<button class="place" type="button" data-place="${p.num}"><span class="num" style="background:${CLS[k].c}">${p.num}</span><span><b>${p.name}</b><small>${CONF[p.rating]}${p.rating === 'Best match' ? '' : ' confidence'}</small></span><span class="ha">${p.mapped_ha ? p.mapped_ha + ' ha' : ''}</span></button>`).join('') : '';
  }).join('');
}
const PLANET_STATE = { clear: ['good', 'Clear'], part: ['mid', 'Part cloud'], cloud: ['bad', 'Cloud'], none: ['bad', 'No image'] };
function radarChart(p) {
  if (!p.vv) return '';
  const days = ['31 Aug', '12 Sep', '24 Sep', '6 Oct', '18 Oct', '30 Oct'];
  const W = 300, H = 104, L = 8, R = 62, T = 8, B = 20;
  const all = [...p.vv, ...p.ground];
  const lo = Math.min(...all) - .6, hi = Math.max(...all) + .6;
  const x = i => L + i * (W - L - R) / 5, y = v => T + (hi - v) / (hi - lo) * (H - T - B);
  const path = a => a.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  const dots = (a, c) => a.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="${i === 5 ? 4 : 2.8}" fill="${c}" stroke="#fff" stroke-width="1"><title>${days[i]}: ${v} dB</title></circle>`).join('');
  const col = CLS[p.cls].c;
  return `<div class="grouphead">Radar signal over six passes, dB</div><svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="Radar signal at this place falls on 30 October while nearby ground holds">
    <path d="${path(p.ground)}" fill="none" stroke="#9AA39D" stroke-width="2"/><path d="${path(p.vv)}" fill="none" stroke="${col}" stroke-width="2"/>${dots(p.ground, '#9AA39D')}${dots(p.vv, col)}
    <text x="${x(5) + 8}" y="${y(p.vv[5]) + 4}">This place</text><text x="${x(5) + 8}" y="${y(p.ground[5]) + 4}">Nearby</text>
    <text x="${x(0)}" y="${H - 5}" text-anchor="start">31 Aug</text><text x="${x(5)}" y="${H - 5}" text-anchor="end">30 Oct</text></svg>`;
}
function panelPlace(n) {
  const p = placeByNum(n);
  const pl = PLANET_STATE[p.planet_after];
  const mini = (s, w) => `<button type="button" data-matrix="${p.num}" aria-label="Open all satellites"><img src="c/${p.num}_${s}_${w}.webp" alt="" loading="lazy"></button>`;
  $('#panel').innerHTML = `<button class="back" type="button" data-back="1"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 2 4 7l5 5"/></svg>All places</button>
    <div class="detailhead"><span class="num" style="background:${CLS[p.cls].c}">${p.num}</span><div><h2>${p.name}</h2><small>${CLS[p.cls].n}, ${CONF[p.rating].toLowerCase()}${p.rating === 'Best match' ? '' : ' confidence'}</small></div></div>
    <p class="body">${p.text}</p>
    <dl class="facts">
      ${p.mapped_ha ? `<dt>Damage mapped</dt><dd>${p.mapped_ha} ha, ${p.patches} patch${p.patches > 1 ? 'es' : ''}</dd>` : ''}
      ${p.drop != null ? `<dt>Radar drop</dt><dd>${p.drop} dB</dd>` : ''}
      <dt>Height</dt><dd>${p.z_top === p.z_bot ? p.z_top : p.z_bot + ' to ' + p.z_top} m</dd>
      <dt>Buildings within 500 m</dt><dd>${p.n500}</dd>
      <dt>Inside or close to damage</dt><dd>${p.t3 + p.t2}</dd>
      <dt>Coordinates</dt><dd>${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}</dd>
    </dl>
    <div class="grouphead">Satellite views after the storm</div>
    <dl class="facts" style="margin-top:3px">
      <dt>Sentinel-1, 30 Oct</dt><dd><span class="state ${p.drop != null ? 'good' : 'bad'}"><i></i>${p.drop != null ? 'Signal fell' : 'No strong signal'}</span></dd>
      <dt>PlanetScope, 1 Nov</dt><dd><span class="state ${pl[0]}"><i></i>${pl[1]}</span></dd>
      <dt>Sentinel-2, 2 Nov</dt><dd><span class="state bad"><i></i>${p.s2_after_cloud >= 90 ? 'All cloud' : p.s2_after_cloud + '% cloud'}</span></dd>
    </dl>
    <div class="mini"><span></span><span>Planet</span><span>S-2</span><span>S-1</span>
      <span class="r">Before</span>${mini('planet', 'before')}${mini('s2', 'before')}${mini('s1', 'before')}
      <span class="r">After</span>${mini('planet', 'after')}${mini('s2', 'after')}${mini('s1', 'after')}</div>
    <div class="btnrow"><button class="btn primary small" type="button" data-matrix="${p.num}">Open large</button><button class="btn small" type="button" data-copy="${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}">Copy coordinates</button></div>
    ${radarChart(p)}`;
}
function openPlace(n) {
  state.place = n;
  if (state.mode !== 'places') setMode('places', { keepPlace: true });
  panelPlace(n);
  $('#panel').scrollTop = 0;
  paintPins();
  const p = placeByNum(n);
  mapA.flyTo({ center: [p.lon, p.lat], zoom: Math.max(p.zoom - .6, 13), duration: REDUCED ? 0 : 1400, essential: true, padding: { left: 0 } });
  history.replaceState(null, '', `#places/${n}`);
}

/* At risk */
function panelRisk() {
  const r = rowsDef();
  const cuts = GEO.road_cuts.features.map((f, i) => `<button class="srow" type="button" style="grid-template-columns:1fr auto" data-fly="${f.geometry.coordinates[1]},${f.geometry.coordinates[0]}"><b>${f.properties.name || 'Unnamed village road'}</b><span class="c" style="font-weight:400;color:var(--ink2)">${f.geometry.coordinates[1].toFixed(3)}, ${f.geometry.coordinates[0].toFixed(3)}</span></button>`).join('');
  $('#panel').innerHTML = `<h2>Buildings and roads at risk</h2>
    <p class="meta">Groups show exposure, not confirmed loss. 10 m radar cannot see one house.</p>
    <div class="grouphead">Buildings</div>${r.buildings.map(lrow).join('')}
    <div class="grouphead">Settlements to check first</div>
    <div class="srow head"><span>Settlement</span><span class="c">In</span><span class="c">Close</span></div>
    ${DATA.settlements.slice(0, 10).map(s => `<button class="srow" type="button" data-fly="${s.lat},${s.lon}"><span><b>${s.name}</b><small>${s.area}</small></span><span class="c">${s.t3}</span><span class="c">${s.t2}</span></button>`).join('')}
    <div class="grouphead">Possible road cuts, ${S.road_cuts}</div>${cuts}
    <p class="caveat">${S.road_km_in} km of road inside damage. ${S.road_km_near} km within 100 m.</p>`;
}

/* Method */
function panelMethod() {
  const c = DATA.control;
  const d = Object.values(S.patches).reduce((a, b) => a + b.n, 0);
  $('#panel').innerHTML = `<h2>How this was read</h2>
    <ol class="steps">
      <li><b>Radar</b><span>Sentinel-1, 30 Oct against five earlier passes, 10 m.</span></li>
      <li><b>Optical</b><span>Sentinel-2 at 10 m, cloud gaps filled from other October passes. PlanetScope previews at 55 m.</span></li>
      <li><b>Land cover</b><span>Rules on Sentinel-2 images of 23 Oct and January to March. Flat valley floors count as farmland.</span></li>
      <li><b>Damage type</b><span>Slope, stream size and height above the stream.</span></li>
      <li><b>Exposure</b><span>${num(Object.values(S.tiers).reduce((a, b) => a + b, 0))} building outlines, roads and DEM drainage.</span></li>
    </ol>
    <div class="grouphead">Strict radar test on normal dates</div>
    <div class="srow head" style="grid-template-columns:1fr auto"><span>Pass</span><span>Strong drops found</span></div>
    <div class="srow" style="grid-template-columns:1fr auto"><span>6 Oct</span><span class="c">${c.control_6oct_drop.all}</span></div>
    <div class="srow" style="grid-template-columns:1fr auto"><span>18 Oct</span><span class="c">${c.control_18oct_drop.all}</span></div>
    <div class="srow" style="grid-template-columns:1fr auto"><b>30 Oct, after the storm</b><span class="c">${c.event_drop.all}</span></div>
    <div class="grouphead">Limits</div>
    <ul class="limits">
      <li>No field check yet. Damage types come from rules and image review.</li>
      <li>Sentinel-2 is all cloud on 28 Oct, 30 Oct and 2 Nov.</li>
      <li>PlanetScope here is a 55 m preview. Full 3 m data needs an order.</li>
      <li>${S.not_reviewed.n} of ${d} patches (${S.not_reviewed.ha} ha) are not yet reviewed.</li>
      <li>Rain is modelled, not gauged.</li>
    </ul>
    <div class="grouphead">Downloads</div>
    <div class="dl">
      <a class="btn small" href="dl/damage_patches.geojson" download>Damage patches, GeoJSON</a>
      <a class="btn small" href="dl/buildings_affected.csv" download>Buildings at risk, CSV</a>
      <a class="btn small" href="dl/places.csv" download>Places, CSV</a>
      <a class="btn small" href="bhoomicam_locations.kml" download>Places, KML</a>
    </div>
    <div class="contact"><a href="mailto:support@bhoomicam.com">support@bhoomicam.com</a><a href="tel:+919045865902">+91 9045865902</a><a href="https://www.bhoomicam.com">www.bhoomicam.com</a></div>`;
}
function renderPanelFor() {
  if (state.mode === 'damage') panelDamage();
}

/* Panel clicks */
$('#panel').addEventListener('click', e => {
  const t = e.target;
  const place = t.closest('[data-place]');
  if (place) return openPlace(place.dataset.place);
  const f = t.closest('[data-filter]');
  if (f) { state.filter = f.dataset.filter || null; panelPlaces(); paintPins(); return fitFiltered(); }
  if (t.closest('[data-back]')) { state.place = null; panelPlaces(); paintPins(); history.replaceState(null, '', '#places'); return fitFiltered(); }
  const fly = t.closest('[data-fly]');
  if (fly) { const [la, lo] = fly.dataset.fly.split(',').map(Number); return mapA.flyTo({ center: [lo, la], zoom: 14.6, duration: REDUCED ? 0 : 1300 }); }
  const mx = t.closest('[data-matrix]');
  if (mx) return setMode('compare', { view: 'grid', place: mx.dataset.matrix });
  const cp = t.closest('[data-copy]');
  if (cp) { navigator.clipboard && navigator.clipboard.writeText(cp.dataset.copy); cp.textContent = 'Copied'; setTimeout(() => { cp.textContent = 'Copy coordinates'; }, 1200); return; }
  const sens = t.closest('[data-sensor]');
  if (sens) return setSensor(sens.dataset.sensor);
  const ev = t.closest('[data-ev]');
  if (ev) { pause(); return setT(+ev.dataset.ev); }
  const pr = t.closest('[data-pair]');
  if (pr) { cmp.pair = pr.dataset.pair; cmp.view = 'swipe'; return paintCompare(); }
  const vw = t.closest('[data-view]');
  if (vw) { cmp.view = vw.dataset.view; return paintCompare(); }
  const go = t.closest('[data-go]');
  if (go) return (mapB && cmp.view === 'swipe' ? mapB : mapA).fitBounds(PLACE_VIEWS[+go.dataset.go][1], { padding: 30, duration: REDUCED ? 0 : 1100 });
  if (t.closest('[data-outline]')) { cmp.outline = !cmp.outline; return paintCompare(); }
});
function fitFiltered() {
  const list = DATA.places.filter(p => !state.filter || p.cls === state.filter);
  const b = new maplibregl.LngLatBounds();
  list.forEach(p => b.extend([p.lon, p.lat]));
  mapA.fitBounds(b, { padding: 70, maxZoom: 14, duration: REDUCED ? 0 : 1000 });
}

/* Timeline */
const dayOf = d => Date.parse(d + 'T00:00:00Z') / 864e5;
const T0 = dayOf('2026-09-24'), T1 = dayOf('2026-11-03');
const T28 = dayOf('2026-10-28'), T30 = dayOf('2026-10-30') + .24, N1 = dayOf('2026-11-01') + .2;
const FR = {};
const framePath = (s, d) => s === 'lc' ? '' : `f/${s}_${d}.webp`;
const frameOf = (s, d, id) => ({ d, t: dayOf(d) + .22, id: id || `fr_${s}_${d}`, src: framePath(s, d), box: s === 'planet' ? PBOX : BOX, thumb: `t/${s}_${d}.webp`, s });
Object.entries(DATA.frames).forEach(([s, days]) => { FR[s] = days.map(d => frameOf(s, d)); });
// Clearest image for each date: full PlanetScope scenes, the last clear Sentinel-2, cloud during the storm, radar, then the first part-clear view
const clearPlanet = DATA.passes.planet.filter(p => p.used && p.cover >= .9 && p.cloud < .2 && p.d <= '2026-10-26').map(p => ['planet', p.d]);
FR.best = [...clearPlanet, ['s2', '2026-10-23'], ['planet', '2026-10-27'], ['s2', '2026-10-28'], ['s1', '2026-10-30'], ['planet', '2026-11-01']].map(([s, d]) => frameOf(s, d, `fr_best_${s}_${d}`)).sort((a, b) => a.t - b.t);
const SENSORS = { best: 'Best view', planet: 'PlanetScope', s2: 'Sentinel-2', s1: 'Sentinel-1' };
const SENSOR_NOTE = { best: 'Clearest image for each date', planet: 'Daily look, 55 m preview', s2: 'Sharp, blocked by cloud after 23 Oct', s1: 'Radar, sees through cloud' };
const rainBy = Object.fromEntries(DATA.rain);
const EVENTS = [
  { t: dayOf('2026-10-23'), end: dayOf('2026-10-25') + .5, d: '23 Oct', short: 'Last clear Sentinel-2 view', txt: '<b>23 Oct.</b> Last clear Sentinel-2 view.' },
  { t: dayOf('2026-10-27'), end: T28, d: '27 Oct', short: 'Heavy rain starts', txt: '<b>27 Oct.</b> Heavy rain starts.' },
  { t: T28, end: T28 + 1.5, d: '28 Oct', short: 'Landslide reported, 150 mm of rain', txt: '<b>28 Oct.</b> Landslide reported. 150 mm of rain in one day.' },
  { t: T28 + 1.5, end: T30, d: '29 Oct', short: 'Optical satellites see only cloud', txt: '<b>29 Oct.</b> Optical satellites see only cloud.' },
  { t: T30, end: N1 - .1, d: '30 Oct', short: 'Radar pass shows the damage', txt: `<b>30 Oct, 05:42.</b> Radar sees through cloud. ${Object.values(S.patches).reduce((a, b) => a + b.n, 0)} damage patches.` },
  { t: N1, end: T1 - .4, d: '1 Nov', short: 'PlanetScope, first part-clear view', txt: '<b>1 Nov.</b> First part-clear view. Pale channels and silt.' },
  { t: T1 - .4, end: T1 + 1, d: '2 Nov', short: 'Sentinel-2 still all cloud', txt: '<b>2 Nov.</b> Sentinel-2 still all cloud.' },
];
const tl = { t: dayOf('2026-10-10'), playing: false, speed: 1, sensor: 'best', last: 0, played: false, ready: {}, shown: {}, ev: null, day: null, routeFrac: -1, dk: -1, active: false };
function routeSlice(f) {
  const target = routeLen[routeLen.length - 1] * f;
  const pts = [routeCoords[0]];
  for (let i = 1; i < routeCoords.length; i++) {
    if (routeLen[i] <= target) pts.push(routeCoords[i]);
    else { const k = (target - routeLen[i - 1]) / (routeLen[i] - routeLen[i - 1]); pts.push([routeCoords[i - 1][0] + (routeCoords[i][0] - routeCoords[i - 1][0]) * k, routeCoords[i - 1][1] + (routeCoords[i][1] - routeCoords[i - 1][1]) * k]); break; }
  }
  return pts;
}
function warp(t) { return t > dayOf('2026-10-27') && t < dayOf('2026-11-01') + .6 ? .3 : 1; }

function panelTimeline() {
  const lastOf = s => { const fs = FR[s]; let f = fs[0]; fs.forEach(x => { if (x.t <= tl.t) f = x; }); return f; };
  $('#panel').innerHTML = `<h2>Timeline of the storm</h2><p class="meta">Pick a satellite. Press play or drag the bar.</p>
    <div style="margin-top:11px">${Object.keys(SENSORS).map(s => { const f = lastOf(s); return `<button class="sensor" type="button" data-sensor="${s}" aria-pressed="${tl.sensor === s}"><span class="tn"><img id="th_${s}" src="${f.thumb}" alt=""></span><span><b>${SENSORS[s]}</b><small id="thd_${s}">${fmt(f.d)}</small><small>${SENSOR_NOTE[s]}</small></span></button>`; }).join('')}</div>
    <div class="grouphead">What happened</div>
    ${EVENTS.map((e, i) => `<button class="ev" type="button" data-ev="${e.t + .02}" id="ev${i}"><b>${e.d}</b><span>${e.short}</span></button>`).join('')}
    <div class="grouphead">Damage markers</div>
    ${['debris', 'slope', 'flood', 'water'].map(k => `<div class="lrow">${swatch('dot', CLS[k].c)}<span>${CLS[k].n}</span><span class="val">${S.patches[k].n}</span></div>`).join('')}`;
}
function dockHTML() {
  return `<div class="dockl"><div><div class="dockdate" id="dkDate"></div><div class="dockrain" id="dkRain"></div></div>
    <div class="playrow"><button class="play" id="playBtn" type="button" aria-label="Play"></button><button class="speed" id="speedBtn" type="button" aria-label="Playback speed">1x</button></div></div>
    <div class="track" id="track"></div>`;
}
const PLAY = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M3.5 1.5v13l11-6.5z"/></svg>';
const PAUSE = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="3" y="2" width="3.6" height="12" rx="1"/><rect x="9.4" y="2" width="3.6" height="12" rx="1"/></svg>';
let trackW = 800, TL = 92, TR = 6;
const tx = t => TL + (t - T0) / (T1 - T0) * (trackW - TL - TR);
function drawTrack() {
  const el = $('#track');
  const narrow = el.clientWidth < 520;
  TL = narrow ? 56 : 92;
  trackW = Math.max(el.clientWidth - (narrow ? 14 : 12), 240);
  const lanes = [['planet', narrow ? 'Planet' : 'PlanetScope', 62], ['s2', narrow ? 'S-2' : 'Sentinel-2', 79], ['s1', narrow ? 'S-1' : 'Sentinel-1', 96]];
  const H = 108;
  const maxR = Math.max(...DATA.rain.map(r => r[1]));
  const bw = Math.max((trackW - TL - TR) / (T1 - T0) - 1.5, 1.5);
  const bars = DATA.rain.map(([d, v]) => { const h = v / maxR * 34; return v > .4 ? `<rect x="${tx(dayOf(d)).toFixed(1)}" y="${(38 - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="#5AA7DB"><title>${fmt(d)}: ${v} mm</title></rect>` : ''; }).join('');
  const ticks = [];
  for (let t = T0 + 7; t < T1; t += narrow ? 14 : 7) ticks.push(`<line x1="${tx(t)}" x2="${tx(t)}" y1="42" y2="46" stroke="#9AA39D"/><text x="${tx(t)}" y="55" text-anchor="middle">${fmt(new Date(t * 864e5).toISOString().slice(0, 10))}</text>`);
  const dots = lanes.map(([s, label, y]) => {
    const list = s === 'planet' ? DATA.passes.planet.map(p => ({ d: p.d, ok: p.used && p.cloud < .4, used: p.used, tip: `${p.d}` })) : s === 's2' ? DATA.passes.s2.map(p => ({ d: p.d, ok: p.cloud < 50, used: true, tip: `${p.cloud}% cloud` })) : DATA.passes.s1.map(p => ({ d: p.d, ok: true, used: true, tip: 'Radar' }));
    return `<text class="lane" x="${TL - 9}" y="${y + 4}" text-anchor="end">${label}</text><line x1="${TL}" x2="${trackW - TR}" y1="${y}" y2="${y}" stroke="#E3E7E1"/>` + list.map(p => `<circle cx="${tx(dayOf(p.d) + .22).toFixed(1)}" cy="${y}" r="${p.used ? 4 : 2}" fill="${p.ok ? '#0B3C2C' : '#fff'}" stroke="${p.used ? '#0B3C2C' : '#B6BFB8'}" stroke-width="1.5"><title>${fmt(p.d)}: ${p.ok ? 'clear' : p.used ? 'cloud' : 'cloud or small coverage'}</title></circle>`).join('');
  }).join('');
  const rainLabel = narrow ? '' : `<text class="lane" x="${TL - 9}" y="26" text-anchor="end">Rain</text>`;
  const peak = `<text x="${(tx(T28) + bw + 4).toFixed(1)}" y="11">150 mm</text>`;
  el.innerHTML = `<svg viewBox="0 0 ${trackW} ${H}" height="${H}" role="slider" tabindex="0" aria-label="Timeline date" aria-valuemin="${T0}" aria-valuemax="${T1}" id="trackSvg">
    ${rainLabel}${bars}${peak}${ticks.join('')}${dots}
    <rect x="${tx(T28)}" y="0" width="${tx(T30) - tx(T28)}" height="${H}" fill="#E8590C" opacity=".1"/>
    <g id="head"><line y1="0" y2="${H}" stroke="#12211B" stroke-width="2"/><circle cy="4" r="5" fill="#12211B"/></g></svg>`;
  $('.stage').style.setProperty('--dockh', `${$('#dock').offsetHeight + 16}px`);
  tl.day = null;
  paintT();
}
function ensureFrames(sensor) {
  if (tl.ready[sensor]) return tl.ready[sensor];
  const fs = FR[sensor];
  let n = 0;
  showLoading(`Loading ${SENSORS[sensor]} images 0 of ${fs.length}`);
  tl.ready[sensor] = Promise.all(fs.map(f => new Promise(res => {
    const im = new Image();
    im.onload = im.onerror = () => { n++; if (tl.sensor === sensor && tl.active) showLoading(`Loading ${SENSORS[sensor]} images ${n} of ${fs.length}`); res(); };
    im.src = f.src;
  }))).then(() => mapA.__ready).then(() => {
    fs.forEach(f => {
      mapA.addSource(f.id, { type: 'image', url: f.src, coordinates: corners(f.box) });
      mapA.addLayer({ id: f.id, type: 'raster', source: f.id, layout: { visibility: 'none' }, paint: { 'raster-opacity': 0, 'raster-fade-duration': 0, ...(f.s === 'planet' && f.d === '2026-10-27' ? { 'raster-brightness-max': .8 } : {}) } }, 'a_img');
    });
    hideLoading();
  });
  return tl.ready[sensor];
}
function hideFrames() {
  Object.keys(tl.shown).forEach(id => { if (mapA.getLayer(id)) { mapA.setPaintProperty(id, 'raster-opacity', 0); mapA.setLayoutProperty(id, 'visibility', 'none'); } });
  tl.shown = {};
}
function paintFrames(t) {
  const fs = FR[tl.sensor];
  if (!fs.length || !mapA.getLayer(fs[0].id)) return;
  let i = 0;
  fs.forEach((f, k) => { if (f.t <= t) i = k; });
  const cur = fs[i], next = fs[i + 1];
  let a = 0;
  if (next && t >= cur.t) { const gap = next.t - cur.t, w = Math.min(gap * .75, 1.6); a = smooth((t - (next.t - w)) / w); }
  const want = { [cur.id]: 1 };
  if (i > 0) want[fs[i - 1].id] = 1;  // part-coverage scenes show the previous image in their gaps
  if (next && a > .004) want[next.id] = a;
  Object.keys(tl.shown).forEach(id => { if (!(id in want)) { mapA.setPaintProperty(id, 'raster-opacity', 0); mapA.setLayoutProperty(id, 'visibility', 'none'); delete tl.shown[id]; } });
  Object.entries(want).forEach(([id, v]) => {
    if (!(id in tl.shown)) mapA.setLayoutProperty(id, 'visibility', 'visible');
    if (Math.abs((tl.shown[id] ?? -1) - v) > .004) { mapA.setPaintProperty(id, 'raster-opacity', v); tl.shown[id] = v; }
  });
  Object.keys(SENSORS).forEach(s => {
    let f = FR[s][0];
    FR[s].forEach(x => { if (x.t <= t) f = x; });
    const th = document.getElementById('th_' + s);
    if (th && !th.src.endsWith(f.thumb)) { th.src = f.thumb; document.getElementById('thd_' + s).textContent = fmt(f.d); }
  });
}
function paintT() {
  const t = tl.t;
  if (!$('#head')) return;
  $('#head').setAttribute('transform', `translate(${tx(t).toFixed(1)} 0)`);
  const day = Math.floor(t);
  if (day !== tl.day) {
    tl.day = day;
    const iso = new Date(day * 864e5).toISOString().slice(0, 10);
    $('#dkDate').textContent = fmt(iso);
    const r = rainBy[iso];
    $('#dkRain').textContent = r != null ? `Rain ${Math.round(r)} mm` : 'Rain not available';
    const svg = $('#trackSvg'); if (svg) { svg.setAttribute('aria-valuenow', day); svg.setAttribute('aria-valuetext', fmt(iso)); }
  }
  paintFrames(t);
  // Markers come in as the story reaches them
  const k = smooth((t - T30) / .28);
  if (Math.abs(k - tl.dk) > .01) {
    tl.dk = k;
    const on = k > 0;
    ['d_fill', 'd_line', 'd_dot'].forEach(id => setVis(mapA, id, on));
    if (on) {
      mapA.setPaintProperty('d_fill', 'fill-opacity', k * .86);
      mapA.setPaintProperty('d_line', 'line-opacity', k);
      mapA.setPaintProperty('d_dot', 'circle-opacity', ['interpolate', ['linear'], ['zoom'], 12.6, .95 * k, 14, 0]);
      mapA.setPaintProperty('d_dot', 'circle-stroke-opacity', ['interpolate', ['linear'], ['zoom'], 12.6, k, 14, 0]);
    }
  }
  const f = smooth((t - T28) / 1.7);
  if (Math.abs(f - tl.routeFrac) > .004) {
    tl.routeFrac = f;
    const on = f > 0;
    setVis(mapA, 'route', on); setVis(mapA, 'route_c', on); setVis(mapA, 'head', on && f < 1);
    if (on) {
      const pts = routeSlice(f);
      mapA.getSource('route').setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts.length > 1 ? pts : [pts[0], pts[0]] } });
      mapA.getSource('head').setData({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: pts[pts.length - 1] } });
    }
  }
  DATA.places.forEach(p => {
    const el = pinEls[p.num];
    const at = p.num === 'H' ? T28 + .15 : T30 + pinDist[p.num] / maxDist * .55;
    const off = t < at;
    if (el.classList.contains('off') && !off && tl.playing && !REDUCED) { el.classList.add('ping'); setTimeout(() => el.classList.remove('ping'), 2500); }
    el.classList.toggle('off', off);
  });
  let cur = -1;
  EVENTS.forEach((e, i) => { if (t >= e.t && t < e.end) cur = i; });
  if (cur !== tl.ev) {
    tl.ev = cur;
    const toast = $('#toast');
    if (cur < 0) toast.hidden = true;
    else { toast.hidden = true; toast.innerHTML = EVENTS[cur].txt; void toast.offsetWidth; toast.hidden = false; }
    EVENTS.forEach((_, i) => { const el = document.getElementById('ev' + i); if (el) el.classList.toggle('now', i === cur); });
  }
}
function setT(t) { tl.t = Math.max(T0, Math.min(T1, t)); paintT(); }
function play() {
  if (tl.t >= T1 - .01) setT(T0);
  tl.playing = true; tl.played = true; tl.last = performance.now();
  const b = $('#playBtn'); if (b) { b.innerHTML = PAUSE; b.setAttribute('aria-label', 'Pause'); }
  requestAnimationFrame(tick);
}
function pause() {
  tl.playing = false;
  const b = $('#playBtn'); if (b) { b.innerHTML = PLAY; b.setAttribute('aria-label', 'Play'); }
}
function tick(now) {
  if (!tl.playing) return;
  const dt = Math.min((now - tl.last) / 1000, .08);
  tl.last = now;
  const nt = tl.t + dt * 1.5 * tl.speed * warp(tl.t);
  if (nt >= T1) { setT(T1); pause(); return; }
  setT(nt);
  requestAnimationFrame(tick);
}
async function setSensor(s) {
  const wasPlaying = tl.playing;
  pause();
  tl.sensor = s;
  document.querySelectorAll('[data-sensor]').forEach(b => b.setAttribute('aria-pressed', b.dataset.sensor === s));
  await ensureFrames(s);
  if (tl.sensor !== s || !tl.active) return;
  hideFrames();
  paintT();
  if (wasPlaying) play();
}
function enterTimeline() {
  $('#imagebar').hidden = true;
  $('#dock').hidden = false;
  $('#stage').dataset.dock = 'on';
  $('#dock').innerHTML = dockHTML();
  panelTimeline();
  $('#playBtn').innerHTML = PLAY;
  $('#playBtn').onclick = () => (tl.playing ? pause() : play());
  $('#speedBtn').onclick = e => { tl.speed = tl.speed === 1 ? 2 : tl.speed === 2 ? .5 : 1; e.currentTarget.textContent = `${tl.speed}x`; };
  const track = $('#track');
  const toT = e => { const r = track.querySelector('svg').getBoundingClientRect(); return T0 + ((e.clientX - r.left) / r.width * trackW - TL) / (trackW - TL - TR) * (T1 - T0); };
  let drag = false;
  track.onpointerdown = e => { drag = true; track.setPointerCapture(e.pointerId); pause(); setT(toT(e)); };
  track.onpointermove = e => { if (drag) setT(toT(e)); };
  track.onpointerup = () => { drag = false; };
  tl.active = true;
  drawTrack();
  mapA.__ready.then(async () => {
    if (!tl.active) return;
    setBase(mapA, null, true);
    applyVis(mapA, { ...NONE, debris: 1, slope: 1, flood: 1, water: 1 });
    mapA.getSource('route').setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [routeCoords[0], routeCoords[0]] } });
    tl.dk = -1; tl.routeFrac = -1; tl.ev = null;
    mapA.fitBounds(FOCUS, { padding: { top: 20, bottom: $('#dock').offsetHeight + 20, left: 20, right: 20 }, duration: 0 });
    paintT();
    await ensureFrames(tl.sensor);
    if (!tl.active) return;
    paintT();
    if (!tl.played && !REDUCED) play();
  });
}
function leaveTimeline() {
  pause();
  tl.active = false;
  $('#dock').hidden = true;
  $('#toast').hidden = true;
  delete $('#stage').dataset.dock;
  hideFrames();
  hideLoading();
  if (!mapA.getLayer('route')) return;
  mapA.getSource('route').setData(GEO.route);
  setVis(mapA, 'head', false);
  mapA.setPaintProperty('d_fill', 'fill-opacity', ['case', ['==', ['get', 'rating'], 'Not reviewed'], .5, .86]);
  mapA.setPaintProperty('d_dot', 'circle-opacity', ['interpolate', ['linear'], ['zoom'], 12.6, .95, 14, 0]);
  mapA.setPaintProperty('d_dot', 'circle-stroke-opacity', ['interpolate', ['linear'], ['zoom'], 12.6, 1, 14, 0]);
  $('#imagebar').hidden = false;
  document.querySelectorAll('.pin.off').forEach(p => p.classList.remove('off'));
}

/* Compare */
const PAIRS = [
  { id: 'class', n: 'Classified map', sub: 'Land cover, then damage', th: ['landcover', 'landcover'], a: ['lc', 'Land cover', 'Before the storm'], b: ['lc', 'Damage classes', 'After the storm'] },
  { id: 's1', n: 'Sentinel-1 radar', sub: '18 Oct to 30 Oct. Sees through cloud.', th: ['s1_2026-10-18', 's1_2026-10-30'], a: ['s1', 'Sentinel-1', 'Before, 18 Oct'], b: ['s1_after', 'Sentinel-1', 'After, 30 Oct'] },
  { id: 'planet', n: 'PlanetScope', sub: '22 Oct to 1 Nov. 55 m preview, part cloud.', th: ['planet_2026-10-22', 'planet_2026-11-01'], a: ['planet', 'PlanetScope', 'Before, 22 Oct'], b: ['planet_after', 'PlanetScope', 'After, 1 Nov'] },
  { id: 's2', n: 'Sentinel-2', sub: '23 Oct to 2 Nov. All cloud after.', th: ['s2_2026-10-23', 's2_2026-11-02'], a: ['s2', 'Sentinel-2', 'Before, 23 Oct'], b: ['s2_after', 'Sentinel-2', 'After, 2 Nov'] },
  { id: 'mix', n: 'Sentinel-2 and PlanetScope', sub: 'Best optical pair, 23 Oct and 1 Nov.', th: ['s2_2026-10-23', 'planet_2026-11-01'], a: ['s2', 'Sentinel-2', 'Before, 23 Oct'], b: ['planet_after', 'PlanetScope', 'After, 1 Nov'] },
];
const cmp = { pair: 'class', view: 'swipe', outline: true, x: 50, place: '7', synced: false };
const lcOnlyVis = { ...NONE, all: 1, rivers: 1 };
const afterVis = { ...NONE, debris: 1, slope: 1, flood: 1, water: 1, t3: 1, t2: 1, riverHit: 1, rivers: 1, cuts: 1, route: 1 };
const outlineVis = { ...NONE, debris: 1, slope: 1, flood: 1, water: 1 };
function panelCompare() {
  const pr = PAIRS.find(p => p.id === cmp.pair);
  $('#panel').innerHTML = `<h2>Before and after</h2>
    <div class="segment" role="group" aria-label="Compare view"><button type="button" data-view="swipe" aria-pressed="${cmp.view === 'swipe'}">Swipe</button><button type="button" data-view="grid" aria-pressed="${cmp.view === 'grid'}">All 3 satellites</button></div>
    ${cmp.view === 'swipe' ? `<div style="margin-top:11px">${PAIRS.map(p => `<button class="pair" type="button" data-pair="${p.id}" aria-pressed="${p.id === cmp.pair}"><span class="pairth"><img src="t/${p.th[0]}.webp" alt=""><img src="t/${p.th[1]}.webp" alt=""></span><span><b>${p.n}</b><small>${p.sub}</small></span></button>`).join('')}</div>
    <div class="grouphead">Go to</div><div class="btnrow" style="margin-top:4px">${PLACE_VIEWS.map((v, i) => `<button class="btn small" type="button" data-go="${i}">${v[0]}</button>`).join('')}</div>
    ${pr.id === 'class' ? `<div class="grouphead">Before, land cover</div>${LC.map(([n, c]) => `<div class="lrow">${swatch('', c)}<span>${n}</span></div>`).join('')}
    <div class="grouphead">After, damage</div>${['debris', 'slope', 'flood', 'water'].map(k => `<div class="lrow">${swatch('dot', CLS[k].c)}<span>${CLS[k].n}</span><span class="val">${S.patches[k].ha} ha</span></div>`).join('')}
    ${[3, 2].map(k => `<div class="lrow">${swatch('', TIER[k].c)}<span>Building, ${TIER[k].n.toLowerCase()}</span><span class="val">${num(S.tiers[k])}</span></div>`).join('')}
    <div class="lrow">${swatch('line', '#00A6F2')}<span>River reach in damage</span><span class="val">${riverKm} km</span></div>
    <div class="lrow">${swatch('dot', '#111')}<span>Possible road cut</span><span class="val">${S.road_cuts}</span></div>` : `<div class="btnrow"><button class="btn small" type="button" data-outline="1" aria-pressed="${cmp.outline}">${cmp.outline ? 'Hide' : 'Show'} damage outlines</button></div>
    <div style="margin-top:9px">${['debris', 'slope', 'flood', 'water'].map(k => `<div class="lrow">${swatch('line', CLS[k].c)}<span>${CLS[k].n}</span></div>`).join('')}</div>`}` : `<p class="meta" style="margin-top:11px">Same 3 km square from each satellite. Outlines mark mapped damage.</p>
    ${['debris', 'slope', 'flood', 'water'].map(k => `<div class="lrow">${swatch('line', CLS[k].c)}<span>${CLS[k].n}</span></div>`).join('')}`}`;
}
function setSplit(pct) {
  cmp.x = Math.max(1, Math.min(99, pct));
  $('#mapB').style.clipPath = `inset(0 0 0 ${cmp.x}%)`;
  $('#handle').style.left = `${cmp.x}%`;
  $('#handle').setAttribute('aria-valuenow', Math.round(cmp.x));
  const a = $('#tagA'), b = $('#tagB');
  a.style.left = b.style.left = `${cmp.x}%`;
  a.style.display = cmp.x < (innerWidth < 860 ? 42 : 20) ? 'none' : '';
  b.style.display = cmp.x > (innerWidth < 860 ? 58 : 80) ? 'none' : '';
}
function ensureB() {
  if (mapB) return;
  $('#mapB').hidden = false;
  mapB = makeMap('mapB');
  mapB.jumpTo({ center: mapA.getCenter(), zoom: mapA.getZoom() });
  let lock = false;
  const sync = (from, to) => from.on('move', () => { if (lock || !cmp.synced) return; lock = true; to.jumpTo({ center: from.getCenter(), zoom: from.getZoom() }); lock = false; });
  sync(mapA, mapB); sync(mapB, mapA);
}
function paintCompare() {
  panelCompare();
  const grid = cmp.view === 'grid';
  $('#matrix').hidden = !grid;
  $('#swipe').hidden = grid;
  if (grid) { $('#mapB').hidden = true; renderMatrix(); return; }
  ensureB();
  $('#mapB').hidden = false;
  mapB.resize();
  mapB.jumpTo({ center: mapA.getCenter(), zoom: mapA.getZoom() });
  cmp.synced = true;
  setSplit(cmp.x);
  const p = PAIRS.find(x => x.id === cmp.pair);
  $('#tagA').innerHTML = `<b>${p.a[1]}</b><span>${p.a[2]}</span>`;
  $('#tagB').innerHTML = `<b>${p.b[1]}</b><span>${p.b[2]}</span>`;
  const cl = p.id === 'class';
  Promise.all([mapA.__ready, mapB.__ready]).then(() => {
    if (state.mode !== 'compare' || cmp.view !== 'swipe') return;
    setBase(mapA, p.a[0], true); setBase(mapB, p.b[0]);
    applyVis(mapA, cl ? lcOnlyVis : cmp.outline ? outlineVis : NONE, !cl);
    applyVis(mapB, cl ? afterVis : cmp.outline ? outlineVis : NONE, !cl);
  });
}
const handle = $('#handle');
handle.addEventListener('pointerdown', e => {
  handle.setPointerCapture(e.pointerId);
  const r = $('#stage').getBoundingClientRect();
  const mv = ev => setSplit((ev.clientX - r.left) / r.width * 100);
  const up = () => { handle.removeEventListener('pointermove', mv); handle.removeEventListener('pointerup', up); };
  handle.addEventListener('pointermove', mv); handle.addEventListener('pointerup', up);
});
handle.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') setSplit(cmp.x - 3); if (e.key === 'ArrowRight') setSplit(cmp.x + 3); });

const HX = 1500 / 104600, HY = 1500 / 110540;
function outlinesFor(p) {
  const X = lo => (lo - (p.lon - HX)) / (2 * HX) * 300, Y = la => ((p.lat + HY) - la) / (2 * HY) * 300;
  const out = [];
  GEO.damage.features.forEach(f => {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    polys.forEach(poly => {
      const ring = poly[0];
      if (!ring.some(c => Math.abs(c[0] - p.lon) < HX && Math.abs(c[1] - p.lat) < HY)) return;
      out.push(`<path d="M${ring.map(c => `${X(c[0]).toFixed(1)} ${Y(c[1]).toFixed(1)}`).join('L')}Z" fill="none" stroke="${CLS[f.properties.cls].c}" stroke-width="2.2" paint-order="stroke"/><path d="M${ring.map(c => `${X(c[0]).toFixed(1)} ${Y(c[1]).toFixed(1)}`).join('L')}Z" fill="none" stroke="#fff" stroke-width=".700"/>`);
    });
  });
  return `<svg viewBox="0 0 300 300" aria-hidden="true">${out.join('')}</svg>`;
}
function renderMatrix() {
  const p = placeByNum(cmp.place);
  const svg = outlinesFor(p);
  const pl = PLANET_STATE[p.planet_after][1];
  const chip = (s, w, d, warn) => `<div class="mxchip"><img src="c/${p.num}_${s}_${w}.webp" alt="${SENSORS[s]} ${w}, ${d}">${svg}<span class="d">${d}</span>${warn ? `<span class="w">${warn}</span>` : ''}</div>`;
  const opts = DATA.places.map(x => `<option value="${x.num}"${String(x.num) === String(p.num) ? ' selected' : ''}>${x.num}. ${x.name}</option>`).join('');
  $('#matrix').innerHTML = `<div class="mxhead"><h2>${p.name}</h2><select id="mxSel" aria-label="Choose place">${opts}</select></div>
    <div class="mxgrid">
      <span></span><div class="colh">PlanetScope<small>55 m preview</small></div><div class="colh">Sentinel-2<small>10 m optical</small></div><div class="colh">Sentinel-1<small>10 m radar</small></div>
      <div class="rowh">Before</div>${chip('planet', 'before', '22 Oct')}${chip('s2', 'before', '23 Oct')}${chip('s1', 'before', '18 Oct')}
      <div class="rowh">After</div>${chip('planet', 'after', '1 Nov', p.planet_after === 'clear' ? '' : pl)}${chip('s2', 'after', '2 Nov', p.s2_after_cloud >= 90 ? 'All cloud' : `${p.s2_after_cloud}% cloud`)}${chip('s1', 'after', '30 Oct')}
    </div>`;
  $('#mxSel').onchange = e => { cmp.place = e.target.value; renderMatrix(); };
}
function enterCompare(opts = {}) {
  $('#imagebar').hidden = true;
  if (opts.view) cmp.view = opts.view;
  if (opts.place) cmp.place = opts.place;
  paintPins();
  mapA.fitBounds(SLIDE, { padding: 30, duration: 0 });
  paintCompare();
}
function leaveCompare() {
  cmp.synced = false;
  $('#swipe').hidden = true;
  $('#matrix').hidden = true;
  $('#mapB').hidden = true;
  $('#imagebar').hidden = false;
}

/* Modes */
function setMode(m, opts = {}) {
  if (state.mode === m && !opts.force) return;
  const refit = m === 'damage' && (state.mode === 'timeline' || state.mode === 'compare');
  if (state.mode === 'timeline') leaveTimeline();
  if (state.mode === 'compare') leaveCompare();
  state.mode = m;
  if (refit) mapA.fitBounds(FOCUS, { padding: 30, duration: 0 });
  if (!opts.keepPlace) state.place = null;
  if (m !== 'places') state.filter = null;
  document.querySelectorAll('.railbtn').forEach(b => b.setAttribute('aria-current', b.dataset.mode === m));
  $('#panel').scrollTop = 0;
  $('#mapkey').hidden = true;
  if (m === 'timeline') enterTimeline();
  else if (m === 'compare') enterCompare(opts);
  else {
    if (m === 'risk') { state.vis.t3 = state.vis.t2 = 1; state.vis.t1 = 1; }
    if (m === 'places') state.vis.places = 1;
    paintBase();
    syncA();
    if (m === 'damage') panelDamage();
    if (m === 'places') panelPlaces();
    if (m === 'risk') panelRisk();
    if (m === 'method') panelMethod();
  }
  if (!opts.keepPlace) history.replaceState(null, '', m === 'damage' ? location.pathname : `#${m}`);
}
addEventListener('resize', () => {
  if (state.mode === 'timeline') drawTrack();
  if (state.mode === 'compare' && cmp.view === 'swipe') setSplit(cmp.x);
});
addEventListener('keydown', e => {
  if (state.mode !== 'timeline' || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if (e.key === ' ' && e.target.tagName !== 'BUTTON') { e.preventDefault(); tl.playing ? pause() : play(); }
  if (e.key === 'ArrowRight') { pause(); setT(tl.t + 1); }
  if (e.key === 'ArrowLeft') { pause(); setT(tl.t - 1); }
});

const [hashMode, hashArg] = location.hash.slice(1).split('/');
if (hashMode === 'places' && hashArg && placeByNum(hashArg)) { setMode('places'); openPlace(hashArg); }
else setMode(MODES.some(([k]) => k === hashMode) ? hashMode : 'damage');
