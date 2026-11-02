/**
 * Longitudinal + lateral vehicle simulation.
 * Units are SI: metres, seconds, kilograms, newtons, radians.
 */

import { roadCenter, roadWidth } from '../maps/road.js'
import { surfaceSlopeAlong } from '../maps/roadWorld.js'
import {
  DEFAULT_TYRE,
  TYRES,
  aspirationFactorAtRpm,
  defaultAspirationForEngine,
  getAspiration,
  normalizeSuspension,
} from '../constants/config.js'

const ASPIRATION_INDUCTION = {
  na: 'natural',
  turbo: 'turbo',
  'turbo-vtec': 'turbo',
  twin: 'twin-turbo',
  supercharger: 'supercharger',
  vtec: 'vtec',
}

const G = 9.81
const AIR_DENSITY = 1.225
const DRIVETRAIN_EFFICIENCY = 0.88
const MAX_STEP = 0.05
const REVERSE_SPEED_LIMIT = 8.33 // m/s, about 30 km/h
const LANE_OFFSET = 0
const LANE_CENTER = LANE_OFFSET
const ROAD_HALF_WIDTH = 10
// The road centre is used as the baseline lateral position; steering and curvature
// then move the car relative to that centre instead of a fixed offset from a straight line.
const DRIVE_MODES = {
  eco: { throttle: 0.76, shift: 0.79, upLow: 0.19, downLow: 0.12, downHigh: 0.30, cvtRpm: 0.52 },
  normal: { throttle: 1, shift: 1, upLow: 0.23, downLow: 0.16, downHigh: 0.40, cvtRpm: 0.7 },
  sport: { throttle: 1.13, shift: 1.12, upLow: 0.45, downLow: 0.25, downHigh: 0.52, cvtRpm: 0.87 },
}

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
export const lerp = (a, b, t) => a + (b - a) * t

const approach = (current, target, dt, rate) =>
  current + (target - current) * (1 - Math.exp(-rate * dt))

export function torqueAtRpm(engine, rpm) {
  const curve = engine.torqueCurve
  if (rpm <= curve[0].rpm) return curve[0].torque
  const last = curve[curve.length - 1]
  if (rpm >= last.rpm) return last.torque

  for (let i = 1; i < curve.length; i += 1) {
    if (rpm <= curve[i].rpm) {
      const previous = curve[i - 1]
      const next = curve[i]
      const t = (rpm - previous.rpm) / (next.rpm - previous.rpm)
      return lerp(previous.torque, next.torque, t)
    }
  }
  return last.torque
}

export class VehiclePhysics {
  constructor({ car, engine, transmission, aspiration, tyre, suspension }) {
    this.car = car
    this.engine = engine
    this.transmission = transmission
    this.tyreConfig = typeof tyre === 'string'
      ? TYRES[tyre] ?? TYRES[DEFAULT_TYRE]
      : tyre ?? TYRES[DEFAULT_TYRE]
    this.suspension = normalizeSuspension(suspension)
    this.baseGrip = car.grip * (this.tyreConfig.grip ?? 1)
    this.baseAspiration = defaultAspirationForEngine(engine)
    this.aspiration = typeof aspiration === 'string'
      ? getAspiration(aspiration)
      : aspiration ?? this.baseAspiration
    this.gearCount = transmission.gearRatios.length
    this.dragFactor = 0.5 * AIR_DENSITY * car.dragCd * car.frontalArea
    this.rollingResistance = 0.014 * car.mass * G
    this.maxTractionForce = this.baseGrip * car.mass * G
    this.shiftUpRpm = engine.redline * transmission.shiftUpFraction
    this.reset()
  }

  setSuspension(suspension) {
    this.suspension = normalizeSuspension(suspension)
    return this.suspension
  }

  reset() {
    this.speed = 0
    this.lateral = LANE_OFFSET
    this.lateralVelocity = 0
    this.distance = 0
    this.odometer = 0
    this.elapsed = 0
    this.maxSpeed = 0
    this.gear = 1
    this.preselectedGear = this.transmission.kind === 'dual-clutch' ? 2 : null
    this.driveMode = 'normal'
    this.tractionControl = true
    this.gearboxMode = this.transmission.type === 'manual' ? 'M' : 'D'
    this.cvtRatio = this.transmission.gearRatios[0]
    this.boost = 0
    this.tractionLimited = false
    this.rpm = this.engine.idleRpm
    this.throttle = 0
    this.brake = 0
    this.clutch = 0
    this.clutchBite = 1
    this.steer = 0
    this.handbrake = false
    this.offRoad = false
    this.engineBraking = 0
    this.ignition = true
    this.tyreWear = 0
    this.tyreSlip = 0
    this.effectiveGrip = this.baseGrip
    this.fuelCapacity = this.car.fuelCapacity ?? 50
    this.fuel = this.fuelCapacity
    this.fuelUsed = 0
    this.fuelRate = 0
    this.averageConsumption = 0
    this.fuelStarved = false
    this.directionShock = 0
    this.mechanicalShock = 0
    this.impact = 0
    this.limiter = false
    this.shiftCooldown = 0
    this.shiftTimer = 0
    this.shiftTransfer = 1
    this.shiftEvent = null
    this.pendingShiftEvent = null
    this.kickdownArmed = true
    this.sportDownshiftPending = false
  }

  refuel(liters = this.fuelCapacity) {
    this.fuel = Math.min(this.fuelCapacity, Math.max(0, this.fuel + liters))
    this.fuelStarved = this.fuel <= 0.0001
    return this.fuel
  }

  setIgnition(on) {
    const next = Boolean(on)
    if (this.ignition === next) return next
    this.ignition = next
    if (!next) {
      this.throttle = 0
      this.boost = 0
      this.rpm = 0
      this.limiter = false
      this.shiftEvent = null
      this.pendingShiftEvent = null
      this.kickdownArmed = true
    } else {
      this.rpm = this.engine.idleRpm + 420
      this.shiftCooldown = 0.15
    }
    return next
  }

  rpmForSpeed(speed, gear = this.gear) {
    if (gear === 0) return 0
    const ratio = (gear === -1 ? this.transmission.reverseRatio : this.transmission.gearRatios[gear - 1]) *
      this.transmission.finalDrive
    return (Math.abs(speed) / this.car.wheelRadius) * ratio * (60 / (2 * Math.PI))
  }

  selectRange(range) {
    if (!['R', 'N', 'D'].includes(range)) return { ok: false, message: 'Unknown gear range' }
    const target = range === 'R' ? -1 : range === 'N' ? 0 : 1
    if (this.gear === target && (range !== 'D' || this.gear === 1)) {
      return { ok: true, message: range === 'D' && this.transmission.type === 'manual' ? 'First gear' : `${range} selected` }
    }
    if (this.transmission.type === 'manual' && this.clutch < 0.55) {
      return { ok: false, message: 'Press the clutch (C) to change range' }
    }
    if (range === 'D' && this.transmission.type === 'manual' &&
      this.rpmForSpeed(this.speed, 1) > this.engine.redline * 0.8) {
      return { ok: false, message: 'Too fast for first gear' }
    }
    const previousGear = this.gear
    const reversing = range === 'R' && previousGear > 0
    const driving = range === 'D' && previousGear < 0
    const speedBefore = Math.abs(this.speed)
    let shock = 0
    if ((reversing || driving) && speedBefore > 1) {
      shock = clamp(speedBefore / 12, 0, 1)
      this.directionShock = Math.max(this.directionShock, shock)
      this.mechanicalShock = Math.max(this.mechanicalShock, shock)
      this.impact = Math.max(this.impact, Math.min(1, speedBefore / 12))
      this.lateralVelocity = (this.lateralVelocity ?? 0) +
        (this.steer >= 0 ? 1 : -1) * shock * 1.8
    }
    this.gear = target
    if (range === 'D' && this.transmission.type !== 'manual') {
      while (this.gear < this.gearCount &&
        this.rpmForSpeed(this.speed, this.gear) > this.engine.redline * 0.75) this.gear += 1
    }
    this.shiftTimer = 0
    this.shiftCooldown = 0.12
    this.shiftEvent = null
    this.pendingShiftEvent = null
    this.sportDownshiftPending = false
    this.kickdownArmed = true
    this.preselectedGear = this.transmission.kind === 'dual-clutch' && this.gear > 0
      ? Math.min(this.gear + 1, this.gearCount) : null
    return {
      ok: true,
      message: shock > 0.05
        ? `${range} engaged at speed — transmission shock!`
        : range === 'D' && this.transmission.type === 'manual'
          ? 'First gear selected' : `${range} selected`,
    }
  }

  setDriveMode(mode) {
    if (!DRIVE_MODES[mode]) return false
    if (mode === 'sport' && this.driveMode !== 'sport' && this.gearboxMode === 'D' &&
      this.transmission.type !== 'cvt') {
      this.sportDownshiftPending = true
    }
    this.driveMode = mode
    return true
  }

  /** Pick a directly reachable lower ratio without over-revving the engine. */
  bestKickdownGear(sportCruise = false) {
    if (this.speed < 3 || this.gear <= 1) return this.gear
    const currentRpm = this.rpmForSpeed(this.speed)
    const targetRpm = this.engine.redline * 0.68
    let best = this.gear
    const currentScore = sportCruise
      ? -Math.abs(currentRpm - targetRpm)
      : torqueAtRpm(this.engine, currentRpm) * this.transmission.gearRatios[this.gear - 1]
    let bestScore = currentScore

    for (let gear = this.gear - 1; gear >= 1; gear -= 1) {
      const rpm = this.rpmForSpeed(this.speed, gear)
      // Leave headroom so kickdown does not immediately require an upshift.
      if (rpm > this.engine.redline * (this.transmission.kickdownMaxRpm ?? 0.87) ||
        rpm < this.engine.idleRpm) continue
      const score = sportCruise
        ? -Math.abs(rpm - targetRpm)
        : torqueAtRpm(this.engine, rpm) * this.transmission.gearRatios[gear - 1]
      if (score > bestScore) {
        best = gear
        bestScore = score
      }
    }
    return bestScore > currentScore +
      (sportCruise ? 250 : currentScore * (this.transmission.kickdownImprovement ?? 0.08))
      ? best : this.gear
  }

  beginShift(targetGear, direction, external = false) {
    const skipped = Math.max(0, Math.abs(targetGear - this.gear) - 1)
    const duration = (this.transmission.shiftDuration ?? 0.24) +
      skipped * (this.transmission.kickdownSkipDelay ?? 0) +
      (this.transmission.kind === 'dual-clutch' && targetGear !== this.preselectedGear
        ? this.transmission.unpreparedShiftDelay ?? 0 : 0)
    this.gear = targetGear
    this.shiftTimer = duration
    this.shiftCooldown = duration + (this.transmission.kind === 'torque-converter' ? 0.12 : 0.06)
    this.shiftTransfer = (this.transmission.shiftTorqueTransfer ?? 0.3) *
      (skipped > 0 ? 0.9 : 1)
    this.shiftEvent = direction
    if (external) this.pendingShiftEvent = direction
    if (this.transmission.kind === 'dual-clutch') {
      this.preselectedGear = clamp(this.gear + (direction === 'up' ? 1 : -1), 1, this.gearCount)
    }
  }

  setTractionControl(enabled) {
    this.tractionControl = Boolean(enabled)
  }

  setGearboxMode(mode) {
    if (this.transmission.type === 'manual' || !['D', 'M'].includes(mode)) return false
    this.gearboxMode = mode
    if (mode === 'M' && this.transmission.type === 'cvt' && this.gear > 0) {
      this.gear = this.closestCvtGear()
    }
    this.sportDownshiftPending = mode === 'D' && this.driveMode === 'sport' &&
      this.transmission.type !== 'cvt'
    this.shiftCooldown = 0.15
    return true
  }

  closestCvtGear() {
    const ratios = this.transmission.gearRatios
    return ratios.reduce((best, ratio, index) =>
      Math.abs(ratio - this.cvtRatio) < Math.abs(ratios[best - 1] - this.cvtRatio) ? index + 1 : best, 1)
  }

  shiftUp() {
    if (this.gearboxMode !== 'M') {
      return { ok: false, message: 'Select M mode to shift manually' }
    }
    if (this.transmission.type === 'manual' && this.clutch < 0.55) {
      return { ok: false, message: 'Press the clutch (C) to shift' }
    }
    if (this.gear <= 0) {
      return this.transmission.type === 'manual'
        ? this.selectRange(this.gear === -1 ? 'N' : 'D')
        : { ok: false, message: 'Select drive before shifting' }
    }
    if (this.gear >= this.gearCount) {
      return { ok: false, message: 'Already in top gear' }
    }
    if (this.shiftTimer > 0) return { ok: false, message: 'Shift in progress' }
    this.beginShift(this.gear + 1, 'up', true)
    return { ok: true, message: `Gear ${this.gear}` }
  }

  shiftDown() {
    if (this.gearboxMode !== 'M') {
      return { ok: false, message: 'Select M mode to shift manually' }
    }
    if (this.transmission.type === 'manual' && this.clutch < 0.55) {
      return { ok: false, message: 'Press the clutch (C) to shift' }
    }
    if (this.gear <= 1) {
      return this.transmission.type === 'manual' && this.gear >= 0
        ? this.selectRange(this.gear === 1 ? 'N' : 'R')
        : { ok: false, message: this.gear === -1 ? 'Already in reverse' : 'Already in first gear' }
    }
    if (this.shiftTimer > 0) return { ok: false, message: 'Shift in progress' }
    const targetGear = this.gear - 1
    const resultingRpm = this.rpmForSpeed(Math.max(this.speed, 4), targetGear)
    if (resultingRpm > this.engine.maxRpm) {
      return { ok: false, message: 'Over-rev — too fast for that gear' }
    }
    this.beginShift(targetGear, 'down', true)
    return { ok: true, message: `Gear ${this.gear}` }
  }

  update(dt, controls = {}) {
    const step = clamp(dt, 0.001, MAX_STEP)
    const engineOn = this.ignition !== false && !this.fuelStarved
    const throttleTarget = engineOn ? clamp(controls.throttle ?? 0, 0, 1) : 0
    const brakeTarget = clamp(controls.brake ?? 0, 0, 1)
    const clutchTarget = this.transmission.type === 'manual' ? clamp(controls.clutch ?? 0, 0, 1) : 0
    const steerTarget = clamp(controls.steer ?? 0, -1, 1)
    const handbrake = Boolean(controls.handbrake)
    this.handbrake = handbrake

    const mode = DRIVE_MODES[this.driveMode]
    const fullPedal = clamp((throttleTarget - 0.75) / 0.2, 0, 1)
    // Eco softens ordinary pedal travel, but the final detent requests full
    // engine output (kickdown), as in a real drive-mode selector.
    const torqueScale = lerp(mode.throttle, Math.max(mode.throttle, 1), fullPedal)
    const response = this.driveMode === 'sport' ? 11 : this.driveMode === 'eco' ? 4 : 7
    this.throttle = approach(this.throttle, throttleTarget, step, throttleTarget > this.throttle ? response : 11)
    this.brake = approach(this.brake, brakeTarget, step, brakeTarget > this.brake ? 12 : 16)
    this.clutch = approach(this.clutch, clutchTarget, step, 20)
    this.steer = approach(this.steer, steerTarget, step,
      Math.abs(steerTarget) < Math.abs(this.steer) ? 17 : 12)
    this.shiftCooldown = Math.max(0, this.shiftCooldown - step)
    this.shiftTimer = Math.max(0, this.shiftTimer - step)
    this.shiftEvent = this.pendingShiftEvent
    this.pendingShiftEvent = null
    if (this.transmission.kind === 'dual-clutch' && this.shiftTimer <= 0 && this.gear > 0) {
      this.preselectedGear = clamp(this.gear +
        (throttleTarget > 0.3 && brakeTarget < 0.2 ? 1 : -1), 1, this.gearCount)
    }
    if (throttleTarget < (this.transmission.kickdownThreshold ?? 0.85) - 0.25) {
      this.kickdownArmed = true
    }

    const induction = ASPIRATION_INDUCTION[this.aspiration.type] ?? this.engine.induction
    const boostTarget = induction === 'turbo' || induction === 'twin-turbo'
      ? clamp((this.rpm - 1100) / 1900, 0, 1) * this.throttle
      : induction === 'supercharger' ? this.throttle : 0
    this.boost = approach(this.boost, boostTarget, step,
      induction === 'twin-turbo' ? 5.5 : induction === 'turbo' ? 2.7 : 18)
    const boostFactor = induction === 'turbo' ? 0.65 + 0.35 * this.boost
      : induction === 'twin-turbo' ? 0.72 + 0.28 * this.boost : 1

    // --- Engine speed ------------------------------------------------------
    if (this.transmission.type === 'cvt' && this.gearboxMode === 'D' && this.gear > 0) {
      const ratios = this.transmission.gearRatios
      // Eco changes part-pedal response, not the driver's wide-open-throttle
      // request. Otherwise Sport -> Eco can make a CVT dump thousands of RPM
      // while the accelerator is still on the floor.
      const cvtFraction = lerp(mode.cvtRpm, Math.max(mode.cvtRpm, 0.87), fullPedal)
      const targetRpm = lerp(this.engine.idleRpm + 800, this.engine.redline * cvtFraction, this.throttle)
      const idealRatio = targetRpm * this.car.wheelRadius * (2 * Math.PI / 60) /
        (Math.max(Math.abs(this.speed), 2) * this.transmission.finalDrive)
      this.cvtRatio = approach(this.cvtRatio, clamp(idealRatio, ratios[ratios.length - 1], ratios[0]),
        step, this.transmission.ratioResponse ?? 2.8)
      this.gear = this.closestCvtGear()
    } else {
      this.cvtRatio = this.gear === -1 ? this.transmission.reverseRatio
        : this.gear === 0 ? 0 : this.transmission.gearRatios[this.gear - 1]
    }
    const activeRatio = this.cvtRatio * this.transmission.finalDrive
    const wheelRpm = (Math.abs(this.speed) / this.car.wheelRadius) * activeRatio * (60 / (2 * Math.PI))
    const launchCeiling = this.transmission.kind === 'torque-converter'
      ? Math.min(this.engine.redline * 0.36, 2800)
      : this.transmission.type === 'cvt' ? this.engine.redline * mode.cvtRpm
        : this.engine.redline * 0.5
    const launchRpm = this.engine.idleRpm + this.throttle * (launchCeiling - this.engine.idleRpm)
    const clutchBlend = clamp(Math.abs(this.speed) /
      (this.transmission.kind === 'torque-converter' ? 12 : 7), 0, 1)
    let rpmTarget = lerp(launchRpm, Math.max(wheelRpm, this.engine.idleRpm), clutchBlend)
    if (this.transmission.type === 'manual') {
      const freeRpm = this.engine.idleRpm + this.throttle * (this.engine.redline * 0.9 - this.engine.idleRpm)
      rpmTarget = lerp(rpmTarget, freeRpm, this.clutch)
    }
    if (this.gear === 0) rpmTarget = this.engine.idleRpm +
      this.throttle * (this.engine.redline * 0.9 - this.engine.idleRpm)
    if (this.transmission.type !== 'manual' || this.clutch < 0.5) {
      rpmTarget = Math.max(rpmTarget, wheelRpm)
    }
    rpmTarget = clamp(rpmTarget, this.engine.idleRpm, this.engine.maxRpm)
    if (!engineOn) rpmTarget = 0
    const rpmResponse = this.shiftTimer > 0
      ? (this.transmission.shiftRpmRate ?? 16)
      : this.throttle < 0.08 && this.gear !== 0 &&
        (this.transmission.type !== 'manual' || this.clutch < 0.5)
        ? 19
        : 9
    this.rpm = approach(this.rpm, rpmTarget, step, rpmResponse)
    if (engineOn) {
      this.rpm = clamp(this.rpm, this.engine.idleRpm, this.engine.maxRpm)
    } else {
      this.rpm = 0
      this.boost = 0
      this.limiter = false
    }

    this.limiter = this.rpm >= this.engine.redline - 40

    // --- Automatic shifting ------------------------------------------------
    if (engineOn && this.gear > 0 && this.gearboxMode === 'D' && this.transmission.type !== 'cvt' && this.shiftCooldown <= 0) {
      // Shift points depend on pedal demand: gentle cruising short-shifts, while
      // wide-open throttle holds a gear near its performance shift point.
      const demand = Math.max(this.throttle, throttleTarget) ** 2.1
      // At full pedal, all drive modes hold the same performance shift point.
      // The early Eco upshift remains for gentle driving only.
      const shiftFactor = lerp(mode.shift, Math.max(mode.shift, DRIVE_MODES.sport.shift), fullPedal)
      const highShiftRpm = Math.min(this.engine.redline * 0.98, this.shiftUpRpm * shiftFactor)
      const upRpm = lerp(this.engine.redline *
        (mode.upLow + (this.transmission.shiftLowBias ?? 0)), highShiftRpm, demand)
      const downRpm = this.engine.redline * lerp(mode.downLow, mode.downHigh, demand)
      const nextRpm = this.gear < this.gearCount
        ? this.rpmForSpeed(this.speed, this.gear + 1) : 0
      const nextRatio = this.transmission.gearRatios[this.gear] * this.transmission.finalDrive
      const nextDriveForce = this.gear < this.gearCount
        ? torqueAtRpm(this.engine, nextRpm) * clamp(this.throttle * torqueScale, 0, 1) *
          boostFactor *
          aspirationFactorAtRpm(this.aspiration, nextRpm, this.engine.redline) /
          aspirationFactorAtRpm(this.baseAspiration, nextRpm, this.engine.redline) *
          nextRatio * DRIVETRAIN_EFFICIENCY / this.car.wheelRadius : 0
      const roadLoad = this.dragFactor * this.speed * this.speed + this.rollingResistance
      const nextGearViable = nextRpm >= Math.max(this.engine.idleRpm * 1.35, downRpm * 1.1) &&
        nextDriveForce >= roadLoad * 0.97
      const overdriveReady = this.gear === this.gearCount - 1 &&
        throttleTarget > 0.85 && this.rpm >= this.engine.redline * 0.9 &&
        nextDriveForce > roadLoad * 1.02
      const wantsKickdown = throttleTarget >=
        (this.transmission.kickdownThreshold ?? 0.85) && this.kickdownArmed
      const hasRealThrottle = throttleTarget > 0.08 || this.throttle > 0.08
      const upshiftHysteresis = 170 + (this.transmission.kind === 'dual-clutch' ? 80 : 0)
      // The hysteresis can push the trigger above the redline (and in Sport
      // beyond the RPM the car can actually reach in gear), which leaves the
      // car bouncing off the limiter without shifting. Cap it just below the
      // limiter so every car/gearbox upshifts at the redline.
      const upshiftRpm = Math.min(upRpm + upshiftHysteresis, this.engine.redline - 60)
      const atRevLimit = this.rpm >= this.engine.redline - 50
      if (wantsKickdown || this.sportDownshiftPending) {
        const targetGear = this.bestKickdownGear(!wantsKickdown)
        if (wantsKickdown) this.kickdownArmed = false
        this.sportDownshiftPending = false
        if (targetGear < this.gear) {
          this.beginShift(targetGear, 'down')
        }
      }
      if (!this.shiftEvent && this.gear < this.gearCount &&
        hasRealThrottle && nextGearViable &&
        (this.rpm > upshiftRpm || atRevLimit || overdriveReady)) {
        this.beginShift(this.gear + 1, 'up')
      } else if (!this.shiftEvent &&
        (this.rpm < downRpm * 0.94 ||
          (this.brake > 0.3 && this.rpm < this.engine.redline *
            (this.driveMode === 'sport' ? 0.48 : 0.34))) &&
        this.gear > 1 &&
        this.speed > 1.5 &&
        this.throttle < 0.72 &&
        this.rpmForSpeed(this.speed, this.gear - 1) < this.engine.redline * 0.86 &&
        (this.gear > 2 || this.speed < 5)
      ) {
        this.beginShift(this.gear - 1, 'down')
      }
    }

    // Automated boxes protect M mode from lugging or trying to launch in a
    // high gear. They never upshift in M; the driver keeps that control.
    if (engineOn && this.gearboxMode === 'M' && this.transmission.type !== 'manual' &&
      this.shiftCooldown <= 0 && this.gear > 1 &&
      this.rpmForSpeed(this.speed) < this.engine.idleRpm * 1.12) {
      this.beginShift(this.gear - 1, 'down')
    }

    if (this.shiftEvent && this.transmission.type !== 'cvt') {
      this.rpm = approach(this.rpm,
        clamp(this.rpmForSpeed(this.speed), this.engine.idleRpm, this.engine.maxRpm),
        step, this.transmission.shiftRpmRate ?? 16)
    }
    this.limiter = this.rpm >= this.engine.redline - 40

    // --- Forces ------------------------------------------------------------
    const gearRatio = this.gear === -1 ? -this.transmission.reverseRatio * this.transmission.finalDrive
      : this.gear === 0 ? 0
        : this.transmission.type === 'cvt' && this.gearboxMode === 'D'
          ? activeRatio : this.transmission.gearRatios[this.gear - 1] * this.transmission.finalDrive
    let engineTorque = torqueAtRpm(this.engine, this.rpm) *
      clamp(this.throttle * torqueScale, 0, 1) * boostFactor
    // Apply the selected aspiration relative to the engine's factory tune. At
    // the factory setting this ratio is exactly 1, so existing engines keep
    // their original performance; alternative tunes add or remove boost/cam.
    engineTorque *= aspirationFactorAtRpm(this.aspiration, this.rpm, this.engine.redline) /
      aspirationFactorAtRpm(this.baseAspiration, this.rpm, this.engine.redline)
    if (this.gear === -1) engineTorque *= 0.55
    if (this.limiter) engineTorque *= 0.12
    if (this.shiftTimer > 0) engineTorque *= this.shiftTransfer
    let driveForce = (engineTorque * gearRatio * DRIVETRAIN_EFFICIENCY) / this.car.wheelRadius
    const clutchBite = this.transmission.type === 'manual'
      ? clamp((0.9 - this.clutch) / 0.9, 0, 1)
      : 1
    if (this.transmission.type === 'manual') driveForce *= clutchBite
    this.clutchBite = clutchBite
    if (engineOn && this.transmission.type !== 'manual' && this.gear !== 0 &&
      Math.abs(this.speed) < 3 && this.brake < 0.15 && this.throttle < 0.05) {
      driveForce += Math.sign(this.gear) * this.car.mass *
        (this.transmission.creepAcceleration ?? 0) * (1 - Math.abs(this.speed) / 3)
    }
    this.effectiveGrip = this.baseGrip * (1 - this.tyreWear * 0.4)
    const availableGrip = this.maxTractionForce * (1 - this.tyreWear * 0.4) *
      (this.offRoad ? 0.48 : 1)
    this.tractionLimited = Math.abs(driveForce) > availableGrip
    if (this.tractionControl) driveForce = clamp(driveForce, -availableGrip, availableGrip)
    else if (this.tractionLimited) driveForce = Math.sign(driveForce) * availableGrip * 0.82

    let resistance = this.dragFactor * this.speed * this.speed + this.rollingResistance
    if (this.offRoad) resistance += 620 + Math.abs(this.speed) * 26

    // Engine braking / overrun. A closed throttle turns the engine into a
    // compressor: the retarding torque scales with displacement, rpm and the
    // selected gear ratio, so low gears slow the car much harder than top gear.
    const closedThrottle = 1 - clamp(this.throttle / 0.14, 0, 1)
    const rpmLoad = clamp(
      (this.rpm - this.engine.idleRpm) /
      Math.max(1, this.engine.redline - this.engine.idleRpm),
      0, 1,
    )
    const displacement = this.engine.displacement ?? 2
    const engineBrakeTorque = engineOn
      ? displacement * (12 + 32 * rpmLoad) * closedThrottle
      : 0
    const clutchFactor = this.transmission.type === 'manual' ? 1 - this.clutch : 1
    const shiftFactor = this.shiftTimer > 0
      ? (this.transmission.shiftTorqueTransfer ?? 0.3) : 1
    const engineBrakeForce = this.gear !== 0 && Math.abs(this.speed) > 1.2
      ? engineBrakeTorque * Math.abs(gearRatio) * DRIVETRAIN_EFFICIENCY /
        this.car.wheelRadius * clutchFactor * shiftFactor
      : 0
    const engineBrakeAcceleration = engineBrakeForce / this.car.mass
    this.engineBraking = engineBrakeAcceleration

    const brakingForce = this.brake * 9.6 + engineBrakeAcceleration
    let slopeAcceleration = 0
    if (typeof this.x === 'number' && typeof this.z === 'number') {
      const slope = surfaceSlopeAlong(this.x, this.z, this.heading)
      slopeAcceleration = G * slope / Math.sqrt(1 + slope * slope)
    }
    let stoppingAcceleration = resistance / this.car.mass + brakingForce +
      slopeAcceleration + (handbrake ? 5.8 : 0)
    if (this.directionShock > 0) {
      stoppingAcceleration += 14 + this.directionShock * 18
      this.directionShock = Math.max(0, this.directionShock - step * 2.4)
    }
    this.mechanicalShock = Math.max(0, this.mechanicalShock - step * 2.6)

    const slipAmount = Math.abs(this.lateralVelocity || 0) +
      (this.tractionLimited ? 2.5 : 0) +
      (handbrake ? 5 : 0) +
      this.brake * Math.abs(this.speed) * 0.01
    this.tyreSlip = clamp(slipAmount / 6, 0, 1)
    this.tyreWear = clamp(
      this.tyreWear +
      (0.000004 * Math.abs(this.speed) + 0.00008 * slipAmount) *
      step * (this.tyreConfig.wearRate ?? 1),
      0,
      1,
    )

    this.integrateMotion(step, driveForce, stoppingAcceleration, handbrake)

    // Fuel flow is estimated from engine displacement, RPM and load. It is
    // deliberately generous enough that a tank lasts a normal play session,
    // while hard driving and high RPM still consume noticeably more.
    const forced = induction === 'turbo' || induction === 'twin-turbo' ||
      induction === 'supercharger'
    const fuelDisplacement = this.engine.displacement ?? 2
    const fuelLoad = clamp(this.throttle *
      (this.boost > 0 ? 0.8 + 0.2 * this.boost : 1), 0, 1)
    const revFactor = clamp(this.rpm / this.engine.redline, 0, 1)
    const idleFlow = 0.35 + fuelDisplacement * 0.26
    const fullFlow = fuelDisplacement * 28 + (forced ? 10 : 0)
    this.fuelRate = engineOn
      ? idleFlow + (fullFlow - idleFlow) * fuelLoad * (0.35 + 0.65 * revFactor)
      : 0
    const liters = this.fuelRate * step / 3600
    this.fuel = Math.max(0, this.fuel - liters)
    this.fuelUsed += liters
    const km = this.odometer / 1000
    this.averageConsumption = km > 0.05 ? (this.fuelUsed / km) * 100 : 0
    this.fuelStarved = this.fuel <= 0.0001

    return this.snapshot()
  }

  /**
   * Apply the resolved longitudinal forces and move the car relative to the
   * route. Free-roam driving overrides this with world-space steering.
   */
  integrateMotion(step, driveForce, stoppingAcceleration) {
    const roadHalfWidth = Math.min(roadWidth(this.distance, 0) * 0.5, ROAD_HALF_WIDTH)
    const roadLimit = roadHalfWidth * 0.72
    const shoulderLimit = roadHalfWidth * 0.9

    if (Math.abs(this.lateral) > roadLimit + 0.5) {
      this.speed *= 0.985
      this.lateralVelocity *= 0.65
    }

    const throttleLift = this.gear === 0 && this.throttle < 0.08 ? 0.7 : 0

    if (this.gear === 0) {
      const coastSpeed = Math.max(0, Math.abs(this.speed) - stoppingAcceleration * step)
      this.speed = coastSpeed === 0 ? 0 : Math.sign(this.speed) * coastSpeed
    } else if (this.gear === -1) {
      if (this.speed > 0) {
        this.speed = Math.max(0, this.speed - (stoppingAcceleration + 18) * step)
      } else {
        const acceleration = driveForce / this.car.mass + stoppingAcceleration
        this.speed = Math.max(-REVERSE_SPEED_LIMIT, Math.min(0, this.speed + acceleration * step))
      }
    } else {
      if (this.speed < 0) {
        this.speed = Math.min(0, this.speed + (stoppingAcceleration + 18) * step)
      } else {
        const acceleration = driveForce / this.car.mass - stoppingAcceleration - throttleLift
        this.speed = Math.max(0, this.speed + acceleration * step)
      }
    }

    this.distance += this.speed * step
    this.odometer += Math.abs(this.speed) * step
    this.elapsed += step
    this.maxSpeed = Math.max(this.maxSpeed, Math.abs(this.speed))

    // --- Lateral movement --------------------------------------------------
    const steerAuthority = clamp(Math.abs(this.speed) / 14, 0, 1)
    const curvature = (roadCenter(this.distance + 12, 0) - roadCenter(this.distance - 12, 0)) / 24
    const curvatureAssist = clamp(curvature * 7 * (Math.abs(this.speed) + 1.5), -0.8, 0.8)
    const forwardSign = this.speed === 0 ? 1 : Math.sign(this.speed)
    const laneDeviation = this.steer * 2.8 * steerAuthority * forwardSign + curvatureAssist
    const targetLateral = LANE_CENTER + laneDeviation
    this.lateralVelocity = approach(this.lateralVelocity, targetLateral - this.lateral, step, 5.6)
    this.lateral += this.lateralVelocity * step

    if (Math.abs(this.lateral - LANE_CENTER) > shoulderLimit) {
      this.lateral = LANE_CENTER + Math.sign(this.lateral - LANE_CENTER) * shoulderLimit
      this.lateralVelocity *= -0.2
    }
    this.offRoad = Math.abs(this.lateral - LANE_CENTER) > roadLimit
  }

  snapshot() {
    const rpmFraction = this.rpm / this.engine.maxRpm
    return {
      speed: this.speed,
      speedKmh: Math.abs(this.speed) * 3.6,
      rpm: Math.round(this.rpm),
      rpmFraction,
      redlineFraction: this.engine.redline / this.engine.maxRpm,
      limiter: this.limiter,
      gear: this.gear,
      gearCount: this.gearCount,
      gearRatio: this.gear === -1 ? -this.transmission.reverseRatio * this.transmission.finalDrive
        : this.gear === 0 ? 0
          : (this.transmission.type === 'cvt' && this.gearboxMode === 'D'
            ? this.cvtRatio : this.transmission.gearRatios[this.gear - 1]) * this.transmission.finalDrive,
      gearboxMode: this.gearboxMode,
      driveMode: this.driveMode,
      tractionControl: this.tractionControl,
      tractionLimited: this.tractionLimited,
      boost: this.boost,
      distance: this.distance,
      distanceKm: this.odometer / 1000,
      elapsed: this.elapsed,
      maxSpeedKmh: this.maxSpeed * 3.6,
      throttle: this.throttle,
      brake: this.brake,
      clutch: this.clutch,
      clutchBite: this.clutchBite,
      steer: this.steer,
      lateral: this.lateral,
      lateralVelocity: this.lateralVelocity,
      offRoad: this.offRoad,
      handbrake: this.handbrake,
      tyreCompound: this.tyreConfig.id,
      tyreName: this.tyreConfig.name,
      tyreWear: this.tyreWear,
      tyreGrip: this.effectiveGrip,
      tyreSlip: this.tyreSlip,
      fuel: this.fuel,
      fuelCapacity: this.fuelCapacity,
      fuelFraction: this.fuelCapacity > 0 ? this.fuel / this.fuelCapacity : 0,
      fuelRate: this.fuelRate,
      fuelConsumption: this.averageConsumption,
      fuelStarved: this.fuelStarved,
      fuelRangeKm: this.averageConsumption > 0.1
        ? (this.fuel / this.averageConsumption) * 100 : null,
      fuelUsed: this.fuelUsed,
      engineBraking: this.engineBraking,
      mechanicalShock: this.mechanicalShock,
      ignition: this.ignition !== false,
      shiftEvent: this.shiftEvent,
      shiftActive: this.shiftTimer > 0,
      transmissionType: this.transmission.type,
      aspiration: this.aspiration.id,
      aspirationBadge: this.aspiration.badge,
      baseAspiration: this.baseAspiration.id,
    }
  }
}
