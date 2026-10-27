# searoam

A free-roaming world map with a small boat, controllable with a physical keyboard
such as the one on the Titan 2.

## Run

Serve this directory with any static web server, then open it in a browser. For
example, run `python3 -m http.server` from the repository directory and visit
<http://localhost:8000>. An internet connection is needed for the OpenStreetMap
tiles and Leaflet map library.

## Controls

- **W / Up:** throttle forward
- **S / Down:** reverse
- **A / Left:** turn left
- **D / Right:** turn right

Hold a key to steer. Drag the map to explore; use **Return to boat** to recenter.
Touch controls are also available on touch screens. The boat's live position is
shown in latitude and longitude, with speed in knots and heading in degrees.
