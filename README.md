# Ganjam landslide dashboard

Satellite damage map for the landslides on the Ganjam-Kandhamal border in Odisha after the storm of 28 October 2026.

Live: https://khushi-pandey.github.io/ganjam-landslide-dashboard/

The map compares PlanetScope, Sentinel-2 and Sentinel-1 images from before and after the storm. It also shows the classified damage patches, affected buildings, rivers and roads, and a timeline of images from late September to early November.

The data is in `dl/`: damage patches as GeoJSON, plus CSVs of affected buildings, settlements and checked places.

It's a static site. To run it locally, serve the folder with any web server, for example `python -m http.server`, and open `localhost:8000`.
