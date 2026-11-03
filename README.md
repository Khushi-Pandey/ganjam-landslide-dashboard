# Ganjam landslide dashboard

Satellite damage map for the landslides on the Ganjam-Kandhamal border in Odisha after the storm of 28 October 2026.

Live: https://khushi-pandey.github.io/ganjam-landslide-dashboard/

After the storm, Sentinel-2 saw only cloud and PlanetScope got a part-clear view only on 1 November, so the damage comes from Sentinel-1 radar. The 30 October pass was compared with five passes from 31 August to 18 October. A spot counts as damaged when the radar signal fell by at least 3 dB and was darker than on any earlier pass. That gives 50 patches covering 36 ha. 40 of them sit along streams, from Tadama down to Baiballi and the valley below it. Each earlier pass was tested the same way against the others, to show how much of this is noise.

Radar images were fetched through Sentinel Hub: terrain-corrected, with a Lee speckle filter, on a 0.0002° grid in EPSG:4326.

Click any patch on the map to see Sentinel-1, Sentinel-2 and PlanetScope views of it from before and after the storm. The damage patches are in `dl/damage_patches.geojson`, and the per-pass numbers are in `dl/radar_passes.csv`.

It's a static site. To run it locally, serve the folder with any web server, for example `python -m http.server`, and open `localhost:8000`.
