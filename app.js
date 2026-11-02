const { GEO, DATA, PLACE_LIST } = window;
const BOX = [84.18, 19.90, 84.52, 20.22];
const PBOX = [84.20, 19.90, 84.50, 20.12];
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const corners = b => [[b[0], b[3]], [b[2], b[3]], [b[2], b[1]], [b[0], b[1]]];
const $ = s => document.querySelector(s);
const el = (tag, attrs = {}, html) => { const e = document.createElement(tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; };
const fmtDate = d => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

const VIEWS = {
  Tadama: { center: [84.352, 19.9915], zoom: 14.4 },
  Hamlet: { center: [84.3362, 20.0028], zoom: 15.6 },
  Baiballi: { center: [84.402, 19.959], zoom: 13.6 },
  Slide: { center: [84.352, 19.988], zoom: 12.9 },
  Area: { center: [84.39, 19.985], zoom: 11 },
};
const PLACES = [['Tadama', 84.35204, 19.99131], ['Baiballi', 84.39448, 19.96069], ['Kilapanga', 84.30152, 20.02092], ['Balingia', 84.31016, 20.02461]];
const CLASS = {
  site: ['Reported site', '#0B3C2C'], debris: ['Debris stream', '#8A6D00'], slope: ['Hill slope', '#C8325E'], flood: ['Flood and silt', '#1673B0'], water: ['Field or tank water', '#6B7C72'],
};
const KIND = { slope: ['Hill slope', '#FF4F7B'], stream: ['Stream', '#FFC21F'], valley: ['Valley floor', '#4FB6F0'] };
const LEVEL = { 3: ['High', '#FF4B2B'], 2: ['Medium', '#FFB02E'], 1: ['Low', '#E9DE8F'] };
const IMAGES = {
  s2_oct: ['img/s2_oct.jpg', BOX, 'Sentinel-2, clearest of October'], s2_dry: ['img/s2_dry.jpg', BOX, 'Sentinel-2, dry season'],
  's2_2026-10-30': ['img/s2_2026-10-30.jpg', BOX, 'Sentinel-2, 30 Oct'], 's2_2026-11-02': ['img/s2_2026-11-02.jpg', BOX, 'Sentinel-2, 2 Nov'],
  hillshade: ['img/hillshade.jpg', BOX, 'Hillshade'],
};
DATA.series_days.forEach(d => { IMAGES['s1_' + d] = [`img/s1_${d}.jpg`, BOX, `Radar, ${fmtDate(d)}`]; });
['2026-10-06', '2026-10-12', '2026-10-21', '2026-10-22', '2026-10-26', '2026-10-27', '2026-10-30', '2026-11-01'].forEach(d => { IMAGES['planet_' + d] = [`img/planet_${d}.png`, PBOX, `PlanetScope, ${fmtDate(d)}`]; });
['s1_change', 'buildings', 'susceptibility', 'slope', 'lowland'].forEach(k => { IMAGES[k] = [`img/${k}.png`, BOX, k]; });

function makeMap(container, view, extra = {}) {
  return new maplibregl.Map({
    container, ...view, minZoom: 9, maxZoom: 18.4, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, ...extra,
    style: { version: 8, sources: { esri: { type: 'raster', tiles: [ESRI], tileSize: 256, maxzoom: 18, attribution: 'Imagery: Esri, Maxar, Earthstar Geographics' } },
      layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#E9EFE9' } }, { id: 'esri', type: 'raster', source: 'esri' }] },
  });
}
function addImage(map, id, opacity = 1, before) {
  const [url, bounds] = IMAGES[id];
  if (!map.getSource('i_' + id)) map.addSource('i_' + id, { type: 'image', url, coordinates: corners(bounds) });
  if (!map.getLayer('i_' + id)) map.addLayer({ id: 'i_' + id, type: 'raster', source: 'i_' + id, paint: { 'raster-opacity': opacity, 'raster-fade-duration': 0, 'raster-resampling': 'linear' } }, before);
}
function vis(map, ids, on) { [].concat(ids).forEach(i => map.getLayer(i) && map.setLayoutProperty(i, 'visibility', on ? 'visible' : 'none')); }
const siblings = n => [n, n + '_l', n + '_c', ...(n === 'buildings_risk' ? ['buildings_dot'] : [])];

const VECTOR = {
  contours: m => m.addLayer({ id: 'contours', type: 'line', source: 'contours', paint: { 'line-color': '#fff', 'line-opacity': ['case', ['get', 'major'], .45, .22], 'line-width': ['case', ['get', 'major'], .9, .5] } }),
  drainage: m => m.addLayer({ id: 'drainage', type: 'line', source: 'drainage', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#8ED8FF', 'line-opacity': .85, 'line-width': ['match', ['get', 'class'], 3, 2.6, 2, 1.6, .8] } }),
  roads: m => m.addLayer({ id: 'roads', type: 'line', source: 'roads', layout: { 'line-cap': 'round' }, paint: { 'line-color': ['match', ['get', 'level'], 3, LEVEL[3][1], 2, LEVEL[2][1], LEVEL[1][1]], 'line-width': ['match', ['get', 'level'], 3, 3, 2, 2.2, 1.3] } }),
  buildings_risk: m => { m.addLayer({ id: 'buildings_risk', type: 'fill', source: 'buildings_risk', paint: { 'fill-color': ['match', ['get', 'level'], 3, LEVEL[3][1], LEVEL[2][1]], 'fill-opacity': .95 } }); m.addLayer({ id: 'buildings_dot', type: 'circle', source: 'buildings_risk', maxzoom: 14, paint: { 'circle-radius': 2, 'circle-color': ['match', ['get', 'level'], 3, LEVEL[3][1], LEVEL[2][1]], 'circle-opacity': .9 } }); },
  border: m => m.addLayer({ id: 'border', type: 'line', source: 'border', paint: { 'line-color': '#FFD23F', 'line-width': 1.4, 'line-dasharray': [3, 2] } }),
  runout: m => m.addLayer({ id: 'runout', type: 'line', source: 'runout', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FFB27A', 'line-width': 1.8, 'line-dasharray': [1.5, 1.5] } }),
  route: m => { m.addLayer({ id: 'route_c', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#0a2b20', 'line-width': 4.5, 'line-opacity': .6 } }); m.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#fff', 'line-width': 2, 'line-dasharray': [2.5, 1.6] } }); },
  weak: m => m.addLayer({ id: 'weak', type: 'line', source: 'weak', paint: { 'line-color': '#FFD23F', 'line-width': 1.5, 'line-dasharray': [1, 1] } }),
  changes: m => { const color = ['match', ['get', 'kind'], 'slope', KIND.slope[1], 'small_stream', KIND.stream[1], 'stream', KIND.stream[1], KIND.valley[1]];
    m.addLayer({ id: 'changes', type: 'fill', source: 'changes', paint: { 'fill-color': color, 'fill-opacity': .9 } });
    m.addLayer({ id: 'changes_l', type: 'line', source: 'changes', paint: { 'line-color': '#10130f', 'line-width': .8, 'line-opacity': .75 } }); },
};
function addVectors(map, names, hidden = []) {
  names.forEach(n => { if (!map.getSource(n)) map.addSource(n, { type: 'geojson', data: GEO[n] }); VECTOR[n](map); });
  hidden.forEach(n => vis(map, siblings(n), false));
}
function addLabels(map, list) {
  return list.map(([n, x, y]) => new maplibregl.Marker({ element: el('div', { class: 'mk' }, n), anchor: 'left', offset: [18, 0] }).setLngLat([x, y]).addTo(map));
}
function addPin(map, p, onClick) {
  const d = el('div', { class: `pin c-${p.cls}`, role: 'button', tabindex: 0, 'aria-label': `${p.num}, ${p.name}` }, p.num);
  d.addEventListener('click', e => { e.stopPropagation(); onClick(p); });
  d.addEventListener('keydown', e => { if (e.key === 'Enter') onClick(p); });
  return new maplibregl.Marker({ element: d }).setLngLat([p.lon, p.lat]).addTo(map);
}
function jumpButtons(host, map, names) { names.forEach(([label, key]) => { const b = el('button', { type: 'button' }, label); b.onclick = () => map.flyTo({ ...VIEWS[key], duration: 1400, essential: true }); host.append(b); }); }
const whereTxt = p => `${p.lat.toFixed(4)}°N, ${p.lon.toFixed(4)}°E`;

/* Explorer */
const MAIN = [
  { id: 'changes', label: 'Radar drop, 30 Oct', on: true, keys: Object.values(KIND).map(([t, c]) => [t, c]) },
  { id: 'pins', label: 'Classified places', on: true, keys: Object.values(CLASS).map(([t, c]) => [t, c]) },
  { id: 'route', label: 'Flow route to Baiballi', on: true, keys: [[`${DATA.stats.route_km} km along streams`, '#7c8a83', 1]] },
  { id: 'buildings_risk', label: 'Buildings at risk', on: false, keys: [['High', LEVEL[3][1]], ['Medium', LEVEL[2][1]]] },
  { id: 'drainage', label: 'Drainage from DEM', on: false, keys: [['Over 1 sq km catchment', '#4FB6F0', 1]] },
];
const MORE = [
  { id: 'roads', label: 'Roads at risk', on: false, keys: [['High', LEVEL[3][1], 1], ['Medium', LEVEL[2][1], 1], ['Low', '#BFB25A', 1]] },
  { id: 'buildings', label: 'All buildings', raster: 1, on: false, opacity: 1, keys: [['51,418 footprints', '#D8CFA8']] },
  { id: 'runout', label: 'Modelled debris paths', on: false, keys: [['Downhill from each source', '#E08A4A', 1]] },
  { id: 'weak', label: 'Weak signal near hamlet', on: false, keys: [['Below test level', '#C9A515', 1]] },
  { id: 's1_change', label: 'Radar change map', raster: 1, on: false, opacity: .85, keys: [['Signal lost', '#E84828'], ['Signal gained', '#56AAE1']] },
  { id: 'susceptibility', label: 'Landslide susceptibility', raster: 1, on: false, opacity: .7, keys: [['Low', '#78BE8C'], ['Medium', '#F0C450'], ['High', '#D63C28']] },
  { id: 'slope', label: 'Slope', raster: 1, on: false, opacity: .75, keys: [['15-25°', '#F5DE82'], ['25-35°', '#EC963C'], ['Over 35°', '#B02A28']] },
  { id: 'lowland', label: 'Low ground beside streams', raster: 1, on: false, opacity: .8, keys: [['Under 6 m above stream', '#46A5E6']] },
  { id: 'border', label: 'District border', on: false, keys: [['Approximate', '#C9A515', 1]] },
  { id: 'contours', label: 'Contours, 50 m', on: false },
  { id: 'hillshade', label: 'Hillshade', raster: 1, on: false, opacity: .55 },
];
const BASES = [['esri', 'Satellite map'], ['s2_oct', 'Sentinel-2 Oct'], ['planet_2026-11-01', 'PlanetScope 1 Nov'], ['s1_2026-10-30', 'Radar 30 Oct']];
const mapX = makeMap('mapX', VIEWS.Slide);
mapX.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
mapX.addControl(new maplibregl.ScaleControl({ maxWidth: 110 }), 'bottom-right');
jumpButtons($('#jump'), mapX, [['Slide area', 'Slide'], ['Hamlet', 'Hamlet'], ['Baiballi', 'Baiballi'], ['All places', 'Area']]);

function layerRow(it, xPins) {
  const row = el('div', { class: 'lrow' });
  const cb = el('input', { type: 'checkbox' }); cb.checked = it.on;
  const lab = el('label'); lab.append(cb, document.createTextNode(it.label)); row.append(lab);
  let keys, range;
  if (it.keys) { keys = el('div', { class: 'keys' }, it.keys.map(([t, c, ln]) => `<span><i class="${ln ? 'ln' : ''}" style="background:${c}"></i>${t}</span>`).join('')); keys.hidden = !it.on; row.append(keys); }
  if (it.raster) { range = el('input', { type: 'range', min: 0, max: 100, value: it.opacity * 100, 'aria-label': it.label + ' opacity' }); range.hidden = !it.on; row.append(range);
    range.oninput = () => mapX.setPaintProperty('i_' + it.id, 'raster-opacity', range.value / 100); }
  cb.onchange = () => {
    if (keys) keys.hidden = !cb.checked;
    if (it.id === 'pins') { xPins.forEach(m => { m.getElement().style.display = cb.checked ? '' : 'none'; }); return; }
    if (it.raster) { addImage(mapX, it.id, it.opacity, 'drainage'); vis(mapX, 'i_' + it.id, cb.checked); range.hidden = !cb.checked; return; }
    vis(mapX, siblings(it.id), cb.checked);
  };
  return row;
}

mapX.on('load', () => {
  addVectors(mapX, ['contours', 'drainage', 'roads', 'buildings_risk', 'border', 'runout', 'route', 'weak', 'changes'], ['contours', 'drainage', 'roads', 'buildings_risk', 'border', 'runout', 'weak']);
  addLabels(mapX, PLACES);
  const pop = p => new maplibregl.Popup({ maxWidth: '260px', offset: 14 }).setLngLat([p.lon, p.lat]).setHTML(`<b>${p.num}. ${p.name}</b>${CLASS[p.cls][0]}, ${p.rating}<br>${whereTxt(p)}`).addTo(mapX);
  const xPins = PLACE_LIST.map(p => addPin(mapX, p, pop));

  const pick = $('#basePick');
  let current = 'esri';
  BASES.forEach(([id, label]) => {
    if (id !== 'esri' && !IMAGES[id]) return;
    const b = el('button', { type: 'button', role: 'radio', 'aria-checked': id === 'esri' }, label);
    b.onclick = () => {
      if (current !== 'esri') vis(mapX, 'i_' + current, false);
      current = id;
      if (id !== 'esri') { addImage(mapX, id, 1, 'contours'); vis(mapX, 'i_' + id, true); }
      [...pick.children].forEach(c => c.setAttribute('aria-checked', c === b));
    };
    pick.append(b);
  });
  MAIN.forEach(it => $('#layerMain').append(layerRow(it, xPins)));
  MORE.forEach(it => $('#layerMore').append(layerRow(it, xPins)));

  mapX.on('click', 'changes', e => {
    const p = e.features[0].properties;
    new maplibregl.Popup({ maxWidth: '260px' }).setLngLat(e.lngLat).setHTML(`<b>${(KIND[p.kind] || KIND.stream)[0]}</b>${p.lat}°N, ${p.lon}°E<br>Radar drop ${p.dVV} dB<br>${p.ha} ha, ${p.z_top} to ${p.z_bot} m`).addTo(mapX);
  });
  mapX.on('click', 'buildings_risk', e => { const p = e.features[0].properties; new maplibregl.Popup({ maxWidth: '220px' }).setLngLat(e.lngLat).setHTML(`<b>Building</b>${LEVEL[p.level][0]} risk`).addTo(mapX); });
  ['changes', 'buildings_risk'].forEach(l => { mapX.on('mouseenter', l, () => { mapX.getCanvas().style.cursor = 'pointer'; }); mapX.on('mouseleave', l, () => { mapX.getCanvas().style.cursor = ''; }); });
  mapX.on('mousemove', e => { $('#coord').textContent = `${e.lngLat.lat.toFixed(4)}°N, ${e.lngLat.lng.toFixed(4)}°E`; });
});

function whenSeen(sel, fn) { const t = $(sel); const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); fn(); } }, { rootMargin: '400px' }); io.observe(t); }

/* Places */
const ORDER = ['site', 'debris', 'slope', 'flood', 'water'];
const RANK = { 'Best match': 0, Strong: 1, Possible: 2, Weak: 3 };
const sorted = [...PLACE_LIST].sort((a, b) => ORDER.indexOf(a.cls) - ORDER.indexOf(b.cls) || RANK[a.rating] - RANK[b.rating] || a.num - b.num);
function spark(l) {
  if (!l.vv) return '';
  const base = a => { const m = a.slice(0, -1).reduce((s, v) => s + v, 0) / (a.length - 1); return a.map(v => v - m); };
  const v = base(l.vv), g = base(l.ground); const lo = Math.min(-4, ...v); const W = 360, H = 96; const x = i => 34 + i * (W - 96) / 5; const y = d => 8 + (1.5 - d) / (1.5 - lo) * (H - 28);
  const path = a => a.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d).toFixed(1)}`).join('');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="Radar signal over six passes. On 30 October it fell ${Math.abs(v[5]).toFixed(1)} dB here.">
    <line x1="34" x2="${x(5)}" y1="${y(0)}" y2="${y(0)}" stroke="#CBD5CD"/><text x="0" y="${y(0) + 4}">0 dB</text>
    <path d="${path(g)}" fill="none" stroke="#8A9A91" stroke-width="2"/><path d="${path(v)}" fill="none" stroke="#D0301A" stroke-width="2"/>
    ${v.map((d, i) => `<circle cx="${x(i)}" cy="${y(d)}" r="3.5" fill="#D0301A"><title>${fmtDate(DATA.series_days[i])}: ${d.toFixed(1)} dB</title></circle>`).join('')}
    <text x="${x(5) + 7}" y="${y(v[5]) + 4}">here ${v[5].toFixed(1)}</text><text x="${x(5) + 7}" y="${y(g[5]) + 4}">nearby</text>
    <text x="${x(0)}" y="${H - 2}" text-anchor="middle">31 Aug</text><text x="${x(5)}" y="${H - 2}" text-anchor="middle">30 Oct</text></svg>`;
}
const metaFor = l => [l.z_top === l.z_bot ? `About ${l.z_top} m` : `${l.z_top} to ${l.z_bot} m`, l.ha != null && `${l.ha} ha`, l.drop != null && `Drop ${Math.abs(l.drop)} dB`, `${l.b500} buildings within 500 m`].filter(Boolean);
const listEl = $('#locList');
const groups = {};
ORDER.forEach(c => { const items = sorted.filter(p => p.cls === c); const g = el('div', { class: 'lgrp' }, `<h3>${CLASS[c][0]}</h3>`); groups[c] = g; listEl.append(g);
  items.forEach(l => {
    const a = el('article', { class: 'loc' });
    a.innerHTML = `<button type="button" aria-expanded="false"><span class="pin c-${l.cls}">${l.num}</span><span class="nm">${l.name}</span><span class="rt">${l.rating}</span></button>
      <div class="detail" hidden><p>${l.text}</p><div class="xy">${whereTxt(l)} <button type="button" class="cp">Copy</button></div><div class="meta">${metaFor(l).map(m => `<span>${m}</span>`).join('')}</div>${spark(l)}</div>`;
    a.querySelector('.cp').onclick = e => { e.stopPropagation(); if (navigator.clipboard) navigator.clipboard.writeText(`${l.lat.toFixed(5)}, ${l.lon.toFixed(5)}`); e.target.textContent = 'Copied'; setTimeout(() => { e.target.textContent = 'Copy'; }, 1400); };
    a.querySelector('button').onclick = () => go(l);
    l.el = a; g.append(a);
  });
});
let mapS, active, filter = null;
function go(l, reveal) {
  if (active && active !== l) { active.el.classList.remove('on'); active.el.querySelector('.detail').hidden = true; active.el.querySelector('button').setAttribute('aria-expanded', 'false'); if (active.pin) active.pin.getElement().classList.remove('on'); }
  active = l; l.el.classList.add('on'); l.el.querySelector('.detail').hidden = false; l.el.querySelector('button').setAttribute('aria-expanded', 'true');
  if (l.pin) l.pin.getElement().classList.add('on');
  if (mapS) mapS.flyTo({ center: [l.lon, l.lat], zoom: l.zoom, duration: 1300, essential: true });
  if (reveal) l.el.scrollIntoView({ block: 'nearest' });
}
const chipHost = $('#chips');
const chip = (label, c, n) => { const b = el('button', { type: 'button', 'aria-pressed': c === null }, `${c ? `<i class="c-${c}"></i>` : ''}${label} ${n}`); b.onclick = () => setFilter(c, b); chipHost.append(b); };
chip('All', null, PLACE_LIST.length);
ORDER.forEach(c => chip(CLASS[c][0], c, PLACE_LIST.filter(p => p.cls === c).length));
function setFilter(c, btn) {
  filter = c;
  [...chipHost.children].forEach(x => x.setAttribute('aria-pressed', x === btn));
  ORDER.forEach(k => { groups[k].hidden = !!c && k !== c; });
  PLACE_LIST.forEach(p => { if (p.pin) p.pin.getElement().style.display = !c || p.cls === c ? '' : 'none'; });
  const shown = PLACE_LIST.filter(p => !c || p.cls === c);
  if (mapS) { const b = new maplibregl.LngLatBounds(); shown.forEach(p => b.extend([p.lon, p.lat])); mapS.fitBounds(b, { padding: 70, maxZoom: 14, duration: 1200 }); }
  if (active && c && active.cls !== c) { active.el.classList.remove('on'); active.el.querySelector('.detail').hidden = true; if (active.pin) active.pin.getElement().classList.remove('on'); active = null; }
}
go(sorted[0]);
whenSeen('#mapS', () => {
  mapS = makeMap('mapS', { center: [active ? active.lon : 84.35, active ? active.lat : 19.99], zoom: active ? active.zoom : 12 }, { scrollZoom: false });
  mapS.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  mapS.on('load', () => {
    addVectors(mapS, ['route', 'changes']);
    addLabels(mapS, PLACES);
    PLACE_LIST.forEach(p => { p.pin = addPin(mapS, p, q => { if (filter && q.cls !== filter) return; go(q, true); }); });
    if (active) active.pin.getElement().classList.add('on');
  });
});

/* Timeline */
const T0 = new Date('2026-08-28T00:00:00'); const T1 = new Date('2026-11-05T00:00:00');
const tx = d => 96 + (new Date(d + 'T12:00:00') - T0) / (T1 - T0) * 1094;
const FRAMES = [];
DATA.series_days.forEach(d => FRAMES.push({ row: 0, d, id: 's1_' + d, label: `Radar, ${fmtDate(d)}`, solid: true }));
Object.keys(IMAGES).filter(k => k.startsWith('planet_')).forEach(k => { const d = k.slice(7); const c = DATA.stats.planet_index[d]; const cloud = c.best_clear === 0;
  FRAMES.push({ row: 1, d, id: k, label: `PlanetScope, ${fmtDate(d)}, ${cloud ? 'all cloud' : c.best_clear + '% clear'}`, solid: !cloud }); });
FRAMES.push({ row: 2, d: '2026-10-13', id: 's2_oct', label: 'Sentinel-2, clearest of October', solid: true });
FRAMES.push({ row: 2, d: '2026-10-30', id: 's2_2026-10-30', label: 'Sentinel-2, 30 Oct, all cloud', solid: false });
FRAMES.push({ row: 2, d: '2026-11-02', id: 's2_2026-11-02', label: 'Sentinel-2, 2 Nov, all cloud', solid: false });
FRAMES.sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : a.row - b.row);

(function strip() {
  const s = $('#strip'); let h = '';
  const days = Object.entries(DATA.rain_daily); const max = Math.max(...days.map(d => d[1]));
  h += `<text class="track" x="0" y="50">Rain</text><text class="axis" x="0" y="66">mm a day</text>`;
  days.forEach(([d, v]) => { if (v > 0.5) { const b = v / max * 62; const big = v > 60; h += `<rect x="${tx(d) - 5}" y="${76 - b}" width="10" height="${b}" rx="2" fill="${d === '2026-10-28' ? '#D0301A' : '#9DBFD6'}"><title>${fmtDate(d)}: ${Math.round(v)} mm</title></rect>`; if (big) h += `<text class="axis" text-anchor="middle" x="${tx(d)}" y="${70 - b}">${Math.round(v)}</text>`; } });
  h += `<line x1="${tx('2026-10-28')}" x2="${tx('2026-10-28')}" y1="4" y2="166" stroke="#D0301A" stroke-width="1.5" stroke-dasharray="4 3"/><text class="track" text-anchor="end" x="${tx('2026-10-28') - 8}" y="14">Slide, 28 Oct</text>`;
  ['Radar', 'PlanetScope', 'Sentinel-2'].forEach((n, i) => { const y = 102 + i * 28; h += `<text class="track" x="0" y="${y + 4}">${n}</text><line x1="96" x2="1190" y1="${y}" y2="${y}" stroke="#E2E8E3"/>`; });
  ['2026-09-01', '2026-09-15', '2026-10-01', '2026-10-15', '2026-11-01'].forEach(d => { h += `<text class="axis" text-anchor="middle" x="${tx(d)}" y="188">${fmtDate(d)}</text>`; });
  s.innerHTML = h;
  FRAMES.forEach((f, i) => {
    const y = 102 + f.row * 28;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'frame'); g.setAttribute('tabindex', 0); g.setAttribute('role', 'button'); g.setAttribute('aria-label', f.label);
    g.innerHTML = `<title>${f.label}</title><circle class="ring" cx="${tx(f.d)}" cy="${y}" r="10.5"/><circle cx="${tx(f.d)}" cy="${y}" r="13" fill="transparent"/><circle class="dot" cx="${tx(f.d)}" cy="${y}" r="6" fill="${f.solid ? '#0B3C2C' : '#fff'}" stroke="#0B3C2C" stroke-width="2"/>`;
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
  mapT.on('load', () => { addVectors(mapT, ['drainage']); mapT.setPaintProperty('drainage', 'line-opacity', .3); addLabels(mapT, PLACES.slice(0, 2)); show(frameNow); });
});

/* Compare */
const PAIRS = [
  ['PlanetScope', 'planet_2026-10-22', 'planet_2026-11-01'],
  ['Radar', 's1_2026-10-18', 's1_2026-10-30'],
  ['Dry season and 1 Nov', 's2_dry', 'planet_2026-11-01'],
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
    [a, b].forEach((m, k) => { const id = k ? ib : ia; m.getStyle().layers.filter(l => l.id.startsWith('i_')).forEach(l => vis(m, l.id, false)); addImage(m, id, 1); vis(m, 'i_' + id, true); });
    $('#tagA').textContent = IMAGES[ia][2]; $('#tagB').textContent = IMAGES[ib][2];
    [...$('#cmpTabs').children].forEach((c, k) => c.setAttribute('aria-selected', k === i));
  };
  PAIRS.forEach((p, i) => { const t = el('button', { type: 'button', role: 'tab', 'aria-selected': i === 0 }, p[0]); t.onclick = () => setPair(i); $('#cmpTabs').append(t); });
  [a, b].forEach(m => m.on('load', () => { if (++ready === 2) setPair(0); }));
  const swipe = $('#swipe'), handle = $('#handle'), clip = $('#cmpB');
  const setX = pct => { pct = Math.max(2, Math.min(98, pct)); clip.style.clipPath = `inset(0 0 0 ${pct}%)`; handle.style.left = pct + '%'; handle.setAttribute('aria-valuenow', Math.round(pct)); };
  let drag = false;
  handle.addEventListener('pointerdown', e => { drag = true; handle.setPointerCapture(e.pointerId); });
  handle.addEventListener('pointermove', e => { if (drag) { const r = swipe.getBoundingClientRect(); setX((e.clientX - r.left) / r.width * 100); } });
  handle.addEventListener('pointerup', () => { drag = false; });
  handle.addEventListener('keydown', e => { const v = +handle.getAttribute('aria-valuenow'); if (e.key === 'ArrowLeft') setX(v - 3); if (e.key === 'ArrowRight') setX(v + 3); });
  swipe.addEventListener('pointerdown', e => { if (handle.contains(e.target) || e.target.closest('button')) return; const r = swipe.getBoundingClientRect(); clip.style.pointerEvents = (e.clientX - r.left) / r.width * 100 < +handle.getAttribute('aria-valuenow') ? 'none' : 'auto'; }, true);
});

/* Exposure */
const lv = DATA.stats.building_levels, rk = DATA.stats.road_km;
const num = v => v.toLocaleString('en-IN');
$('#tally').innerHTML = [['Buildings, high risk', num(lv[3]), ''], ['Buildings, medium risk', num(lv[2]), ''], ['Roads, high risk', rk[3], ' km'], ['Roads, medium risk', rk[2], ' km']]
  .map(([t, v, u]) => `<div><dt>${t}</dt><dd>${v}${u ? `<small>${u}</small>` : ''}</dd></div>`).join('');
const ALL = [...PLACES, ['Manikeswar', 84.27217, 20.01301], ['Katingia', 84.29576, 20.064], ['G. Udayagiri', 84.37, 20.122], ['Raikia', 84.2408, 20.059], ['Kalinga', 84.4116, 20.1628]];
const nameFor = h => { const near = ALL.map(([n, x, y]) => [n, Math.hypot((x - h.lon) * 104.6, (y - h.lat) * 110.5)]).sort((a, b) => a[1] - b[1])[0]; return near[1] < 1.5 ? near[0] : `${h.lat.toFixed(3)}°N, ${h.lon.toFixed(3)}°E`; };
const hot = [...DATA.hotspots].sort((a, b) => (a.km_tadama > 12) - (b.km_tadama > 12) || (b.risk3 - a.risk3));
$('#hot').innerHTML = `<thead><tr><th>Settlement</th><th class="n">High</th><th class="n">Medium</th><th class="n">km to Tadama</th></tr></thead><tbody>` + [{ lat: 20.0028, lon: 84.3362, risk3: 7, risk2: 0, km_tadama: 2.1, label: 'Best-match hamlet' }, ...hot].slice(0, 7).map(h => `<tr role="button" tabindex="0" data-i="${h.lat},${h.lon}"><td>${h.label || nameFor(h)}</td><td class="n">${h.risk3}</td><td class="n">${h.risk2}</td><td class="n">${h.km_tadama.toFixed(1)}</td></tr>`).join('') + '</tbody>';
$('#hot').querySelectorAll('tr[role=button]').forEach(tr => { const f = () => { const [la, lo] = tr.dataset.i.split(',').map(Number); document.getElementById('map').scrollIntoView(); mapX.flyTo({ center: [lo, la], zoom: 15, duration: 1400 }); }; tr.onclick = f; tr.onkeydown = e => { if (e.key === 'Enter') f(); }; });

/* Validation */
const c = DATA.stats.control;
$('#valid').innerHTML = `<thead><tr><th>Radar pass</th><th class="n">Drops, 1,260 sq km</th><th class="n">Slope drops near Tadama</th></tr></thead><tbody>` +
  ['6 Oct, normal', '18 Oct, normal', '30 Oct, after the slide'].map((t, i) => `<tr class="${i === 2 ? 'hi' : ''}"><td>${t}</td><td class="n">${c.all[i]}</td><td class="n">${c.tadama[i]}</td></tr>`).join('') + '</tbody>';
