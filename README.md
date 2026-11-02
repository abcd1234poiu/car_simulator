# Metro Cab

A browser driving and taxi simulator built with React, Three.js and Web Audio.
The active world is an original Southern California-inspired map. It is not a
one-to-one copy or data extracted from GTA V.

## Run

```sh
npm install
npm run dev
```

Use `npm run lint`, `npm test` and `npm run build` to validate changes.

## Replacement road world

- One continuous, larger drivable map: Los Santos street districts, Vespucci
  and Del Perro coast, Vinewood Hills, Sandy Shores, Paleto Bay, and the new
  Bayview City across the river.
- Named through roads include the Great Ocean Highway, Route 68, the Senora
  Freeway, the Olympic Freeway, Highland Parkway and the A7 Autobahn. The A7
  crosses an elevated river bridge and continues around Bayview's freeway ring.
- Hills and valleys use a shared height function for the terrain mesh, road
  grades, vehicle physics, camera and taxi markers. The City Crest and Bayview
  Rise climbs bring noticeable grades close to the cities and autobahn; use
  their teleport points to try uphill and downhill driving immediately.
- The 3D road ribbons, collision/off-road detection, steering assist, route
  graph, taxi stops, dispatch phone, HUD minimap and full map all share the
  same `ROAD_SEGMENTS` data. There is no hidden legacy city map in gameplay.
- Road widths are scaled to the car, and the road deck clears the rendered
  terrain across its full width. The car follows that same deck at junctions,
  preventing grass-covered lanes and sinking on Chumash hills or city streets.
- Freeway shoulders and outer lanes count as paved road even where a narrower
  city street overlaps the freeway. Off-road penalties begin on the grass.
- Both cities have deterministic buildings with window facades, varied heights
  and solid collision. Terrain and water help orient the player.
- Taxi fares, custom destinations, map-click road snapping and teleport points
  work throughout the replacement map.
- The vehicle model, engine audio, gearboxes, aspiration tuning, steering,
  braking and driving controls are preserved. Steering is filtered, drifting
  produces tyre smoke and skid marks, and rear-drive cars can power-oversteer
  with traction control off.
- Eco retains gentler part-pedal response, but a fully pressed accelerator now
  requests full engine output and the same high-RPM shift schedule as Sport
  instead of forcing an immediate RPM drop. The supercharged Meridian GT V6
  DSG can reach seventh gear and exceed 320 km/h on a long straight; the speed
  gauge has no 320 km/h red zone or fixed physics speed cap. Steering has a
  progressive speed-sensitive ratio and
  quicker return-to-center.
- Spring stiffness and absorber damping can be tuned before or during a drive,
  with Comfort, Balanced, Sport and Drift presets. Suspension settings affect
  steering response, body pitch/roll and vertical travel.
- Car models include sloped glazing, window seals, windshield wipers, projector
  lamps, door seams, detailed wheels and body motion over changing road grades.
  The selection-screen 3D preview uses the same model as the driving scene.
- Meridian GT has a reference-inspired long-hood grand-tourer treatment: a
  brighter yellow finish, rounded vertical grille, swept lamps, front-fender
  vents and fine multi-spoke alloys (without licensed badges or assets).
- Engine audio blends combustion synthesis with bundled loops, and responds to
  RPM, throttle and gear changes. Intake, tyre and wind noise vary with load,
  speed and off-road driving.
- Braking pitches the car forward in its local frame without sideways roll.
  Switching tabs releases controls without opening the pause menu; the pause
  menu opens only from Pause / `P` / `Esc`. Map routes are cached and the HUD
  refresh and render resolution are capped to reduce stalls on slower devices.

## Main files

- `src/maps/roadWorld.js` — road geometry, terrain, districts, buildings,
  stops, spatial queries, collisions and A* routing
- `src/engine/roadScene.js` — Three.js terrain, cities, bridges, roads and
  chase camera
- `src/maps/RoadMap.jsx` — HUD, phone and full-world maps
- `src/engine/freeRoamPhysics.js` — world-space vehicle movement
- `src/taxi/dispatch.js` — taxi fares and stop progression

## Controls

| Key | Action |
| --- | --- |
| W / ↑ | Throttle |
| S / ↓ | Brake / reverse |
| A / D / ← / → | Steer |
| Space | Handbrake |
| I | Ignition |
| G | Automatic/manual gearbox mode |
| V / N / F | Reverse/neutral/drive range |
| C + E / Q | Clutch and shift in manual mode |
| 1 / 2 / 3 | Eco/normal/sport |
| T | Traction control |
| R | Reset to spawn |
| P / Esc | Pause |
| M | Mute |

The full map lets you click a road to set a destination and teleport there.

## Audio attribution

Engine sample loops are from [“racing car engine sound loops” by domasx2](https://opengameart.org/content/racing-car-engine-sound-loops), released under CC0 / public domain. The game pitch-shifts them to follow RPM; other transients are synthesized at runtime.
