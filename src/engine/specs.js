/**
 * Derived performance figures for the car selection screen.
 * These reuse the real simulation so the numbers stay honest.
 */

import { aspirationRatioAtRpm, defaultAspirationForEngine } from '../constants/config.js'
import { VehiclePhysics } from './physics.js'

const MS_TO_KMH = 3.6

export function peakPowerHp(engine, aspiration = defaultAspirationForEngine(engine)) {
  const base = defaultAspirationForEngine(engine)
  const peakKw = Math.max(
    ...engine.torqueCurve.map((point) => {
      const torque = point.torque * aspirationRatioAtRpm(aspiration, base, point.rpm, engine.redline)
      return (torque * point.rpm) / 9549
    }),
  )
  return Math.round(peakKw * 1.34102)
}

export function peakTorqueNm(engine, aspiration = defaultAspirationForEngine(engine)) {
  const base = defaultAspirationForEngine(engine)
  return Math.round(
    Math.max(
      ...engine.torqueCurve.map(
        (point) => point.torque * aspirationRatioAtRpm(aspiration, base, point.rpm, engine.redline),
      ),
    ),
  )
}

function createTestVehicle(car, engine, transmission, aspiration) {
  return new VehiclePhysics({
    car,
    engine,
    transmission: {
      ...transmission,
      type: transmission.type === 'manual' ? 'automatic' : transmission.type,
      shiftUpFraction: transmission.type === 'manual' ? 0.94 : transmission.shiftUpFraction,
    },
    aspiration,
  })
}

export function estimateZeroTo100(car, engine, transmission, aspiration) {
  const vehicle = createTestVehicle(car, engine, transmission, aspiration)
  const target = 100 / MS_TO_KMH
  let time = 0
  const dt = 0.02

  while (vehicle.speed < target && time < 25) {
    vehicle.update(dt, { throttle: 1, brake: 0, steer: 0 })
    time += dt
  }

  return vehicle.speed >= target ? time : null
}

export function estimateTopSpeed(car, engine, transmission, aspiration) {
  const vehicle = createTestVehicle(car, engine, transmission, aspiration)
  const dt = 0.05

  for (let time = 0; time < 70; time += dt) {
    vehicle.update(dt, { throttle: 1, brake: 0, steer: 0 })
  }

  return Math.round(vehicle.speed * MS_TO_KMH)
}

export function performanceSummary(car, engine, transmission, aspiration) {
  return {
    powerHp: peakPowerHp(engine, aspiration),
    torqueNm: peakTorqueNm(engine, aspiration),
    zeroTo100: estimateZeroTo100(car, engine, transmission, aspiration),
    topSpeedKmh: estimateTopSpeed(car, engine, transmission, aspiration),
    gearCount: transmission.gearRatios.length,
  }
}
