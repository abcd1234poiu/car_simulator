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
    induction: 'turbo',
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
      profile: 'turbo',
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
    induction: 'natural',
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
      profile: 'smooth',
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
    induction: 'natural',
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
      profile: 'muscle',
      harmonic: 1.95,
      sub: 0.42,
      noise: 0.62,
      brightness: 0.82,
      drive: 1.8,
      volume: 0.95,
      lfoRate: 19,
    },
  },
  'twin-turbo-v6': {
    id: 'twin-turbo-v6', name: '3.0L Twin-Turbo V6', shortName: 'Twin-Turbo V6',
    layout: 'V6', badge: 'TT V6', displacement: 3.0, induction: 'twin-turbo', cylinders: 6,
    idleRpm: 780, redline: 7100, maxRpm: 7500,
    character: 'Two quick-spooling turbos deliver a broad, forceful midrange and a sharp hiss.',
    torqueCurve: [
      { rpm: 800, torque: 230 }, { rpm: 1500, torque: 300 }, { rpm: 2500, torque: 430 },
      { rpm: 4000, torque: 465 }, { rpm: 5500, torque: 445 }, { rpm: 6800, torque: 355 },
      { rpm: 7500, torque: 250 },
    ],
    sound: { profile: 'twin-turbo', harmonic: 2.32, sub: 0.22, noise: 0.62, brightness: 1.15, drive: 1.25, volume: 0.9, lfoRate: 26 },
  },
  's58-i6': {
    id: 's58-i6', name: '3.0L Twin-Turbo I6', shortName: 'TT I6',
    layout: 'Inline-6', badge: 'TT I6', displacement: 3.0, induction: 'twin-turbo', cylinders: 6,
    idleRpm: 800, redline: 7200, maxRpm: 7600,
    character: 'A high-boost inline-six with a broad torque plateau and a hard top-end pull.',
    torqueCurve: [
      { rpm: 800, torque: 450 }, { rpm: 1800, torque: 550 }, { rpm: 2750, torque: 650 },
      { rpm: 4000, torque: 650 }, { rpm: 5500, torque: 640 }, { rpm: 6500, torque: 590 },
      { rpm: 7200, torque: 520 }, { rpm: 7600, torque: 430 },
    ],
    sound: { profile: 'twin-turbo', harmonic: 2.55, sub: 0.2, noise: 0.66, brightness: 1.18, drive: 1.3, volume: 0.98, lfoRate: 28 },
  },
  'supercharged-v8': {
    id: 'supercharged-v8', name: '5.0L Supercharged V8', shortName: 'Supercharged V8',
    layout: 'V8', badge: 'SC V8', displacement: 5.0, induction: 'supercharger', cylinders: 8,
    idleRpm: 680, redline: 7600, maxRpm: 8000,
    character: 'Instant blower response, a deep V8 pulse and a rising mechanical whine.',
    torqueCurve: [
      { rpm: 700, torque: 420 }, { rpm: 1500, torque: 530 }, { rpm: 2600, torque: 610 },
      { rpm: 4200, torque: 650 }, { rpm: 5900, torque: 610 }, { rpm: 7200, torque: 510 },
      { rpm: 8000, torque: 390 },
    ],
    sound: { profile: 'supercharged', harmonic: 1.82, sub: 0.48, noise: 0.55, brightness: 0.9, drive: 2, volume: 1, lfoRate: 18 },
  },
  'vtec-i4': {
    id: 'vtec-i4', name: '2.0L VTEC I4', shortName: 'VTEC I4',
    layout: 'Inline-4', badge: 'VTEC', displacement: 2.0, induction: 'vtec', cylinders: 4,
    idleRpm: 820, redline: 8500, maxRpm: 8900,
    character: 'Naturally aspirated response with a pronounced high-cam surge above 5,500 rpm.',
    torqueCurve: [
      { rpm: 850, torque: 120 }, { rpm: 2000, torque: 150 }, { rpm: 4000, torque: 185 },
      { rpm: 5400, torque: 190 }, { rpm: 5900, torque: 215 }, { rpm: 7200, torque: 230 },
      { rpm: 8500, torque: 210 }, { rpm: 8900, torque: 175 },
    ],
    sound: { profile: 'vtec', harmonic: 2.75, sub: 0.12, noise: 0.42, brightness: 1.35, drive: 1.15, volume: 0.9, lfoRate: 32 },
  },
  'k20c1-i4': {
    id: 'k20c1-i4', name: '2.0L Turbo I4 (K20C1)', shortName: 'K20C1',
    layout: 'Inline-4', badge: 'K20C1', displacement: 2.0, induction: 'turbo-vtec', cylinders: 4,
    idleRpm: 800, redline: 7000, maxRpm: 7200,
    character: 'High-boost four-cylinder with a strong midrange and a hard pull to redline.',
    torqueCurve: [
      { rpm: 800, torque: 250 }, { rpm: 1500, torque: 350 }, { rpm: 2500, torque: 420 },
      { rpm: 3500, torque: 420 }, { rpm: 5000, torque: 400 }, { rpm: 6000, torque: 360 },
      { rpm: 6800, torque: 300 }, { rpm: 7200, torque: 250 },
    ],
    sound: { profile: 'turbo', harmonic: 2.2, sub: 0.18, noise: 0.58, brightness: 1.15, drive: 1.25, volume: 0.9, lfoRate: 28 },
  },
  'k3-ve-i4': {
    id: 'k3-ve-i4', name: '1.3L K3-VE I4', shortName: 'K3-VE',
    layout: 'Inline-4', badge: 'K3-VE', displacement: 1.3, induction: 'natural', cylinders: 4,
    idleRpm: 750, redline: 6000, maxRpm: 6500,
    character: 'Compact naturally aspirated four tuned for easy city driving and low running costs.',
    torqueCurve: [
      { rpm: 800, torque: 90 }, { rpm: 2000, torque: 105 }, { rpm: 3200, torque: 116 },
      { rpm: 4500, torque: 110 }, { rpm: 5500, torque: 95 }, { rpm: 6000, torque: 80 },
      { rpm: 6500, torque: 65 },
    ],
    sound: { profile: 'smooth', harmonic: 2.1, sub: 0.12, noise: 0.2, brightness: 0.82, drive: 0.7, volume: 0.55, lfoRate: 26 },
  },
  'eco-i4': {
    id: 'eco-i4', name: '1.8L Economy I4', shortName: 'Economy I4',
    layout: 'Inline-4', badge: 'ECO', displacement: 1.8, induction: 'natural', cylinders: 4,
    idleRpm: 700, redline: 6100, maxRpm: 6500,
    character: 'Quiet, efficient and smooth, with gentle power rather than an aggressive exhaust.',
    torqueCurve: [
      { rpm: 700, torque: 105 }, { rpm: 1500, torque: 140 }, { rpm: 2800, torque: 175 },
      { rpm: 4000, torque: 180 }, { rpm: 5200, torque: 165 }, { rpm: 6100, torque: 140 },
      { rpm: 6500, torque: 110 },
    ],
    sound: { profile: 'quiet', harmonic: 2, sub: 0.1, noise: 0.12, brightness: 0.62, drive: 0.5, volume: 0.6, lfoRate: 24 },
  },
}

export const ASPIRATIONS = {
  na: {
    id: 'na',
    name: 'Naturally Aspirated',
    shortName: 'N/A',
    badge: 'NA',
    type: 'na',
    description: 'Linear, instant response. No lag, no waiting — just the engine.',
    torqueMultiplier: 1,
    boostGain: 0,
    spoolRpm: 0,
    lag: 20,
    sound: { whistle: 0, whine: 0, brightness: 1, noise: 1, blowOff: false, vtec: false },
  },
  turbo: {
    id: 'turbo',
    name: 'Single Turbo',
    shortName: 'Turbo',
    badge: 'TURBO',
    type: 'turbo',
    description: 'A big mid-range shove once the turbine spools. Lift for the blow-off.',
    torqueMultiplier: 1.04,
    boostGain: 0.5,
    spoolRpm: 2200,
    lag: 3.2,
    sound: { whistle: 0.05, whine: 0, brightness: 1.14, noise: 1.18, blowOff: true, vtec: false },
  },
  'twin-turbo': {
    id: 'twin-turbo',
    name: 'Twin Turbo',
    shortName: 'Twin Turbo',
    badge: 'TT',
    type: 'twin',
    description: 'Two turbos, almost no lag and a savage top end.',
    torqueMultiplier: 1.06,
    boostGain: 0.64,
    spoolRpm: 1600,
    lag: 5.2,
    sound: { whistle: 0.065, whine: 0, brightness: 1.2, noise: 1.32, blowOff: true, vtec: false },
  },
  supercharger: {
    id: 'supercharger',
    name: 'Supercharger',
    shortName: 'Supercharged',
    badge: 'SC',
    type: 'supercharger',
    description: 'Belt-driven boost from idle. Instant, linear and loud.',
    torqueMultiplier: 1.05,
    boostGain: 0.46,
    spoolRpm: 700,
    lag: 18,
    sound: { whistle: 0, whine: 0.055, brightness: 1.06, noise: 1.12, blowOff: false, vtec: false },
  },
  'turbo-vtec': {
    id: 'turbo-vtec',
    name: 'Turbo VTEC',
    shortName: 'Turbo VTEC',
    badge: 'T-VTEC',
    type: 'turbo-vtec',
    description: 'Turbo boost and a high-cam VTEC change together: strong midrange, then a hard top-end step.',
    torqueMultiplier: 1.04,
    boostGain: 0.52,
    spoolRpm: 2000,
    lag: 3.4,
    vtecRpm: 5600,
    vtecGain: 1.12,
    sound: { whistle: 0.05, whine: 0, brightness: 1.18, noise: 1.24, blowOff: true, vtec: true },
  },
  vtec: {
    id: 'vtec',
    name: 'VTEC',
    shortName: 'VTEC',
    badge: 'VTEC',
    type: 'vtec',
    description: 'Mild below the cam change, wild above it. The classic high-rpm kick.',
    torqueMultiplier: 1.02,
    boostGain: 0,
    spoolRpm: 0,
    lag: 20,
    vtecRpm: 5600,
    vtecGain: 1.16,
    sound: { whistle: 0, whine: 0, brightness: 1.12, noise: 0.96, blowOff: false, vtec: true },
  },
}

export const clamp01 = (value) => Math.min(1, Math.max(0, value))

/** Aspiration multiplier used for spec sheets (full boost / cam engaged). */
export function aspirationFactorAtRpm(aspiration, rpm, redline) {
  if (!aspiration) return 1
  const base = aspiration.torqueMultiplier ?? 1
  if (aspiration.type === 'turbo' || aspiration.type === 'twin' ||
    aspiration.type === 'turbo-vtec') {
    const span = Math.max(1, redline * 0.8 - aspiration.spoolRpm)
    const spool = clamp01((rpm - aspiration.spoolRpm) / span)
    const boost = 1 + aspiration.boostGain * spool
    if (aspiration.type === 'turbo-vtec') {
      const cam = clamp01((rpm - aspiration.vtecRpm) / 420)
      return base * boost * (1 + (aspiration.vtecGain - 1) * cam)
    }
    return base * boost
  }
  if (aspiration.type === 'supercharger') {
    return base * (1 + aspiration.boostGain * clamp01(rpm / redline))
  }
  if (aspiration.type === 'vtec') {
    const blend = clamp01((rpm - aspiration.vtecRpm) / 420)
    return base * (1 + (aspiration.vtecGain - 1) * blend)
  }
  return base
}

/**
 * Destination engines ship with a factory induction tune (turbo, twin-turbo,
 * supercharger, VTEC or natural). The aspiration picker treats that tune as
 * the baseline, so selecting it leaves the existing performance untouched.
 */
export function defaultAspirationForEngine(engine) {
  const id = {
    natural: 'na',
    turbo: 'turbo',
    'twin-turbo': 'twin-turbo',
    supercharger: 'supercharger',
    vtec: 'vtec',
    'turbo-vtec': 'turbo-vtec',
  }[engine?.induction] ?? 'na'
  return getAspiration(id)
}

/** Torque multiplier of `aspiration` relative to the engine's factory tune. */
export function aspirationRatioAtRpm(aspiration, baseAspiration, rpm, redline) {
  const base = aspirationFactorAtRpm(baseAspiration, rpm, redline)
  return base > 0 ? aspirationFactorAtRpm(aspiration, rpm, redline) / base : 1
}

export const TRANSMISSIONS = {
  manual: {
    id: 'manual',
    name: '6-Speed Manual',
    shortName: 'Manual',
    type: 'manual',
    kind: 'manual',
    description: 'Full control. Hold C (clutch), then shift with E / Q. On mobile, hold the clutch pedal while shifting.',
    gearRatios: [3.66, 2.36, 1.69, 1.31, 1.05, 0.84],
    reverseRatio: 3.32,
    finalDrive: 3.55,
    shiftUpFraction: 0.94,
    shiftDownFraction: 0.42,
    shiftDuration: 0.24,
    shiftTorqueTransfer: 0.15,
    shiftRpmRate: 16,
  },
  automatic: {
    id: 'automatic',
    name: '8-Speed Automatic',
    shortName: 'Automatic',
    type: 'automatic',
    kind: 'torque-converter',
    description: 'Smooth converter launch and measured shifts. D adapts to your pedal, with kickdown for overtaking.',
    gearRatios: [4.6, 2.9, 2.0, 1.55, 1.25, 1.0, 0.84, 0.7],
    reverseRatio: 3.3,
    finalDrive: 3.05,
    shiftUpFraction: 0.82,
    shiftDownFraction: 0.33,
    shiftDuration: 0.38,
    shiftTorqueTransfer: 0.56,
    shiftRpmRate: 13,
    shiftLowBias: -0.025,
    kickdownThreshold: 0.82,
    kickdownMaxRpm: 0.78,
    kickdownImprovement: 0.08,
    kickdownSkipDelay: 0.035,
    creepAcceleration: 0.38,
  },
  cvt: {
    id: 'cvt', name: 'Continuously Variable', shortName: 'CVT', type: 'cvt', kind: 'cvt',
    description: 'Seamless ratio changes hold the engine near its efficient or power band. Manual mode offers six virtual steps.',
    gearRatios: [3.7, 2.75, 2.05, 1.52, 1.12, 0.76], finalDrive: 3.45,
    reverseRatio: 3.0,
    shiftUpFraction: 0.77, shiftDownFraction: 0.38, shiftDuration: 0.08,
    shiftTorqueTransfer: 0.95, shiftRpmRate: 18, ratioResponse: 3.2,
    creepAcceleration: 0.27,
  },
  dsg: {
    id: 'dsg', name: '7-Speed DSG', shortName: 'DSG', type: 'automatic', kind: 'dual-clutch',
    description: 'Preselected next gear and rapid dual-clutch shifts. D short-shifts gently or drops gears for acceleration.',
    gearRatios: [3.75, 2.31, 1.56, 1.17, 0.91, 0.76, 0.62], finalDrive: 3.65,
    reverseRatio: 3.4,
    shiftUpFraction: 0.88, shiftDownFraction: 0.36, shiftDuration: 0.12,
    shiftTorqueTransfer: 0.83, shiftRpmRate: 34, shiftLowBias: 0.01,
    kickdownThreshold: 0.72, kickdownMaxRpm: 0.82,
    kickdownImprovement: 0.07, kickdownSkipDelay: 0.045, creepAcceleration: 0.22,
    unpreparedShiftDelay: 0.08,
  },
  pdk: {
    id: 'pdk', name: '8-Speed PDK', shortName: 'PDK', type: 'automatic', kind: 'dual-clutch',
    description: 'Close ratios and lightning-fast shifts; Sport mode keeps the engine on song.',
    gearRatios: [3.91, 2.29, 1.65, 1.30, 1.08, 0.88, 0.73, 0.61], finalDrive: 3.45,
    reverseRatio: 3.2,
    shiftUpFraction: 0.9, shiftDownFraction: 0.4, shiftDuration: 0.09,
    shiftTorqueTransfer: 0.9, shiftRpmRate: 42, shiftLowBias: 0.02,
    kickdownThreshold: 0.68, kickdownMaxRpm: 0.87,
    kickdownImprovement: 0.06, kickdownSkipDelay: 0.025, creepAcceleration: 0.24,
    unpreparedShiftDelay: 0.05,
  },
}

export const ALL_TRANSMISSIONS = Object.freeze(Object.keys(TRANSMISSIONS))

export const TYRES = {
  street: {
    id: 'street',
    name: 'Street',
    shortName: 'STREET',
    badge: 'ST',
    grip: 1,
    wearRate: 0.4,
    description: 'Long-lasting all-round road tyre. Predictable grip in every condition.',
  },
  sport: {
    id: 'sport',
    name: 'Sport',
    shortName: 'SPORT',
    badge: 'SP',
    grip: 1.1,
    wearRate: 0.65,
    description: 'Softer performance compound with more lateral grip and faster wear.',
  },
  slick: {
    id: 'slick',
    name: 'Slick',
    shortName: 'SLICK',
    badge: 'SL',
    grip: 1.22,
    wearRate: 0.8,
    description: 'Maximum dry grip. Heats up quickly, tears quickly and loses grip as it wears.',
  },
}
export const TYRE_ORDER = ['street', 'sport', 'slick']
export const DEFAULT_TYRE = TYRES.street.id

export const SUSPENSION_PRESETS = Object.freeze({
  comfort: Object.freeze({ name: 'Comfort', spring: 0.3, damper: 0.38 }),
  balanced: Object.freeze({ name: 'Balanced', spring: 0.58, damper: 0.62 }),
  sport: Object.freeze({ name: 'Sport', spring: 0.86, damper: 0.82 }),
  drift: Object.freeze({ name: 'Drift', spring: 0.72, damper: 0.5 }),
})
export const DEFAULT_SUSPENSION = SUSPENSION_PRESETS.balanced
export function normalizeSuspension(suspension = DEFAULT_SUSPENSION) {
  return {
    spring: clamp01(Number(suspension?.spring ?? DEFAULT_SUSPENSION.spring)),
    damper: clamp01(Number(suspension?.damper ?? DEFAULT_SUSPENSION.damper)),
  }
}

export const CARS = [
  {
    id: 'metro-cab',
    name: 'Metro Cab',
    className: 'City Taxi',
    tagline: 'A comfortable four-door workhorse, ready for the next fare.',
    bodyStyle: 'sedan',
    taxi: true,
    color: '#f5c94a',
    accent: '#fff0a6',
    mass: 1460,
    fuelCapacity: 50,
    drivetrain: 'FWD',
    grip: 0.82,
    dragCd: 0.32,
    frontalArea: 2.12,
    wheelRadius: 0.32,
    seats: 4,
    engines: ['eco-i4', 'inline-4'],
    defaultEngine: 'eco-i4',
    transmissions: ALL_TRANSMISSIONS,
    defaultTransmission: 'automatic',
  },
  {
    id: 'aero-rs',
    name: 'Aero RS',
    className: 'Sport Coupe',
    tagline: 'Featherweight, rear-drive and built for apex hunting.',
    bodyStyle: 'coupe',
    color: '#22d3ee',
    accent: '#67e8f9',
    mass: 1340,
    fuelCapacity: 55,
    drivetrain: 'RWD',
    grip: 0.95,
    dragCd: 0.3,
    frontalArea: 1.95,
    wheelRadius: 0.33,
    seats: 2,
    engines: ['inline-4', 'vtec-i4', 'twin-turbo-v6', 'v6'],
    defaultEngine: 'inline-4',
    transmissions: ALL_TRANSMISSIONS,
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
    fuelCapacity: 70,
    drivetrain: 'RWD',
    grip: 0.83,
    dragCd: 0.35,
    frontalArea: 2.2,
    wheelRadius: 0.35,
    seats: 4,
    engines: ['v8', 'supercharged-v8'],
    defaultEngine: 'v8',
    transmissions: ALL_TRANSMISSIONS,
    defaultTransmission: 'manual',
  },
  {
    id: 'meridian-gt',
    name: 'Meridian GT',
    className: 'Grand Tourer',
    tagline: 'All-wheel drive composure for crossing continents at speed.',
    bodyStyle: 'gt',
    color: '#f5c400',
    accent: '#ffdf4a',
    mass: 1590,
    fuelCapacity: 75,
    drivetrain: 'AWD',
    grip: 0.99,
    dragCd: 0.27,
    frontalArea: 2.05,
    wheelRadius: 0.34,
    seats: 4,
    engines: ['v6', 'twin-turbo-v6', 'v8', 'supercharged-v8'],
    defaultEngine: 'v6',
    transmissions: ALL_TRANSMISSIONS,
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
    fuelCapacity: 45,
    drivetrain: 'FWD',
    grip: 0.8,
    dragCd: 0.33,
    frontalArea: 1.9,
    wheelRadius: 0.32,
    seats: 4,
    engines: ['inline-4', 'vtec-i4', 'eco-i4'],
    defaultEngine: 'inline-4',
    transmissions: ALL_TRANSMISSIONS,
    defaultTransmission: 'manual',
  },
  {
    id: 'bmw-m4-csl',
    name: 'BMW M4 CSL',
    className: 'Track Coupe',
    tagline: 'Track-focused, rear-drive and powered by a 550 hp twin-turbo inline-six.',
    bodyStyle: 'coupe',
    color: '#7f8b8f',
    accent: '#d7e0e2',
    mass: 1625,
    fuelCapacity: 59,
    drivetrain: 'RWD',
    grip: 1.02,
    dragCd: 0.34,
    frontalArea: 2.0,
    wheelRadius: 0.34,
    seats: 2,
    engines: ['s58-i6'],
    defaultEngine: 's58-i6',
    transmissions: ALL_TRANSMISSIONS,
    defaultTransmission: 'dsg',
    modelUrl: '/models/bmw_m4csl.glb',
    modelLength: 4.8,
    modelForward: '+X',
    modelCredit: 'BMW M4 CSL by Mpgs Studios · CC BY 4.0',
  },
  {
    id: 'civic-type-r',
    name: 'Honda Civic Type R',
    className: 'Hot Hatch',
    tagline: 'Championship-white track hatch with a 320 hp turbo four and a six-speed manual.',
    bodyStyle: 'hatch',
    color: '#f3f1e6',
    accent: '#d51f2b',
    mass: 1429,
    fuelCapacity: 47,
    drivetrain: 'FWD',
    grip: 0.97,
    dragCd: 0.33,
    frontalArea: 2.13,
    wheelRadius: 0.34,
    seats: 4,
    engines: ['k20c1-i4'],
    defaultEngine: 'k20c1-i4',
    transmissions: ALL_TRANSMISSIONS,
    defaultTransmission: 'manual',
    modelUrl: '/models/2023_honda_civic_type_r.glb',
    modelLength: 4.59,
    modelForward: '+Z',
    modelWheelMode: 'combined',
    modelMerge: true,
    modelCredit: '2023 Honda Civic Type R by Ddiaz Design · CC BY-NC-SA 4.0',
  },
  {
    id: 'perodua-myvi',
    name: 'Perodua Myvi',
    className: 'City Hatch',
    tagline: 'Lightweight Malaysian city car: simple, practical and easy to place in traffic.',
    bodyStyle: 'hatch',
    color: '#b9c3c7',
    accent: '#e7edef',
    mass: 980,
    fuelCapacity: 40,
    drivetrain: 'FWD',
    grip: 0.83,
    dragCd: 0.34,
    frontalArea: 1.95,
    wheelRadius: 0.3,
    seats: 5,
    engines: ['k3-ve-i4'],
    defaultEngine: 'k3-ve-i4',
    transmissions: ALL_TRANSMISSIONS,
    defaultTransmission: 'manual',
    modelUrl: '/models/2005_perodua_myvi.glb',
    modelLength: 3.75,
    modelForward: '+Z',
    modelWheelMode: 'named',
    modelWheelNames: ['wheel', 'wheel_1', 'wheel_2', 'wheel_3'],
    modelCredit: '2005 Perodua Myvi by zairiq-zairiq-123-pixar-cars-bfdi · CC BY 4.0',
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

export function getAspiration(aspirationId) {
  return ASPIRATIONS[aspirationId] ?? ASPIRATIONS.na
}

export function getTransmission(transmissionId) {
  return TRANSMISSIONS[transmissionId] ?? TRANSMISSIONS.manual
}
