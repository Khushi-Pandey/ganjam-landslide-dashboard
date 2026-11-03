# Ganjam landslide dashboard

Satellite damage map for the landslides on the Ganjam-Kandhamal border in Odisha after the storm of 28 October 2026.

**Live:** https://khushi-pandey.github.io/ganjam-landslide-dashboard/

## What it shows

The dashboard has three tabs:

- **Timeline** plays the storm day by day over Sentinel-1, Sentinel-2 or PlanetScope images, with daily rain and the date of every satellite pass. Damage appears when the radar pass of 30 October arrives.
- **Before / after** puts two images side by side with a slider. Pick the satellite and date for each side.
- **Damage** lists every damaged patch, largest first. Click a patch, here or on the map, to see close-up Sentinel-1, Sentinel-2 and PlanetScope views of it from before and after the storm.

## How the damage was found

After the storm, Sentinel-2 saw only cloud, and PlanetScope got its first part-clear view on 1 November. So the damage comes from Sentinel-1 radar, which sees through cloud.

The 30 October pass was compared with five earlier passes on the same track, from 31 August to 18 October. A spot counts as damaged when its signal fell by at least 3 dB in VV and 2 dB in VH. It also has to be darker than on every earlier pass, and cover at least 6 pixels (about 0.3 ha).

| Result | Value |
|---|---|
| Damage patches | 50 |
| Area | 36 ha |
| Patches along a stream | 40 |
| Buildings within 100 m | 40 (none inside a patch) |
| River length inside damage | 4.6 km |

At the damaged spots, the radar signal stayed between -6.9 and -8.0 dB for seven passes, then dropped to -13.3 dB on 30 October. The ground around them stayed near -6.8 dB.

To measure noise, each earlier pass was tested the same way against the others. These passes gave between 0 and 88 patches, mostly in fields, with the most on 31 August and 6 October. A single small patch can therefore be a false alarm. The strongest evidence is the clusters along the streams from Tadama down to Baiballi and the valley below.

## Data

| Source | Use | Dates |
|---|---|---|
| Sentinel-1 GRD, track 121 | Damage detection, timeline | 7 Aug to 30 Oct 2026 |
| Sentinel-2 L2A | Timeline, close-ups | 28 Sep to 2 Nov 2026 |
| PlanetScope | Timeline, close-ups | 27 Sep to 1 Nov 2026 |
| Esri World Imagery | Satellite basemap | |

Sentinel-1 and Sentinel-2 were fetched through Sentinel Hub. The radar is terrain-corrected with the Copernicus 30 m DEM and has a Lee speckle filter. All rasters are on EPSG:4326 grids over 84.18-84.52° E, 19.90-20.22° N.

## Files

```
index.html           page
css/style.css        styles
js/app.js            map, timeline, charts
js/data.js           damage patches, rivers, roads, pass and rain data
data/frames/         satellite images for the timeline and the slider
data/previews/       close-up sheets, one per damage patch
data/buildings.webp  building footprints
downloads/           damage patches (GeoJSON) and radar passes (CSV)
vendor/              MapLibre GL
img/                 logos
```

## Run locally

It's a static site. Serve the folder with any web server and open it in a browser:

```
python -m http.server 8000
```

Then go to `http://localhost:8000`.
