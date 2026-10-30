/**
 * Derived performance figures for the car selection screen.
 * These reuse the real simulation so the numbers stay honest.
 */

import { VehiclePhysics } from './physics.js'

const MS_TO_KMH = 3.6

export function peakPowerHp(engine) {
  const peakKw = Math.max(
    ...engine.torqueCurve.map((point) => (point.torque * point.rpm) / 9549),
  )
  return Math.round(peakKw * 1.34102)
}

export function peakTorqueNm(engine) {
  return Math.round(Math.max(...engine.torqueCurve.map((point) => point.torque)))
}

function createTestVehicle(car, engine, transmission) {
  return new VehiclePhysics({
    car,
    engine,
    transmission: {
      ...transmission,
      type: 'automatic',
      shiftUpFraction: 0.94,
      shiftDownFraction: 0.3,
    },
  })
}

export function estimateZeroTo100(car, engine, transmission) {
  const vehicle = createTestVehicle(car, engine, transmission)
  const target = 100 / MS_TO_KMH
  let time = 0
  const dt = 0.02

  while (vehicle.speed < target && time < 25) {
    vehicle.update(dt, { throttle: 1, brake: 0, steer: 0 })
    time += dt
  }

  return vehicle.speed >= target ? time : null
}

export function estimateTopSpeed(car, engine, transmission) {
  const vehicle = createTestVehicle(car, engine, transmission)
  const dt = 0.05

  for (let time = 0; time < 70; time += dt) {
    vehicle.update(dt, { throttle: 1, brake: 0, steer: 0 })
  }

  return Math.round(vehicle.speed * MS_TO_KMH)
}

export function performanceSummary(car, engine, transmission) {
  return {
    powerHp: peakPowerHp(engine),
    torqueNm: peakTorqueNm(engine),
    zeroTo100: estimateZeroTo100(car, engine, transmission),
    topSpeedKmh: estimateTopSpeed(car, engine, transmission),
    gearCount: transmission.gearRatios.length,
  }
}
