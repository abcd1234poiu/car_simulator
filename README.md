# Metro Cab

A browser taxi-driver simulator built with React, Three.js, and synthesized Web Audio.

## Run

```sh
npm install
npm run dev
```

Use `npm run lint` to check the source and `npm run build` to create a production build.

## Features

- Dispatch phone with incoming ride tickets, passenger names, pickup/drop-off locations, fare estimates, and an accept/skip/next-ride loop. Stop below 6 km/h at or after each waypoint to board and complete the ride; earnings and completed rides are tracked during the shift.
- Each shift generates a different winding road with side streets. The 3D road and map share the same route geometry, while prominent pickup and drop-off beacons appear at their real roadside positions. The map also shows a live vehicle marker, stop pins, route line, and distance to the next stop. You can reverse along the road, but choosing turns at intersections is not yet implemented.
- Five cars including a default city taxi, with naturally aspirated, turbo, twin-turbo, supercharged, VTEC, and economy engine options.
- Manual, torque-converter automatic, CVT, DSG, and PDK transmissions have distinct launch, shift timing, torque handoff, and RPM behavior. Automatic gearboxes switch between D and manual M mode; the dashboard shows D1, D2, etc. CVT varies continuously in D and displays a virtual gear step.
- All gearboxes now support reverse and neutral. The on-screen R–N–D/1 selector works on desktop and mobile; reverse movement scrolls the world backward, neutral disconnects the engine and lets it free-rev, and the odometer records distance in either direction. Stop before reversing; automatic cars require the brake, while manual cars require the clutch.
- Eco, Normal, and Sport modes alter throttle response and shift strategy. In D, steady light throttle shifts early as speed builds; heavy throttle holds gears longer. Traction control can be switched off independently.
- Engine-specific combustion-pulse audio with exhaust resonances, intake noise, V8 firing cadence, VTEC high-cam character, turbo release, supercharger whine, and shift transients. An oscillator fallback is used if AudioWorklet is unavailable.
- Analog on-screen gas and brake pedals on desktop and mobile. Manual cars also have a clutch pedal and shift paddles; touch steering is available on mobile.

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
| R | Reset run |
| P / Escape | Pause |
| M | Mute |

Click or touch higher on a pedal for more input, then drag vertically to modulate it; releasing lets the pedal return to zero. On touch devices, use the steering buttons. Hold **Clutch** while tapping a shift paddle in a manual car. Automatic, DSG, PDK, and CVT cars use two pedals even in M mode. In D, pressing the gas fully requests a safe multi-gear kickdown; selecting Sport also requests a lower cruising gear.

Start a shift, accept a request on the in-game phone, follow the map to the pickup, and brake to a stop. Then drive to the drop-off and stop again. Use the phone button at the top of the driving screen for the next fare. Resetting the drive also resets the shift's dispatch progress.
