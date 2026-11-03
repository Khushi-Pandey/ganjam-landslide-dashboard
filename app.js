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
const rainBy = Object.fromEntries(DATA.rain);
const EVENTS = [
  ['2026-10-23', 'Last clear Sentinel-2 view'],
  ['2026-10-27', 'Heavy rain begins'],
  ['2026-10-28', 'Landslide reported, 3 am. 150 mm of rain'],
  ['2026-10-30', `Radar pass: ${S.patches} damage patches, ${S.ha} ha`],
  ['2026-11-01', 'PlanetScope: still under cloud'],
].map(([d, txt], i, a) => ({ d, txt, t: dayOf(d) + (d === '2026-10-30' ? .01 : 0), end: Math.min(dayOf(d) + 2, a[i + 1] ? dayOf(a[i + 1][0]) : T1 + 1) }));

/* Basemaps and frames */
const BASES = [{ k: 's1', n: 'Sentinel-1' }, { k: 's2', n: 'Sentinel-2' }, { k: 'planet', n: 'PlanetScope' }, { k: 'sat', n: 'Satellite' }];
const FR = {};
Object.entries(DATA.frames).forEach(([s, days]) => {
  FR[s] = days.map(d => ({ d, t: dayOf(d) + (s === 's1' ? .01 : .22), id: `fr_${s}_${d}`, src: `f/${s}_${d}.webp`, box: s === 'planet' ? PBOX : BOX, s }));
});

/* Layers */
const LAYERS = [
  { k: 'damage', n: 'Damage detected', v: `${S.ha} ha`, sw: 'dmg', ids: ['d_glow', 'd_fill', 'd_line', 'd_dot'], timed: true },
  { k: 'near', n: 'Buildings within 100 m', v: S.buildings.near, sw: 'near', ids: ['b_near'], timed: true },
  { k: 'bld', n: 'Buildings', v: '', sw: 'bld', ids: ['bld'] },
  { k: 'river', n: 'Rivers and streams', v: '', sw: 'river', ids: ['river'] },
  { k: 'road', n: 'Roads', v: '', sw: 'road', ids: ['road_c', 'road'] },
  { k: 'label', n: 'Place names', v: '', sw: 'label', ids: ['ref'] },
];
const on = { damage: 1, near: 1, bld: 1, river: 1, road: 1, label: 1 };
const state = { base: 's1' };
const tl = { t: dayOf(new URLSearchParams(location.search).get('d') || '2026-10-12'), playing: false, speed: 1, last: 0, ready: {}, shown: {}, ev: undefined, day: null, dk: -1 };

/* Map */
const map = new maplibregl.Map({
  container: 'map', bounds: VIEW, fitBoundsOptions: { padding: 20 }, minZoom: 9, maxZoom: 17.5, dragRotate: false, pitchWithRotate: false, attributionControl: { compact: true },
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
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
map.addControl(new maplibregl.ScaleControl(), 'bottom-right');
map.on('mousemove', e => { $('#coord').textContent = `${e.lngLat.lat.toFixed(4)}°N, ${e.lngLat.lng.toFixed(4)}°E`; });
const labels = [['Tadama', 84.352, 19.9913], ['Baiballi', 84.3945, 19.9607], ['Kilapanga', 84.3015, 20.0209], ['Balingia', 84.3102, 20.0246]]
  .map(([n, lo, la]) => new maplibregl.Marker({ element: Object.assign(document.createElement('div'), { className: 'mlabel', textContent: n }) }).setLngLat([lo, la]));

const ready = new Promise(res => map.on('load', () => {
  const dots = { type: 'FeatureCollection', features: GEO.damage.features.map(f => ({ type: 'Feature', properties: f.properties, geometry: { type: 'Point', coordinates: [f.properties.lon, f.properties.lat] } })) };
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
  map.addLayer({ id: 'd_glow', type: 'line', source: 'damage', paint: { 'line-color': '#ff2b2b', 'line-width': 6, 'line-blur': 4, 'line-opacity': .5 } });
  map.addLayer({ id: 'd_fill', type: 'fill', source: 'damage', paint: { 'fill-color': '#e03131', 'fill-opacity': .7 } });
  map.addLayer({ id: 'd_line', type: 'line', source: 'damage', paint: { 'line-color': '#ffffff', 'line-width': 1.4 } });
  map.addLayer({ id: 'd_dot', type: 'circle', source: 'dots', maxzoom: 13.2, paint: { 'circle-color': '#e03131', 'circle-radius': ['+', 4, ['*', 2.4, ['sqrt', ['get', 'ha']]]], 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5, 'circle-opacity': ['interpolate', ['linear'], ['zoom'], 12.4, 1, 13.2, 0], 'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 12.4, 1, 13.2, 0] } });
  map.addLayer({ id: 'b_near', type: 'circle', source: 'near', paint: { 'circle-color': '#ffe066', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3, 15, 7], 'circle-stroke-color': '#111', 'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 1.6, 15, 3] } });
  map.addLayer({ id: 'ref', type: 'raster', source: 'ref', paint: { 'raster-fade-duration': 0 } });
  const pop = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });
  map.on('mousemove', 'd_fill', e => {
    const p = e.features[0].properties;
    map.getCanvas().style.cursor = 'pointer';
    pop.setLngLat(e.lngLat).setHTML(`<b>${p.ha} ha</b> of ${p.lulc.toLowerCase()}<br>Radar signal ${p.dVV} dB`).addTo(map);
  });
  map.on('mouseleave', 'd_fill', () => { map.getCanvas().style.cursor = ''; pop.remove(); });
  res();
}));

const setVis = (id, v) => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v ? 'visible' : 'none'); };
function applyLayers() {
  LAYERS.forEach(L => L.ids.forEach(id => setVis(id, on[L.k] && (!L.timed || tl.t >= T30))));
  labels.forEach(m => (on.label ? m.addTo(map) : m.remove()));
}

/* Side panel */
function renderBases() {
  const cur = s => { if (s === 'sat') return ''; let f = FR[s][0]; FR[s].forEach(x => { if (x.t <= tl.t) f = x; }); return fmt(f.d); };
  $('#bases').innerHTML = BASES.map(b => `<button class="base" type="button" role="radio" data-base="${b.k}" aria-checked="${state.base === b.k}">${b.n}<small id="bd_${b.k}">${cur(b.k) || 'Esri'}</small></button>`).join('');
  $('#baselegend').innerHTML = state.base === 's1'
    ? '<div>Radar signal compared with before the storm</div><div class="ramp"></div><div class="ends"><span>No change</span><span>Strong drop</span></div>' : '';
}
$('#bases').onclick = e => { const b = e.target.closest('[data-base]'); if (b) setBase(b.dataset.base); };
$('#layers').innerHTML = LAYERS.map(L => `<button class="layer" type="button" role="switch" data-layer="${L.k}" aria-checked="true"><i class="sw ${L.sw}"></i><span class="name">${L.n}</span><span class="val">${L.v}</span><span class="switch"></span></button>`).join('');
$('#layers').onclick = e => {
  const b = e.target.closest('[data-layer]');
  if (!b) return;
  on[b.dataset.layer] = on[b.dataset.layer] ? 0 : 1;
  b.setAttribute('aria-checked', !!on[b.dataset.layer]);
  ready.then(applyLayers);
};

/* Frames */
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
  if (!fs || !map.getLayer(fs[0].id)) return;
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
  const el = document.getElementById('bd_' + state.base);
  if (el) el.textContent = fmt((a > .5 && next ? next : cur).d);
}
async function setBase(k) {
  state.base = k;
  renderBases();
  hideFrames();
  await ensureFrames(k);
  if (state.base === k) paintT(true);
}

/* Timeline track */
const PLAY = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M3.5 1.5v13l11-6.5z"/></svg>';
const PAUSE = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="3" y="2" width="3.6" height="12" rx="1"/><rect x="9.4" y="2" width="3.6" height="12" rx="1"/></svg>';
let W = 600, H = 140, TL = 84;
const TR = 8;
const tx = t => TL + (t - T0) / (T1 - T0) * (W - TL - TR);
function drawTrack() {
  const el = $('#track');
  W = Math.max(el.clientWidth, 280); H = Math.max(el.clientHeight, 110);
  TL = W < 480 ? 54 : 84;
  const rb = H - 76, rt = 16, maxR = Math.max(...DATA.rain.map(r => r[1]));
  const bw = Math.max((W - TL - TR) / (T1 - T0) - 2, 1.5);
  const bars = DATA.rain.map(([d, v]) => {
    const h = v >= 1 ? Math.max(v / maxR * (rb - rt), 2) : 0;
    return h ? `<rect x="${tx(dayOf(d)).toFixed(1)}" y="${(rb - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="${dayOf(d) >= dayOf('2026-10-27') && dayOf(d) <= dayOf('2026-10-29') ? '#1c7ed6' : '#74b5e8'}" data-tip="${fmt(d)}: ${v} mm rain"/>` : '';
  }).join('');
  const ticks = [];
  for (let t = T0 + 7; t < T1; t += W < 480 ? 14 : 7) ticks.push(`<text x="${tx(t)}" y="${H - 3}" text-anchor="middle">${fmt(isoOf(t))}</text>`);
  const lanes = [
    ['planet', W < 480 ? 'Planet' : 'PlanetScope', H - 60, DATA.passes.planet.filter(p => p.used).map(p => ({ d: p.d, ok: p.cloud < .4, tip: p.cloud < .4 ? 'clear' : 'cloud' }))],
    ['s2', W < 480 ? 'S-2' : 'Sentinel-2', H - 42, DATA.passes.s2.map(p => ({ d: p.d, ok: p.cloud < 50, tip: `${p.cloud}% cloud` }))],
    ['s1', W < 480 ? 'S-1' : 'Sentinel-1', H - 24, DATA.frames.s1.map(d => ({ d, ok: true, hot: d === '2026-10-30', tip: 'radar, sees through cloud' }))],
  ].map(([s, label, y, list]) => `<text class="lane" x="${TL - 10}" y="${y + 4}" text-anchor="end">${label}</text><line x1="${TL}" x2="${W - TR}" y1="${y}" y2="${y}" stroke="#e3e7e1"/>`
    + list.map(p => `<circle cx="${tx(dayOf(p.d) + .4).toFixed(1)}" cy="${y}" r="${p.hot ? 5.5 : 4}" fill="${p.hot ? '#e03131' : p.ok ? '#0b3c2c' : '#fff'}" stroke="${p.hot ? '#e03131' : '#0b3c2c'}" stroke-width="1.5" data-tip="${label}, ${fmt(p.d)}: ${p.tip}"/>`).join('')).join('');
  $('#track').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="slider" tabindex="0" aria-label="Date" id="trackSvg">
    <rect x="${tx(T28)}" y="0" width="${tx(T30 + 1) - tx(T28)}" height="${H - 14}" fill="#e03131" opacity=".09"/>
    <line x1="${tx(T28)}" x2="${tx(T28)}" y1="0" y2="${H - 14}" stroke="#e03131" stroke-dasharray="3 3"/>
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
    paintPasses();
  }
  paintFrames(t);
  // Damage comes in with the radar pass of 30 Oct
  const k = smooth((t - T30) / .3);
  if (Math.abs(k - tl.dk) > .01 || force) {
    const was = tl.dk;
    tl.dk = k;
    if (map.getLayer('d_fill')) {
      applyLayers();
      map.setPaintProperty('d_fill', 'fill-opacity', .7 * k);
      map.setPaintProperty('d_line', 'line-opacity', k);
      map.setPaintProperty('b_near', 'circle-opacity', k);
      map.setPaintProperty('b_near', 'circle-stroke-opacity', k);
    }
    if (was <= 0 && k > 0) { pulse(); kpis(true); } else if (k <= 0 && was > 0) kpis(false);
  }
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
  if (REDUCED || !map.getLayer('d_glow')) return;
  const t0 = performance.now();
  const step = now => {
    const p = Math.min((now - t0) / 1800, 1);
    map.setPaintProperty('d_glow', 'line-width', 6 + 22 * (1 - p) * (1 - p));
    map.setPaintProperty('d_glow', 'line-opacity', .5 + .45 * (1 - p));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
const setT = t => { tl.t = Math.max(T0, Math.min(T1, t)); paintT(); };
const warp = t => (t > dayOf('2026-10-26') + .5 && t < dayOf('2026-11-01') ? .35 : 1);
function play() {
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

/* Numbers and charts */
function kpis(live) {
  const items = [[`${S.ha}`, 'ha damage detected', true], [S.patches, 'damage patches'], [S.buildings.near, 'buildings within 100 m'], [`${S.rivers.in}`, 'km of river in damage']];
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
function drawLulc() {
  const el = $('#lulc');
  const w = Math.max(el.clientWidth, 160), rows = Object.entries(S.event.lulc).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const rh = 24, lw = 104, vw = 46, max = rows[0][1];
  el.innerHTML = `<svg viewBox="0 0 ${w} ${rows.length * rh}" height="${rows.length * rh}">${rows.map(([n, v], i) => {
    const bw = Math.max(v / max * (w - lw - vw), 3);
    return `<text x="0" y="${i * rh + 15}">${n}</text><rect x="${lw}" y="${i * rh + 5}" width="${bw.toFixed(1)}" height="12" rx="4" fill="#e03131" data-tip="${n}: ${v} ha"/><text class="v" x="${lw + bw + 6}" y="${i * rh + 15}">${v} ha</text>`;
  }).join('')}</svg>`;
}
function paintPasses() {
  const el = $('#passes');
  // Mean radar signal (VV, dB) at the damaged spots and in a ring of ground around them, every pass
  const w = Math.max(el.clientWidth, 160), h = Math.max(el.clientHeight, 70), P = S.series;
  const L = 30, R = 92, top = 6, bot = h - 16, lo = -14, hi = -5;
  const x = i => L + i / (P.length - 1) * (w - L - R), y = v => top + (hi - v) / (hi - lo) * (bot - top);
  let cur = -1;
  P.forEach((p, i) => { if (dayOf(p.d) + .01 <= tl.t) cur = i; });
  const line = k => P.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p[k]).toFixed(1)}`).join('');
  const grid = [-6, -10, -14].map(v => `<line x1="${L}" x2="${w - R}" y1="${y(v)}" y2="${y(v)}" stroke="#eef1ee"/><text x="${L - 5}" y="${y(v) + 3.5}" text-anchor="end">${v}</text>`).join('');
  const lastI = P.length - 1;
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}">${grid}
    <path d="${line('ring')}" fill="none" stroke="#8d9a93" stroke-width="2"/>
    <path d="${line('site')}" fill="none" stroke="#e03131" stroke-width="2"/>
    ${P.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.site)}" r="${i === cur ? 5.5 : 3.5}" fill="#e03131" stroke="#fff" stroke-width="2"/><circle cx="${x(i)}" cy="${y(p.ring)}" r="${i === cur ? 4.5 : 3}" fill="#8d9a93" stroke="#fff" stroke-width="1.5"/>
      ${i === 0 || i === lastI || (i === cur && cur > 1 && cur < lastI - 1) ? `<text x="${x(i)}" y="${h - 3}" text-anchor="middle" ${i === cur ? 'style="fill:#12211b;font-weight:700"' : ''}>${fmt(p.d)}</text>` : ''}
      <rect class="hit" x="${x(i) - 14}" y="0" width="28" height="${h}" data-tip="${fmt(p.d)}: damaged spots ${p.site} dB, ground around ${p.ring} dB"/>`).join('')}
    <text class="v" x="${x(lastI) + 8}" y="${y(P[lastI].site) + 4}" style="fill:#c92a2a">Damaged spots</text>
    <text x="${x(lastI) + 8}" y="${y(P[lastI].ring) + 4}">Ground around</text></svg>`;
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
renderBases();
kpis(tl.t >= T30);
drawLulc();
new ResizeObserver(() => { drawTrack(); drawLulc(); paintPasses(); }).observe($('.dock'));
ready.then(async () => {
  applyLayers();
  paintT(true);
  await ensureFrames(state.base);
  paintT(true);
  if (!REDUCED) setTimeout(play, 600);
});
