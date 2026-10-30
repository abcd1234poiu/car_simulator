/**
 * Vehicle catalogue, engines and transmissions.
 * Pure data — no React or DOM dependencies.
 */

export const ENGINES = {
  'inline-4': {
    id: 'inline-4',
    name: '2.0L Turbo I4',
    shortName: 'Turbo I4',
    layout: 'Inline-4',
    badge: 'I4',
    displacement: 2.0,
    cylinders: 4,
    idleRpm: 850,
    redline: 6800,
    maxRpm: 7200,
    character: 'Rev-happy turbo four with a crisp, metallic exhaust note.',
    torqueCurve: [
      { rpm: 900, torque: 170 },
      { rpm: 1500, torque: 245 },
      { rpm: 2600, torque: 320 },
      { rpm: 3800, torque: 312 },
      { rpm: 5200, torque: 268 },
      { rpm: 6400, torque: 215 },
      { rpm: 7200, torque: 150 },
    ],
    sound: {
      harmonic: 2.05,
      sub: 0.22,
      noise: 0.55,
      brightness: 1.08,
      drive: 1.4,
      volume: 0.92,
      lfoRate: 27,
    },
  },

  v6: {
    id: 'v6',
    name: '3.5L V6',
    shortName: 'V6',
    layout: 'V6',
    badge: 'V6',
    displacement: 3.5,
    cylinders: 6,
    idleRpm: 750,
    redline: 7500,
    maxRpm: 7900,
    character: 'Smooth, balanced power delivery with a mellow wail up top.',
    torqueCurve: [
      { rpm: 800, torque: 255 },
      { rpm: 1600, torque: 350 },
      { rpm: 2800, torque: 425 },
      { rpm: 4300, torque: 418 },
      { rpm: 5800, torque: 368 },
      { rpm: 7000, torque: 300 },
      { rpm: 7900, torque: 220 },
    ],
    sound: {
      harmonic: 2.0,
      sub: 0.3,
      noise: 0.45,
      brightness: 0.95,
      drive: 1.15,
      volume: 0.9,
      lfoRate: 23,
    },
  },

  v8: {
    id: 'v8',
    name: '5.0L V8',
    shortName: 'V8',
    layout: 'V8',
    badge: 'V8',
    displacement: 5.0,
    cylinders: 8,
    idleRpm: 650,
    redline: 7900,
    maxRpm: 8400,
    character: 'Deep, angry burble that turns into a full-blooded roar.',
    torqueCurve: [
      { rpm: 700, torque: 380 },
      { rpm: 1500, torque: 505 },
      { rpm: 3000, torque: 565 },
      { rpm: 4400, torque: 548 },
      { rpm: 5900, torque: 492 },
      { rpm: 7300, torque: 420 },
      { rpm: 8400, torque: 315 },
    ],
    sound: {
      harmonic: 1.95,
      sub: 0.42,
      noise: 0.62,
      brightness: 0.82,
      drive: 1.8,
      volume: 0.95,
      lfoRate: 19,
    },
  },
}

export const TRANSMISSIONS = {
  manual: {
    id: 'manual',
    name: '6-Speed Manual',
    shortName: 'Manual',
    type: 'manual',
    description: 'Full control. Shift with E / Q and keep the engine on the boil.',
    gearRatios: [3.66, 2.36, 1.69, 1.31, 1.05, 0.84],
    finalDrive: 3.55,
    shiftUpFraction: 0.94,
    shiftDownFraction: 0.42,
  },
  automatic: {
    id: 'automatic',
    name: '8-Speed Automatic',
    shortName: 'Automatic',
    type: 'automatic',
    description: 'Effortless pace. The gearbox picks the ratio so you can focus on the road.',
    gearRatios: [4.6, 2.9, 2.0, 1.55, 1.25, 1.0, 0.84, 0.7],
    finalDrive: 3.05,
    shiftUpFraction: 0.82,
    shiftDownFraction: 0.33,
  },
}

export const CARS = [
  {
    id: 'aero-rs',
    name: 'Aero RS',
    className: 'Sport Coupe',
    tagline: 'Featherweight, rear-drive and built for apex hunting.',
    bodyStyle: 'coupe',
    color: '#22d3ee',
    accent: '#67e8f9',
    mass: 1340,
    drivetrain: 'RWD',
    grip: 0.95,
    dragCd: 0.3,
    frontalArea: 1.95,
    wheelRadius: 0.33,
    seats: 2,
    engines: ['inline-4', 'v6'],
    defaultEngine: 'inline-4',
    transmissions: ['manual', 'automatic'],
    defaultTransmission: 'manual',
  },
  {
    id: 'titan-8',
    name: 'Titan 8',
    className: 'Muscle Car',
    tagline: 'Old-school displacement, modern manners, zero subtlety.',
    bodyStyle: 'muscle',
    color: '#ff5a3c',
    accent: '#ffb199',
    mass: 1710,
    drivetrain: 'RWD',
    grip: 0.83,
    dragCd: 0.35,
    frontalArea: 2.2,
    wheelRadius: 0.35,
    seats: 4,
    engines: ['v8'],
    defaultEngine: 'v8',
    transmissions: ['manual', 'automatic'],
    defaultTransmission: 'manual',
  },
  {
    id: 'meridian-gt',
    name: 'Meridian GT',
    className: 'Grand Tourer',
    tagline: 'All-wheel drive composure for crossing continents at speed.',
    bodyStyle: 'gt',
    color: '#f5c76b',
    accent: '#ffe6b0',
    mass: 1590,
    drivetrain: 'AWD',
    grip: 0.99,
    dragCd: 0.31,
    frontalArea: 2.05,
    wheelRadius: 0.34,
    seats: 4,
    engines: ['v6', 'v8'],
    defaultEngine: 'v6',
    transmissions: ['automatic', 'manual'],
    defaultTransmission: 'automatic',
  },
  {
    id: 'nova-s',
    name: 'Nova S',
    className: 'Hot Hatch',
    tagline: 'Light on its feet, loud on boost and endlessly playful.',
    bodyStyle: 'hatch',
    color: '#a3e635',
    accent: '#d9f99d',
    mass: 1215,
    drivetrain: 'FWD',
    grip: 0.8,
    dragCd: 0.33,
    frontalArea: 1.9,
    wheelRadius: 0.32,
    seats: 4,
    engines: ['inline-4'],
    defaultEngine: 'inline-4',
    transmissions: ['manual', 'automatic'],
    defaultTransmission: 'manual',
  },
]

export const DEFAULT_SELECTION = {
  carId: CARS[0].id,
  engineId: CARS[0].defaultEngine,
  transmissionId: CARS[0].defaultTransmission,
}

export function getCar(carId) {
  return CARS.find((car) => car.id === carId) ?? CARS[0]
}

export function getEngine(engineId) {
  return ENGINES[engineId] ?? ENGINES['inline-4']
}

export function getTransmission(transmissionId) {
  return TRANSMISSIONS[transmissionId] ?? TRANSMISSIONS.manual
}
