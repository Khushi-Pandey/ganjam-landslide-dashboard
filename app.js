const { GEO, DATA, CONTOUR } = window;
const BOX = [84.18, 19.90, 84.52, 20.22];
const PBOX = [84.20, 19.90, 84.50, 20.12];
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const corners = b => [[b[0], b[3]], [b[2], b[3]], [b[2], b[1]], [b[0], b[1]]];
const $ = s => document.querySelector(s);
const el = (tag, attrs = {}, html) => { const e = document.createElement(tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; };
const fmtDate = d => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
document.querySelectorAll('.contour').forEach(s => { s.innerHTML = CONTOUR; });

const VIEWS = {
  Tadama: { center: [84.352, 19.9915], zoom: 14.4 },
  Hamlet: { center: [84.3362, 20.0028], zoom: 15.6 },
  Baiballi: { center: [84.402, 19.959], zoom: 13.6 },
  Slide: { center: [84.352, 19.988], zoom: 12.9 },
  Area: { center: [84.35, 20.06], zoom: 10.6 },
};
const PLACES = [
  ['Tadama', 84.35204, 19.99131], ['Baiballi', 84.39448, 19.96069], ['Kilapanga', 84.30152, 20.02092], ['Balingia', 84.31016, 20.02461],
  ['Manikeswar', 84.27217, 20.01301], ['Katingia', 84.29576, 20.064], ['G. Udayagiri', 84.37, 20.122], ['Raikia', 84.2408, 20.059], ['Kalinga', 84.4116, 20.1628],
];
const KIND = { slope: ['Hill slope', '#FF4B2B'], small_stream: ['Small stream', '#FF9A1F'], stream: ['Stream channel', '#FFD23F'], valley: ['Valley floor', '#57C4F2'] };
const LEVEL = { 3: ['High', '#FF4B2B'], 2: ['Medium', '#FFB02E'], 1: ['Low', '#E9DE8F'] };
const IMAGES = {
  s2_oct: ['img/s2_oct.jpg', BOX, 'Sentinel-2, clearest of October'], s2_dry: ['img/s2_dry.jpg', BOX, 'Sentinel-2, dry season'],
  's2_2026-10-30': ['img/s2_2026-10-30.jpg', BOX, 'Sentinel-2, 30 Oct'], 's2_2026-11-02': ['img/s2_2026-11-02.jpg', BOX, 'Sentinel-2, 2 Nov'],
};
DATA.series_days.forEach(d => { IMAGES['s1_' + d] = [`img/s1_${d}.jpg`, BOX, `Radar, ${fmtDate(d)}`]; });
['2026-10-06', '2026-10-12', '2026-10-21', '2026-10-22', '2026-10-26', '2026-10-27', '2026-10-30', '2026-11-01'].forEach(d => { IMAGES['planet_' + d] = [`img/planet_${d}.png`, PBOX, `PlanetScope, ${fmtDate(d)}`]; });

function makeMap(container, view, extra = {}) {
  return new maplibregl.Map({
    container, ...view, minZoom: 9, maxZoom: 18.4, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, ...extra,
    style: { version: 8, sources: { esri: { type: 'raster', tiles: [ESRI], tileSize: 256, maxzoom: 18, attribution: 'Imagery: Esri, Maxar, Earthstar Geographics' } },
      layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0a2b20' } }, { id: 'esri', type: 'raster', source: 'esri' }] },
  });
}

function addImage(map, id, opacity = 1, before) {
  const [url, bounds] = IMAGES[id] || [`img/${id}.png`, BOX];
  if (!map.getSource('i_' + id)) map.addSource('i_' + id, { type: 'image', url, coordinates: corners(bounds) });
  if (!map.getLayer('i_' + id)) map.addLayer({ id: 'i_' + id, type: 'raster', source: 'i_' + id, paint: { 'raster-opacity': opacity, 'raster-fade-duration': 0, 'raster-resampling': 'linear' } }, before);
}
function vis(map, ids, on) { [].concat(ids).forEach(i => map.getLayer(i) && map.setLayoutProperty(i, 'visibility', on ? 'visible' : 'none')); }

const VECTOR = {
  contours: m => m.addLayer({ id: 'contours', type: 'line', source: 'contours', paint: { 'line-color': '#fff', 'line-opacity': ['case', ['get', 'major'], .45, .22], 'line-width': ['case', ['get', 'major'], .9, .5] } }),
  drainage: m => m.addLayer({ id: 'drainage', type: 'line', source: 'drainage', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#8ED8FF', 'line-opacity': .85, 'line-width': ['match', ['get', 'class'], 3, 2.6, 2, 1.6, .8] } }),
  roads: m => m.addLayer({ id: 'roads', type: 'line', source: 'roads', layout: { 'line-cap': 'round' }, paint: { 'line-color': ['match', ['get', 'level'], 3, LEVEL[3][1], 2, LEVEL[2][1], LEVEL[1][1]], 'line-width': ['match', ['get', 'level'], 3, 3, 2, 2.2, 1.3] } }),
  buildings_risk: m => { m.addLayer({ id: 'buildings_risk', type: 'fill', source: 'buildings_risk', paint: { 'fill-color': ['match', ['get', 'level'], 3, LEVEL[3][1], LEVEL[2][1]], 'fill-opacity': .95 } }); m.addLayer({ id: 'buildings_dot', type: 'circle', source: 'buildings_risk', maxzoom: 14, paint: { 'circle-radius': 2, 'circle-color': ['match', ['get', 'level'], 3, LEVEL[3][1], LEVEL[2][1]], 'circle-opacity': .9 } }); },
  border: m => m.addLayer({ id: 'border', type: 'line', source: 'border', paint: { 'line-color': '#FFD23F', 'line-width': 1.4, 'line-dasharray': [3, 2] } }),
  runout: m => m.addLayer({ id: 'runout', type: 'line', source: 'runout', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FFB27A', 'line-width': 1.8, 'line-dasharray': [1.5, 1.5] } }),
  route: m => { m.addLayer({ id: 'route_c', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#0a2b20', 'line-width': 4.5, 'line-opacity': .6 } }); m.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#fff', 'line-width': 2, 'line-dasharray': [2.5, 1.6] } }); },
  weak: m => m.addLayer({ id: 'weak', type: 'line', source: 'weak', paint: { 'line-color': '#FFD23F', 'line-width': 1.5, 'line-dasharray': [1, 1] } }),
  changes: m => { const color = ['match', ['get', 'kind'], 'slope', KIND.slope[1], 'small_stream', KIND.small_stream[1], 'stream', KIND.stream[1], KIND.valley[1]];
    m.addLayer({ id: 'changes', type: 'fill', source: 'changes', paint: { 'fill-color': color, 'fill-opacity': .86 } });
    m.addLayer({ id: 'changes_l', type: 'line', source: 'changes', paint: { 'line-color': '#10130f', 'line-width': .8, 'line-opacity': .75 } }); },
};
function addVectors(map, names, hidden = []) {
  names.forEach(n => { if (!map.getSource(n)) map.addSource(n, { type: 'geojson', data: GEO[n] }); VECTOR[n](map); });
  hidden.forEach(n => vis(map, [n, n + '_l', n + '_c', n === 'buildings_risk' ? 'buildings_dot' : n], false));
}
function addMarkers(map, list = PLACES, hamlet = true) {
  const out = [];
  list.forEach(([n, x, y]) => { const d = el('div', { class: 'mk' }, `<i></i>${n}`); out.push(new maplibregl.Marker({ element: d, anchor: 'left', offset: [-5, 0] }).setLngLat([x, y]).addTo(map)); });
  if (hamlet) { const d = el('div', { class: 'mk hamlet' }, '<i></i>Best-match hamlet'); out.push(new maplibregl.Marker({ element: d, anchor: 'left', offset: [-8, 0] }).setLngLat([84.3362, 20.0028]).addTo(map)); }
  return out;
}
function jumpButtons(host, map, names) { names.forEach(([label, key]) => { const b = el('button', { type: 'button' }, label); b.onclick = () => map.flyTo({ ...VIEWS[key], duration: 1400, essential: true }); host.append(b); }); }

/* Explorer */
const LAYERS = [
  ['Found by satellite', [
    { id: 'changes', label: 'Sudden radar drop, 30 Oct', on: true, keys: Object.values(KIND).map(([t, c]) => [t, c]) },
    { id: 'weak', label: 'Weak signal near hamlet', on: true, keys: [['Below test level', '#FFD23F', 1]] },
    { id: 'route', label: 'Flow route, hamlet to Baiballi', on: true, keys: [[`${DATA.stats.route_km} km along streams`, '#fff', 1]] },
    { id: 'runout', label: 'Modelled debris paths', on: false, keys: [['Downhill from each source', '#FFB27A', 1]] },
    { id: 's1_change', label: 'Radar change map', raster: 1, on: false, opacity: .85, keys: [['Signal lost', '#E84828'], ['Signal gained', '#56AAE1']] },
    { id: 'places', label: 'Places in reports and maps', on: true },
  ]],
  ['Homes and roads', [
    { id: 'buildings_risk', label: 'Buildings at risk', on: true, keys: [['High', LEVEL[3][1]], ['Medium', LEVEL[2][1]]] },
    { id: 'buildings', label: 'All buildings (mask)', raster: 1, on: false, opacity: 1, keys: [['51,418 footprints', '#FFF8E1']] },
    { id: 'roads', label: 'Roads at risk', on: false, keys: [['High', LEVEL[3][1], 1], ['Medium', LEVEL[2][1], 1], ['Low', LEVEL[1][1], 1]] },
  ]],
  ['Ground', [
    { id: 'drainage', label: 'Drainage from DEM', on: true, keys: [['Over 1 sq km catchment', '#8ED8FF', 1]] },
    { id: 'border', label: 'District border', on: true, keys: [['Approximate', '#FFD23F', 1]] },
    { id: 'susceptibility', label: 'Landslide susceptibility', raster: 1, on: false, opacity: .7, keys: [['Low', '#78BE8C'], ['Medium', '#F0C450'], ['High', '#D63C28']] },
    { id: 'slope', label: 'Slope', raster: 1, on: false, opacity: .75, keys: [['15-25°', '#F5DE82'], ['25-35°', '#EC963C'], ['Over 35°', '#B02A28']] },
    { id: 'lowland', label: 'Low ground beside streams', raster: 1, on: false, opacity: .8, keys: [['Under 6 m above stream', '#46A5E6']] },
    { id: 'contours', label: 'Contours, 50 m', on: false },
    { id: 'hillshade', label: 'Hillshade', raster: 1, jpg: 1, on: false, opacity: .55 },
  ]],
];
const BASES = [['esri', 'Satellite map'], ['s2_oct', 'Sentinel-2 Oct'], ['planet_2026-11-01', 'PlanetScope 1 Nov'], ['s1_2026-10-30', 'Radar 30 Oct']];
const mapX = makeMap('mapX', VIEWS.Slide);
mapX.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
mapX.addControl(new maplibregl.ScaleControl({ maxWidth: 110 }), 'bottom-right');
jumpButtons($('#jump'), mapX, [['Slide area', 'Slide'], ['Hamlet', 'Hamlet'], ['Tadama', 'Tadama'], ['Baiballi', 'Baiballi'], ['Whole study area', 'Area']]);
let xMarkers = [];
IMAGES.hillshade = ['img/hillshade.jpg', BOX, 'Hillshade'];
['s1_change', 'buildings', 'susceptibility', 'slope', 'lowland'].forEach(k => { IMAGES[k] = [`img/${k}.png`, BOX, k]; });

mapX.on('load', () => {
  const lowest = 'contours';
  addVectors(mapX, ['contours', 'drainage', 'roads', 'buildings_risk', 'border', 'runout', 'route', 'weak', 'changes'], ['contours', 'roads', 'runout']);
  xMarkers = addMarkers(mapX);
  const lower = () => mapX.getLayer(lowest) ? lowest : undefined;

  const pick = $('#basePick');
  let current = 'esri';
  BASES.forEach(([id, label]) => {
    const b = el('button', { type: 'button', role: 'radio', 'aria-checked': id === 'esri' }, label);
    b.onclick = () => {
      if (current !== 'esri') vis(mapX, 'i_' + current, false);
      current = id;
      if (id !== 'esri') { addImage(mapX, id, 1, lower()); vis(mapX, 'i_' + id, true); }
      [...pick.children].forEach(c => c.setAttribute('aria-checked', c === b));
    };
    pick.append(b);
  });

  const list = $('#layerList');
  LAYERS.forEach(([title, items]) => {
    const g = el('div', { class: 'lgroup' }, `<h3>${title}</h3>`);
    items.forEach(it => {
      const row = el('div', { class: 'lrow' });
      const cb = el('input', { type: 'checkbox' }); cb.checked = it.on;
      const lab = el('label'); lab.append(cb, document.createTextNode(it.label)); row.append(lab);
      if (it.keys) row.append(el('div', { class: 'keys' }, it.keys.map(([t, c, ln]) => `<span><i class="${ln ? 'ln' : ''}" style="background:${c}"></i>${t}</span>`).join('')));
      let range;
      if (it.raster) { range = el('input', { type: 'range', min: 0, max: 100, value: it.opacity * 100, 'aria-label': it.label + ' opacity' }); range.hidden = !it.on; row.append(range);
        range.oninput = () => mapX.setPaintProperty('i_' + it.id, 'raster-opacity', range.value / 100); }
      cb.onchange = () => {
        if (it.id === 'places') { xMarkers.forEach(m => { m.getElement().style.display = cb.checked ? '' : 'none'; }); return; }
        if (it.raster) { addImage(mapX, it.id, it.opacity, 'drainage'); vis(mapX, 'i_' + it.id, cb.checked); range.hidden = !cb.checked; return; }
        vis(mapX, [it.id, it.id + '_l', it.id + '_c', it.id === 'buildings_risk' ? 'buildings_dot' : it.id], cb.checked);
      };
      g.append(row);
    });
    list.append(g);
  });

  mapX.on('click', 'changes', e => {
    const p = e.features[0].properties;
    new maplibregl.Popup({ maxWidth: '260px' }).setLngLat(e.lngLat).setHTML(`<b>${KIND[p.kind][0]}</b>${p.lat}°N, ${p.lon}°E<br>Radar drop ${p.dVV} dB (VV), ${p.dVH} dB (VH)<br>${p.ha} ha, ${p.z_top} to ${p.z_bot} m<br>Stream catchment ${p.catch} sq km`).addTo(mapX);
  });
  mapX.on('click', 'buildings_risk', e => { const p = e.features[0].properties; new maplibregl.Popup({ maxWidth: '220px' }).setLngLat(e.lngLat).setHTML(`<b>Building</b>${LEVEL[p.level][0]} risk`).addTo(mapX); });
  ['changes', 'buildings_risk'].forEach(l => { mapX.on('mouseenter', l, () => { mapX.getCanvas().style.cursor = 'pointer'; }); mapX.on('mouseleave', l, () => { mapX.getCanvas().style.cursor = ''; }); });
  mapX.on('mousemove', e => { $('#coord').textContent = `${e.lngLat.lat.toFixed(4)}°N, ${e.lngLat.lng.toFixed(4)}°E`; });
});

/* Lazy maps */
function whenSeen(sel, fn) { const t = $(sel); const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); fn(); } }, { rootMargin: '400px' }); io.observe(t); }

/* Timeline */
const T0 = new Date('2026-08-28T00:00:00'); const T1 = new Date('2026-11-05T00:00:00');
const tx = d => 92 + (new Date(d + 'T12:00:00') - T0) / (T1 - T0) * 1098;
const FRAMES = [];
DATA.series_days.forEach(d => FRAMES.push({ row: 0, d, id: 's1_' + d, label: `Radar, ${fmtDate(d)}. Sees through cloud.`, solid: true }));
Object.keys(IMAGES).filter(k => k.startsWith('planet_')).forEach(k => { const d = k.slice(7); const c = DATA.stats.planet_index[d]; const cloud = c.best_clear === 0;
  FRAMES.push({ row: 1, d, id: k, label: `PlanetScope, ${fmtDate(d)}, ${cloud ? 'all cloud' : c.best_clear + '% clear scene'}. Quick view, about 70 m.`, solid: !cloud }); });
FRAMES.push({ row: 2, d: '2026-10-13', id: 's2_oct', label: 'Sentinel-2, clearest of October.', solid: true });
FRAMES.push({ row: 2, d: '2026-10-30', id: 's2_2026-10-30', label: 'Sentinel-2, 30 Oct. All cloud.', solid: false });
FRAMES.push({ row: 2, d: '2026-11-02', id: 's2_2026-11-02', label: 'Sentinel-2, 2 Nov. All cloud.', solid: false });
FRAMES.sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : a.row - b.row);

(function strip() {
  const s = $('#strip'); let h = '';
  const days = Object.entries(DATA.rain_daily); const max = Math.max(...days.map(d => d[1]));
  h += `<text class="track" x="0" y="50">Rain</text><text class="axis" x="0" y="66">mm a day</text>`;
  days.forEach(([d, v]) => { if (v > 0.5) { const b = v / max * 66; const big = v > 40; h += `<rect x="${tx(d) - 6}" y="${76 - b}" width="12" height="${b}" rx="1.5" fill="${d === '2026-10-28' ? '#FF4B2B' : '#57C4F2'}"><title>${fmtDate(d)}: ${Math.round(v)} mm</title></rect>`; if (big) h += `<text class="axis" text-anchor="middle" x="${tx(d)}" y="${70 - b}" fill="#fff">${Math.round(v)}</text>`; } });
  h += `<line x1="${tx('2026-10-28')}" x2="${tx('2026-10-28')}" y1="4" y2="178" stroke="#FF4B2B" stroke-width="1.5" stroke-dasharray="4 3"/><text class="track" text-anchor="end" x="${tx('2026-10-28') - 8}" y="14" fill="#fff">Slide, 28 Oct</text>`;
  ['Radar', 'PlanetScope', 'Sentinel-2'].forEach((n, i) => { const y = 104 + i * 30; h += `<text class="track" x="0" y="${y + 4}">${n}</text><line x1="92" x2="1190" y1="${y}" y2="${y}" stroke="#2a6b55"/>`; });
  ['2026-09-01', '2026-09-15', '2026-10-01', '2026-10-15', '2026-11-01'].forEach(d => { h += `<text class="axis" text-anchor="middle" x="${tx(d)}" y="200">${fmtDate(d)}</text><line x1="${tx(d)}" x2="${tx(d)}" y1="182" y2="188" stroke="#7fa897"/>`; });
  s.innerHTML = h;
  FRAMES.forEach((f, i) => {
    const y = 104 + f.row * 30; const c = ['#FF9A1F', '#EAF4EE', '#8ED8FF'][f.row];
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'frame'); g.setAttribute('tabindex', 0); g.setAttribute('role', 'button'); g.setAttribute('aria-label', f.label);
    g.innerHTML = `<circle class="ring" cx="${tx(f.d)}" cy="${y}" r="11"/><circle cx="${tx(f.d)}" cy="${y}" r="14" fill="transparent"/><circle class="dot" cx="${tx(f.d)}" cy="${y}" r="7" fill="${f.solid ? c : '#0B3C2C'}" stroke="${c}" stroke-width="2"/>`;
    g.onclick = () => { stop(); show(i); }; g.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); stop(); show(i); } };
    f.el = g; s.append(g);
  });
})();
let mapT, frameNow = FRAMES.findIndex(f => f.id === 'planet_2026-11-01'), timer = null;
function show(i) {
  frameNow = i; const f = FRAMES[i];
  FRAMES.forEach(x => x.el.classList.toggle('on', x === f));
  $('#frameLabel').textContent = f.label;
  if (!mapT || !mapT.loaded()) return;
  FRAMES.forEach(x => { if (x !== f) vis(mapT, 'i_' + x.id, false); });
  addImage(mapT, f.id, 1, 'drainage'); vis(mapT, 'i_' + f.id, true);
}
function stop() { clearInterval(timer); timer = null; $('#playText').textContent = 'Play'; $('#playIcon').setAttribute('d', 'M2 1l9 5-9 5z'); }
$('#play').onclick = () => { if (timer) return stop(); $('#playText').textContent = 'Pause'; $('#playIcon').setAttribute('d', 'M2 1h3v10H2zM7 1h3v10H7z'); timer = setInterval(() => show((frameNow + 1) % FRAMES.length), 1500); };
show(frameNow);
whenSeen('#mapT', () => {
  mapT = makeMap('mapT', { center: [84.36, 19.985], zoom: 12.2 }, { scrollZoom: false });
  mapT.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  mapT.on('load', () => { addVectors(mapT, ['drainage', 'border']); mapT.setPaintProperty('drainage', 'line-opacity', .35); addMarkers(mapT, PLACES.slice(0, 4)); show(frameNow); });
});

/* Compare */
const PAIRS = [
  ['PlanetScope 22 Oct and 1 Nov', 'planet_2026-10-22', 'planet_2026-11-01'],
  ['Radar 18 Oct and 30 Oct', 's1_2026-10-18', 's1_2026-10-30'],
  ['Sentinel-2 Oct and 2 Nov', 's2_oct', 's2_2026-11-02'],
  ['Dry season and PlanetScope 1 Nov', 's2_dry', 'planet_2026-11-01'],
  ['Satellite map and radar change', null, 's1_change'],
];
whenSeen('#swipe', () => {
  const view = { center: [84.372, 19.975], zoom: 12.6 };
  const a = makeMap('cmpA', view, { scrollZoom: false, attributionControl: false }); const b = makeMap('cmpB', view, { scrollZoom: false });
  b.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  let syncing = false;
  const sync = (from, to) => from.on('move', () => { if (syncing) return; syncing = true; to.jumpTo({ center: from.getCenter(), zoom: from.getZoom() }); syncing = false; });
  sync(a, b); sync(b, a);
  let ready = 0;
  const setPair = i => {
    const [, ia, ib] = PAIRS[i];
    [a, b].forEach((m, k) => { const id = k ? ib : ia; m.getStyle().layers.filter(l => l.id.startsWith('i_')).forEach(l => vis(m, l.id, false)); if (id) { addImage(m, id, 1); vis(m, 'i_' + id, true); } });
    $('#tagA').textContent = ia ? IMAGES[ia][2] : 'Satellite map'; $('#tagB').textContent = ib === 's1_change' ? 'Radar change, red is signal lost' : IMAGES[ib][2];
    [...$('#cmpTabs').children].forEach((c, k) => c.setAttribute('aria-selected', k === i));
  };
  PAIRS.forEach((p, i) => { const t = el('button', { type: 'button', role: 'tab', 'aria-selected': i === 0 }, p[0]); t.onclick = () => setPair(i); $('#cmpTabs').append(t); });
  [a, b].forEach(m => m.on('load', () => { if (++ready === 2) setPair(0); }));
  jumpButtons($('#cmpJump'), b, [['Tadama to Baiballi', 'Slide'], ['Tadama', 'Tadama'], ['Hamlet', 'Hamlet'], ['Baiballi', 'Baiballi']]);
  const swipe = $('#swipe'), handle = $('#handle'), clip = $('#cmpB');
  const setX = pct => { pct = Math.max(2, Math.min(98, pct)); clip.style.clipPath = `inset(0 0 0 ${pct}%)`; handle.style.left = pct + '%'; handle.setAttribute('aria-valuenow', Math.round(pct)); };
  let drag = false;
  handle.addEventListener('pointerdown', e => { drag = true; handle.setPointerCapture(e.pointerId); });
  handle.addEventListener('pointermove', e => { if (drag) { const r = swipe.getBoundingClientRect(); setX((e.clientX - r.left) / r.width * 100); } });
  handle.addEventListener('pointerup', () => { drag = false; });
  handle.addEventListener('keydown', e => { const v = +handle.getAttribute('aria-valuenow'); if (e.key === 'ArrowLeft') setX(v - 3); if (e.key === 'ArrowRight') setX(v + 3); });
  /* Pan on the left of the divider moves the top map through its own canvas area */
  clip.style.pointerEvents = 'auto';
  swipe.addEventListener('pointerdown', e => { if (e.target === handle || handle.contains(e.target) || e.target.closest('button')) return; const r = swipe.getBoundingClientRect(); const left = (e.clientX - r.left) / r.width * 100 < +handle.getAttribute('aria-valuenow'); clip.style.pointerEvents = left ? 'none' : 'auto'; }, true);
});

/* Locations */
const NOTE = {
  1: ['strong', 'Strong lead', 'The radar line runs through Tadama, where rescuers found people stranded. It shows pale and scoured on the 1 Nov image. Debris, flood or both.', [['Radar', 1], ['1 Nov image', 1], ['Named in reports', 1]], 14.2],
  2: ['strong', 'Strong lead', 'An isolated patch inside closed forest. The catchment is under 1 sq km, so a river flood is unlikely. Debris or slope failure is more likely.', [['Radar', 1], ['Small catchment', 1]], 15],
  3: ['', 'Possible', 'Five spots on high ground next to cleared fields. Harvest could explain some of them.', [['Radar', 1], ['High susceptibility', 1], ['Beside fields', .5]], 14.8],
  4: ['', 'Possible', 'Three spots in a line down the slope, below a cleared area.', [['Radar', 1], ['High susceptibility', 1], ['Beside fields', .5]], 15],
  5: ['', 'Possible', 'A small stream 2.8 km south of Balingia, which was reported as landslide-hit.', [['Radar', 1], ['Near a report', 1]], 14.6],
  6: ['', 'Weak', 'Small patches. A clear image is needed.', [['Radar', .5]], 14.4],
  7: ['flood', 'Flood', 'Flat valley at Baiballi, the village panchayat. Red-brown silt shows on the 1 Nov image. Flood water and sediment.', [['Radar', 1], ['1 Nov image', 1], ['Named in reports', 1]], 13.6],
  8: ['', 'Possible', 'Small streams joining the Baiballi valley. Debris or flood.', [['Radar', 1], ['Small catchment', 1]], 14.2],
};
const LOCS = [
  { num: 'H', name: 'Best-match hamlet', cls: 'best', rating: 'Best match for Ganjam', lat: 20.0028, lon: 84.3362, meta: ['About 430 m', '7 structures', 'Terraced fields'], text: 'A small settlement in a high basin under the hill, on the Ganjam side and 4.1 km from Kilapanga. Its stream runs down past Tadama. Radar here is weak, so this rests on buildings, terrain and the reports.', ev: [['Buildings', 1], ['Terrain', 1], ['Fits reports', 1], ['Radar', .5]], zoom: 15.6 },
  ...DATA.locations.map(t => { const n = NOTE[t.num]; return { num: t.num, name: t.name, cls: n[0], rating: n[1], lat: t.lat, lon: t.lon, meta: [`${t.z_top} to ${t.z_bot} m`, `${t.ha} ha`, `Drop ${t.drop_vv} dB`, `${t.b500} buildings within 500 m`], text: n[2], ev: n[3], zoom: n[4], vv: t.vv, ground: t.ground_vv }; }),
  { num: 9, name: 'North stream', cls: '', rating: 'Possible', lat: 20.0058, lon: 84.3469, meta: ['418 to 388 m', '0.6 ha', 'Drop about 2.5 dB'], text: 'A pale channel on the 1 Nov image with a weak radar drop. It joins the Tadama stream from the north.', ev: [['Radar', .5], ['1 Nov image', 1]], zoom: 14.6 },
];
LOCS.splice(10, 0); LOCS.sort((a, b) => order(a) - order(b));
function order(l) { return ['H', 1, 2, 9, 3, 4, 5, 8, 7, 6].indexOf(l.num); }
function spark(l) {
  if (!l.vv) return '';
  const base = a => { const m = a.slice(0, -1).reduce((s, v) => s + v, 0) / (a.length - 1); return a.map(v => v - m); };
  const v = base(l.vv), g = base(l.ground); const W = 420, H = 104; const x = i => 34 + i * (W - 80) / 5; const y = d => 12 + (1.5 - d) / 6 * (H - 34);
  const path = a => a.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d).toFixed(1)}`).join('');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="Radar signal over six passes dropping on 30 October">
    <line x1="34" x2="${W - 46}" y1="${y(0)}" y2="${y(0)}" stroke="#b9cfc3"/><text x="0" y="${y(0) + 4}">0 dB</text><text x="0" y="${y(-4) + 4}">-4</text><line x1="34" x2="${W - 46}" y1="${y(-4)}" y2="${y(-4)}" stroke="#e2ece6"/>
    <path d="${path(g)}" fill="none" stroke="#8aa397" stroke-width="2"/><path d="${path(v)}" fill="none" stroke="#D93A1C" stroke-width="2.5"/>
    ${v.map((d, i) => `<circle cx="${x(i)}" cy="${y(d)}" r="3" fill="#D93A1C"/>`).join('')}
    <text x="${x(5) + 6}" y="${y(v[5]) + 4}" fill="#D93A1C" style="fill:#B52C12;font-weight:600">here</text><text x="${x(5) + 6}" y="${y(g[5]) + 4}">nearby</text>
    <text x="${x(0)}" y="${H - 2}" text-anchor="middle">31 Aug</text><text x="${x(5)}" y="${H - 2}" text-anchor="middle">30 Oct</text></svg>`;
}
const listEl = $('#locList');
LOCS.forEach(l => {
  const a = el('article', { class: 'loc', 'data-n': l.num });
  a.innerHTML = `<h3><span class="nb">${l.num}</span><button type="button">${l.name}</button></h3><span class="rate ${l.cls}">${l.rating}</span>
    <div class="xy">${l.lat.toFixed(4)}°N, ${l.lon.toFixed(4)}°E <button type="button" class="cp">Copy</button></div>
    <div class="meta">${l.meta.map(m => `<span>${m}</span>`).join('')}</div><p>${l.text}</p>
    <div class="ev">${l.ev.map(([t, s]) => `<span><i class="${s === 1 ? 'y' : 'h'}"></i>${t}</span>`).join('')}</div>${spark(l)}`;
  a.querySelector('.cp').onclick = e => { navigator.clipboard && navigator.clipboard.writeText(`${l.lat.toFixed(5)}, ${l.lon.toFixed(5)}`); e.target.textContent = 'Copied'; setTimeout(() => { e.target.textContent = 'Copy'; }, 1400); };
  a.querySelector('h3 button').onclick = () => go(l);
  l.el = a; listEl.append(a);
});
let mapS, activeLoc;
function go(l) { if (activeLoc === l || !l) return; activeLoc = l; LOCS.forEach(x => x.el.classList.toggle('on', x === l)); if (mapS) mapS.flyTo({ center: [l.lon, l.lat], zoom: l.zoom, duration: 1500, essential: true }); }
whenSeen('#mapS', () => {
  mapS = makeMap('mapS', { center: [84.3362, 20.0028], zoom: 14 }, { scrollZoom: false });
  mapS.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  mapS.on('load', () => {
    addVectors(mapS, ['drainage', 'buildings_risk', 'border', 'route', 'weak', 'changes']);
    addMarkers(mapS, PLACES.filter(p => ['Kilapanga', 'Balingia', 'Baiballi'].includes(p[0])), false);
    LOCS.forEach(l => new maplibregl.Marker({ element: el('div', { class: 'nb', style: 'cursor:pointer' }, l.num) }).setLngLat([l.lon, l.lat]).addTo(mapS).getElement().addEventListener('click', () => { l.el.scrollIntoView({ block: 'center' }); }));
    if (activeLoc) mapS.jumpTo({ center: [activeLoc.lon, activeLoc.lat], zoom: activeLoc.zoom });
  });
});
const ioL = new IntersectionObserver(es => { es.forEach(e => { if (e.isIntersecting) go(LOCS.find(l => l.el === e.target)); }); }, { rootMargin: '-45% 0px -45% 0px' });
LOCS.forEach(l => ioL.observe(l.el));

/* Exposure */
const lv = DATA.stats.building_levels, rk = DATA.stats.road_km;
const barSet = (host, rows, unit) => { const m = Math.max(...rows.map(r => r[1])); $(host).innerHTML = rows.map(([t, v, c]) => `<div class="barrow"><span>${t}</span><span class="t"><i style="width:${Math.max(v / m * 100, 1)}%;background:${c}"></i></span><b>${v.toLocaleString('en-IN')}${unit}</b></div>`).join(''); };
barSet('#barsB', [['High: beside a change', lv[3], '#D93A1C'], ['Medium: low ground or steep', lv[2], '#E0920F'], ['Low: some exposure', lv[1], '#B7A84A']], '');
barSet('#barsR', [['High', rk[3], '#D93A1C'], ['Medium', rk[2], '#E0920F'], ['Low', rk[1], '#B7A84A']], ' km');
const nameFor = h => { const near = PLACES.map(([n, x, y]) => [n, Math.hypot((x - h.lon) * 104.6, (y - h.lat) * 110.5)]).sort((a, b) => a[1] - b[1])[0]; return near[1] < 1.5 ? near[0] : `Settlement at ${h.lat.toFixed(3)}°N, ${h.lon.toFixed(3)}°E`; };
const hot = [...DATA.hotspots].sort((a, b) => (a.km_tadama > 12) - (b.km_tadama > 12) || (b.risk3 - a.risk3));
$('#hot').innerHTML = `<thead><tr><th>Settlement</th><th class="n">High</th><th class="n">Medium</th><th class="n">km to Tadama</th></tr></thead><tbody>` + [{ n: 7, lat: 20.0028, lon: 84.3362, risk3: 7, risk2: 0, km_tadama: 2.1, label: 'Best-match hamlet' }, ...hot].slice(0, 11).map((h, i) => `<tr role="button" tabindex="0" data-i="${h.lat},${h.lon}"><td>${h.label || nameFor(h)}</td><td class="n">${h.risk3}</td><td class="n">${h.risk2}</td><td class="n">${h.km_tadama.toFixed(1)}</td></tr>`).join('') + '</tbody>';
$('#hot').querySelectorAll('tr[role=button]').forEach(tr => { const f = () => { const [la, lo] = tr.dataset.i.split(',').map(Number); document.getElementById('map').scrollIntoView(); mapX.flyTo({ center: [lo, la], zoom: 15, duration: 1400 }); }; tr.onclick = f; tr.onkeydown = e => { if (e.key === 'Enter') f(); }; });

/* Validation */
const c = DATA.stats.control;
const vset = (title, labels, vals) => { const m = Math.max(...vals); return `<div class="vrow"><span>${title}</span>` + vals.map((v, i) => `<div class="vbar ${i === 2 ? 'hot' : ''}"><span>${labels[i]}</span><span class="t"><i style="width:${v / m * 100}%"></i></span><b>${v}</b></div>`).join('') + '</div>'; };
const labels = ['6 Oct, normal', '18 Oct, normal', '30 Oct'];
$('#valid').innerHTML = vset('Sudden drops across 1,260 sq km', labels, c.all) + vset('Hill-slope drops within 4 km of Tadama', labels, c.tadama) +
  `<div class="vrow"><span>Slope drops inside the high-risk class, which covers 15% of hill land</span><div class="vbar hot"><span>10 of 12</span><span class="t"><i style="width:83%"></i></span><b>83%</b></div></div>`;

/* PlanetScope pass chart */
(function passes() {
  const s = $('#passes'); const P = DATA.stats.passes.filter(p => p.cover >= 50); const best = {};
  P.forEach(p => { best[p.d] = Math.max(best[p.d] ?? -1, p.clear); });
  const A = new Date('2026-09-14T00:00:00'), B = new Date('2026-11-04T00:00:00'); const x = d => 40 + (new Date(d + 'T12:00:00') - A) / (B - A) * 1150;
  let h = '<line x1="40" x2="1190" y1="140" y2="140" stroke="#7fa897"/>';
  [50, 100].forEach(v => { const y = 140 - v * 1.25; h += `<line x1="40" x2="1190" y1="${y}" y2="${y}" stroke="#2a6b55"/><text class="axis" x="0" y="${y + 4}">${v}%</text>`; });
  Object.entries(best).forEach(([d, v]) => { h += `<rect x="${x(d) - 7}" y="${140 - Math.max(v, 2) * 1.25}" width="14" height="${Math.max(v, 2) * 1.25}" rx="1.5" fill="${v >= 50 ? '#EAF4EE' : '#7fa897'}"><title>${fmtDate(d)}: ${v}% clear scene</title></rect>`; });
  h += `<line x1="${x('2026-10-28')}" x2="${x('2026-10-28')}" y1="6" y2="140" stroke="#FF4B2B" stroke-dasharray="4 3" stroke-width="1.5"/><text class="axis" x="${x('2026-10-28') + 6}" y="16" style="fill:#fff">Slide</text>`;
  ['2026-09-15', '2026-10-01', '2026-10-15', '2026-11-01'].forEach(d => { h += `<text class="axis" text-anchor="middle" x="${x(d)}" y="160">${fmtDate(d)}</text>`; });
  s.innerHTML = h;
})();
