# ApexDrive

A browser driving simulator built with React, Three.js, and synthesized Web Audio.

## Run

```sh
npm install
npm run dev
```

Use `npm run lint` to check the source and `npm run build` to create a production build.

## Features

- Four cars with naturally aspirated, turbo, twin-turbo, supercharged, VTEC, and economy engine options.
- Manual, torque-converter automatic, CVT, DSG, and PDK transmissions have distinct launch, shift timing, torque handoff, and RPM behavior. Automatic gearboxes switch between D and manual M mode; the dashboard shows D1, D2, etc. CVT varies continuously in D and displays a virtual gear step.
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
| 1 / 2 / 3 | Eco / Normal / Sport |
| T | Toggle traction control |
| Space | Handbrake |
| R | Reset run |
| P / Escape | Pause |
| M | Mute |

Click or touch higher on a pedal for more input, then drag vertically to modulate it; releasing lets the pedal return to zero. On touch devices, use the steering buttons. Hold **Clutch** while tapping a shift paddle in a manual car. Automatic, DSG, PDK, and CVT cars use two pedals even in M mode. In D, pressing the gas fully requests a safe multi-gear kickdown; selecting Sport also requests a lower cruising gear.
