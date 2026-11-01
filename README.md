# Metro Cab

A browser taxi-driver simulator built with React, Three.js, and synthesized
Web Audio. Taxi dispatch lives inside a large open-city free-roam session, so
you can explore and take fares in the same world.

## Run

```sh
npm install
npm run dev
```

Use `npm run lint` to check the source, `npm test` to run the simulation tests
and `npm run build` to create a production build.

## Features

- One merged open-world session: choose a car, enter the world, and accept taxi
  fares from the dispatch phone whenever you like. There is no separate taxi /
  free-roam mode switch.
- Metro City is a 14 × 14-block grid with seven districts: Downtown Core,
  Midtown, Old Town, Harbor District, University Quarter, Industrial Park and
  Garden Suburbs. Five major avenues, a river and pedestrian flyovers break up
  the grid.
- Six urban areas share the world: Metro City plus Riverside, Northgate,
  Southport, Highland and Suncoast. The **A1 East Link** runs end-to-end from
  Metro City through Riverside, Highland and Suncoast, while the A1 north-south
  trunk and its exits connect Northgate and Southport. Cross-town fares and
  free-roam trips use the same routing and map.
- Two mountain routes built from **real road geometry and real SRTM elevation
  data**. **Genting Pass** is north of Metro City, converted from the Genting
  Sempah–Genting Highlands road. **Batang Pass** is a distinct route west of the
  city, converted from the Batang Kali–Genting Highlands road. Both are scaled
  into game-friendly hairpins, switchbacks, 6–8 km of road and roughly 300 m of
  game elevation. Terrain, road ribbons, guardrails, lighting and forest are
  generated in 3D, and slope physics affects acceleration and RPM. A generated
  **Ridge Road** connects the two summits, turning the passes into a longer
  mountain loop instead of two dead ends. The data lives in
  `src/maps/gentingRoad.js` and `src/maps/batangRoad.js`.
- District-aware generation changes building height, palette, roof style, park
  density, tree cover and landmark names. Towers get podiums and slimmer shafts,
  low residential blocks get pitched roofs, paved plazas with fountains break up
  the blocks, and building facades vary across the city.
- World-space arcade vehicle model with steering, lateral grip, wheelspin,
  solid building/parked-car/river-wall collisions and an off-road grip penalty.
  A gentle keyboard steer assist realigns the car with the road whenever the
  driver releases the steering keys. Collisions use a spatial hash so the larger
  map stays fast.
- A more detailed parametric player car: clearcoat paint, tapered bodywork,
  sculpted fenders, chrome beltline, split side windows, detailed multi-spoke
  wheels with brake discs, projector headlights, a full-width tail-light bar,
  exhaust tips, mirrors, door hardware and an illuminated TAXI roof sign.
- The open-world map is the only map. A rotating minimap tracks position and
  heading, shows taxi routes, custom destinations and pickup/drop-off pins and
  clamps far targets to the map edge. The same map is used on the dispatch
  phone, and the map button opens a full-world overview with district labels,
  the river, autobahn and every town.
- Click anywhere on the full map to drop a custom destination; the route is
  drawn to it on the overview, HUD minimap and phone map. Use **Clear** in the
  overview to remove it.
- Full-map **teleport panel** for quick travel to Metro City, Riverside,
  Northgate, Southport, Highland, Suncoast, the A1 East Link, Genting Pass and
  Batang Pass. You can also click anywhere on the map to set a custom point and
  use **Teleport here** to jump directly to that location. Teleporting clears
  speed and places the car on the selected road or terrain.
- Dispatch rides are world-space landmarks across every town. Pickups rotate through every city and drop-offs are placed in a
  different city, so the job board keeps the whole map in use. Accept a fare, follow the route to the pickup, stop below 6 km/h
  within 20 m to board, then drive to the drop-off to get paid. Active fares can
  be cancelled from the phone footer, and earnings/completed rides are tracked
  across the shift.
- Aspiration selection (naturally aspirated, turbo, twin-turbo, supercharger
  and VTEC) works on every engine. Each engine starts at its factory tune, so
  the existing catalogue keeps its performance; alternative tunes add or
  remove boost, cam behaviour, sound character and spec-sheet output.
- Five cars including a default city taxi, with naturally aspirated, turbo,
  twin-turbo, supercharged, VTEC, and economy engine options.
- Every car can be fitted with every gearbox: manual, torque-converter
  automatic, CVT, DSG, and PDK. They have distinct launch, shift timing, torque
  handoff, and RPM behavior. Automatic gearboxes switch between D and manual M
  mode; the dashboard shows D1, D2, etc. CVT varies continuously in D and
  displays a virtual gear step. At wide-open throttle, automatic boxes upshift
  just below the redline instead of holding a gear against the rev limiter.
- Manual clutch has a progressive bite point: holding **C** disconnects drive
  and lets the engine free-rev, while partially releasing it transfers torque
  gradually for smoother launches and hill starts.
- Three tyre compounds: **Street**, **Sport** and **Slick**, with increasing
  grip and faster wear. Tyres have long durability for normal driving, wear
  gradually from rolling/braking/wheelspin/sliding, and lose grip progressively
  once worn. Hard cornering, handbrake use and wheelspin produce visible tyre
  smoke and acceleration/steering feel changes.
- Increased steering lock and yaw response, giving sharper low-speed corners
  (up to ~60° of road-wheel angle) while the speed-sensitive limit keeps
  high-speed steering controllable. The mobile steering wheel turns further,
  needs less drag for full lock and shows the wheel angle in degrees.
  The handbrake yaw assist follows the same steering direction, so a left-hand
  handbrake turn rotates left.
- All gearboxes support reverse and neutral. The on-screen R–N–D/1 selector
  works on desktop and mobile; neutral disconnects the engine and lets it
  free-rev, and the odometer records distance in either direction. Direction can
  be changed without coming to a full stop: reversing against forward speed
  (or driving against reverse speed) produces a violent transmission shock,
  hard tyre scrub and a **SHIFT SHOCK** warning. Manual cars still require the
  clutch.
- Handbrake system: press **Space** (or hold the mobile HB button) to lock the
  rear wheels, add strong deceleration, reduce lateral grip and show
  **HANDBRAKE** on the dashboard status. On mobile, drag the HB button upward to
  latch the handbrake on; tap it again to release.
- Eco, Normal, and Sport modes alter throttle response and shift strategy. In D,
  steady light throttle shifts early as speed builds; heavy throttle holds gears
  longer. Traction control can be switched off independently.
- Engine braking (overrun) is modelled from closed-throttle pumping losses,
  engine displacement, rpm and the selected gear ratio. Off throttle, low gears
  slow the car much harder than top gear, rpm tracks road speed faster and the
  dashboard shows **ENGINE BRAKE** while it is active.
- Push-button ignition: the car starts with the engine off. Press **I** or the
  power button to start/stop the engine. Starting plays a layered starter-motor
  crank, firing attempts, an engine-catch flap and a short rev blip before
  settling to idle. Both
  gauges sweep to full and settle back to their real values during ignition.
- Engine-specific combustion-pulse audio with exhaust resonances, intake noise,
  V8 firing cadence, VTEC high-cam character, turbo release, supercharger whine,
  and shift transients. An oscillator fallback is used if AudioWorklet is
  unavailable.
- Real engine recordings are layered under the synthesized voice and pitch-shifted
  with RPM, so the idle, revs and overrun sound like a recording rather than a
  pure oscillator. Performance engines crackle and bang on upshifts, hard
  lift-off and overrun; quieter engines give a soft exhaust burble, and the
  engine catches with a short exhaust pop after ignition.
- Analog on-screen gas and brake pedals on desktop and mobile. Manual cars also
  have a clutch pedal and shift paddles. Mobile steering uses a draggable
  steering wheel for fine analog control, and a dedicated handbrake button is
  available alongside the pedals. On a computer, **Space** is the handbrake.

## Controls

| Input | Action |
| --- | --- |
| W / Up | Gas |
| S / Down | Brake |
| A / D / Left / Right | Steer |
| C | Clutch (manual gearbox) |
| E / Q | Shift up / down (hold clutch in a manual car) |
| G | Switch automatic gearbox between D and M |
| V / N / F | Select reverse / neutral / drive (first gear in a manual) |
| 1 / 2 / 3 | Eco / Normal / Sport |
| T | Toggle traction control |
| Space | Handbrake |
| I | Ignition on / off |
| R | Return to spawn and start a fresh shift |
| P / Escape | Pause |
| M | Mute |

Click or touch higher on a pedal for more input, then drag vertically to
modulate it; releasing lets the pedal return to zero. On touch devices, use the
steering buttons. Hold **Clutch** while tapping a shift paddle in a manual car.
Automatic, DSG, PDK, and CVT cars use two pedals even in M mode. In D, pressing
the gas fully requests a safe multi-gear kickdown; selecting Sport also requests
a lower cruising gear.

Enter the city, press **I** to start the engine, then accept a request on the
in-game phone. Follow the route on
the city map to the pickup, stop safely, and drive to the drop-off. Use the phone
button at the top of the driving screen for the next fare. The map button opens
a full-screen city map; click it to set a custom destination, then close it with
the X button or the map button again.

## Source layout

- `src/engine/physics.js` — shared engine, gearbox, clutch and traction model
- `src/engine/freeRoamPhysics.js` — world-space steering, slip and collisions
- `src/engine/cityScene.js` — open-city Three.js renderer
- `src/engine/carModel.js` — parametric player car and sun sprite
- `src/maps/city.js` — procedural districts, roads, buildings, collisions,
  landmarks and street routing
- `src/maps/Minimap.jsx` — rotating minimap, phone map and full city overview
- `src/taxi/dispatch.js` — world-space dispatch state machine
- `src/hooks/useDrivingSession.js` — simulation loop and input wiring


## Data attribution

The Genting Pass and Batang Pass road geometries are derived from OpenStreetMap
data (© OpenStreetMap contributors, ODbL), retrieved as routes via the Valhalla
public routing service. Elevations are from OpenTopoData's SRTM 30 m dataset
(NASA SRTM). The Ridge Road is generated in-engine to connect the two summits.
All mountain data has been converted to game coordinates and scaled for
gameplay.

Engine sample loops are from **"racing car engine sound loops" by domasx2**,
released under **CC0 / public domain** on OpenGameArt.org:
https://opengameart.org/content/racing-car-engine-sound-loops
The loops are pitch-shifted by the game to follow RPM. Starter, firing and
shift transients remain synthesized at runtime.
