/**
 * Longitudinal + lateral vehicle simulation.
 * Units are SI: metres, seconds, kilograms, newtons, radians.
 */

const G = 9.81
const AIR_DENSITY = 1.225
const DRIVETRAIN_EFFICIENCY = 0.88
const MAX_STEP = 0.05
const ROAD_EDGE = 5.05
const SHOULDER_EDGE = 8.2
// The right-hand lane centre sits this far from the road's painted centre line.
const LANE_OFFSET = 1.9
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
  constructor({ car, engine, transmission }) {
    this.car = car
    this.engine = engine
    this.transmission = transmission
    this.gearCount = transmission.gearRatios.length
    this.dragFactor = 0.5 * AIR_DENSITY * car.dragCd * car.frontalArea
    this.rollingResistance = 0.014 * car.mass * G
    this.maxTractionForce = car.grip * car.mass * G
    this.shiftUpRpm = engine.redline * transmission.shiftUpFraction
    this.reset()
  }

  reset() {
    this.speed = 0
    this.lateral = LANE_OFFSET
    this.lateralVelocity = 0
    this.distance = 0
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
    this.steer = 0
    this.offRoad = false
    this.limiter = false
    this.shiftCooldown = 0
    this.shiftTimer = 0
    this.shiftTransfer = 1
    this.shiftEvent = null
    this.pendingShiftEvent = null
    this.kickdownArmed = true
    this.sportDownshiftPending = false
  }

  rpmForSpeed(speed, gear = this.gear) {
    const ratio = this.transmission.gearRatios[gear - 1] * this.transmission.finalDrive
    return (Math.abs(speed) / this.car.wheelRadius) * ratio * (60 / (2 * Math.PI))
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
    if (mode === 'M' && this.transmission.type === 'cvt') {
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
      return { ok: false, message: 'Already in first gear' }
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
    const throttleTarget = clamp(controls.throttle ?? 0, 0, 1)
    const brakeTarget = clamp(controls.brake ?? 0, 0, 1)
    const clutchTarget = this.transmission.type === 'manual' ? clamp(controls.clutch ?? 0, 0, 1) : 0
    const steerTarget = clamp(controls.steer ?? 0, -1, 1)
    const handbrake = Boolean(controls.handbrake)

    const mode = DRIVE_MODES[this.driveMode]
    const response = this.driveMode === 'sport' ? 11 : this.driveMode === 'eco' ? 4 : 7
    this.throttle = approach(this.throttle, throttleTarget, step, throttleTarget > this.throttle ? response : 11)
    this.brake = approach(this.brake, brakeTarget, step, brakeTarget > this.brake ? 12 : 16)
    this.clutch = approach(this.clutch, clutchTarget, step, 20)
    this.steer = approach(this.steer, steerTarget, step, 9)
    this.shiftCooldown = Math.max(0, this.shiftCooldown - step)
    this.shiftTimer = Math.max(0, this.shiftTimer - step)
    this.shiftEvent = this.pendingShiftEvent
    this.pendingShiftEvent = null
    if (this.transmission.kind === 'dual-clutch' && this.shiftTimer <= 0) {
      this.preselectedGear = clamp(this.gear +
        (throttleTarget > 0.3 && brakeTarget < 0.2 ? 1 : -1), 1, this.gearCount)
    }
    if (throttleTarget < (this.transmission.kickdownThreshold ?? 0.85) - 0.25) {
      this.kickdownArmed = true
    }

    const induction = this.engine.induction
    const boostTarget = induction === 'turbo' || induction === 'twin-turbo'
      ? clamp((this.rpm - 1100) / 1900, 0, 1) * this.throttle
      : induction === 'supercharger' ? this.throttle : 0
    this.boost = approach(this.boost, boostTarget, step,
      induction === 'twin-turbo' ? 5.5 : induction === 'turbo' ? 2.7 : 18)

    // --- Engine speed ------------------------------------------------------
    if (this.transmission.type === 'cvt' && this.gearboxMode === 'D') {
      const ratios = this.transmission.gearRatios
      const targetRpm = lerp(this.engine.idleRpm + 800, this.engine.redline * mode.cvtRpm, this.throttle)
      const idealRatio = targetRpm * this.car.wheelRadius * (2 * Math.PI / 60) /
        (Math.max(this.speed, 2) * this.transmission.finalDrive)
      this.cvtRatio = approach(this.cvtRatio, clamp(idealRatio, ratios[ratios.length - 1], ratios[0]),
        step, this.transmission.ratioResponse ?? 2.8)
      this.gear = this.closestCvtGear()
    } else {
      this.cvtRatio = this.transmission.gearRatios[this.gear - 1]
    }
    const activeRatio = this.cvtRatio * this.transmission.finalDrive
    const wheelRpm = (this.speed / this.car.wheelRadius) * activeRatio * (60 / (2 * Math.PI))
    const launchCeiling = this.transmission.kind === 'torque-converter'
      ? Math.min(this.engine.redline * 0.36, 2800)
      : this.transmission.type === 'cvt' ? this.engine.redline * mode.cvtRpm
        : this.engine.redline * 0.5
    const launchRpm = this.engine.idleRpm + this.throttle * (launchCeiling - this.engine.idleRpm)
    const clutchBlend = clamp(this.speed /
      (this.transmission.kind === 'torque-converter' ? 12 : 7), 0, 1)
    let rpmTarget = lerp(launchRpm, Math.max(wheelRpm, this.engine.idleRpm), clutchBlend)
    if (this.transmission.type === 'manual') {
      const freeRpm = this.engine.idleRpm + this.throttle * (this.engine.redline * 0.9 - this.engine.idleRpm)
      rpmTarget = lerp(rpmTarget, freeRpm, this.clutch)
    }
    if (this.transmission.type !== 'manual' || this.clutch < 0.5) {
      rpmTarget = Math.max(rpmTarget, wheelRpm)
    }
    rpmTarget = clamp(rpmTarget, this.engine.idleRpm, this.engine.maxRpm)
    this.rpm = approach(this.rpm, rpmTarget, step,
      this.shiftTimer > 0 ? (this.transmission.shiftRpmRate ?? 16) : 9)
    this.rpm = clamp(this.rpm, this.engine.idleRpm, this.engine.maxRpm)

    this.limiter = this.rpm >= this.engine.redline - 40

    // --- Automatic shifting ------------------------------------------------
    if (this.gearboxMode === 'D' && this.transmission.type !== 'cvt' && this.shiftCooldown <= 0) {
      // Shift points depend on pedal demand: gentle cruising short-shifts, while
      // wide-open throttle holds a gear near its performance shift point.
      const demand = Math.max(this.throttle, throttleTarget) ** 2.1
      const highShiftRpm = Math.min(this.engine.redline * 0.98, this.shiftUpRpm * mode.shift)
      const upRpm = lerp(this.engine.redline *
        (mode.upLow + (this.transmission.shiftLowBias ?? 0)), highShiftRpm, demand)
      const downRpm = this.engine.redline * lerp(mode.downLow, mode.downHigh, demand)
      const nextRpm = this.gear < this.gearCount
        ? this.rpmForSpeed(this.speed, this.gear + 1) : 0
      const nextRatio = this.transmission.gearRatios[this.gear] * this.transmission.finalDrive
      const nextDriveForce = this.gear < this.gearCount
        ? torqueAtRpm(this.engine, nextRpm) * this.throttle * mode.throttle *
          nextRatio * DRIVETRAIN_EFFICIENCY / this.car.wheelRadius : 0
      const roadLoad = this.dragFactor * this.speed * this.speed + this.rollingResistance
      const nextGearViable = nextRpm >= Math.max(this.engine.idleRpm * 1.35, downRpm * 1.1) &&
        nextDriveForce >= roadLoad * 0.97
      const wantsKickdown = throttleTarget >=
        (this.transmission.kickdownThreshold ?? 0.85) && this.kickdownArmed
      if (wantsKickdown || this.sportDownshiftPending) {
        const targetGear = this.bestKickdownGear(!wantsKickdown)
        if (wantsKickdown) this.kickdownArmed = false
        this.sportDownshiftPending = false
        if (targetGear < this.gear) {
          this.beginShift(targetGear, 'down')
        }
      }
      if (!this.shiftEvent && this.rpm > upRpm && this.gear < this.gearCount &&
        this.throttle > 0.1 && nextGearViable) {
        this.beginShift(this.gear + 1, 'up')
      } else if (!this.shiftEvent &&
        (this.rpm < downRpm ||
          (this.brake > 0.3 && this.rpm < this.engine.redline *
            (this.driveMode === 'sport' ? 0.5 : 0.34))) &&
        this.gear > 1 &&
        this.speed > 1.5 &&
        this.throttle < 0.85 &&
        this.rpmForSpeed(this.speed, this.gear - 1) < this.engine.redline * 0.86 &&
        (this.gear > 2 || this.speed < 5)
      ) {
        this.beginShift(this.gear - 1, 'down')
      }
    }

    // Automated boxes protect M mode from lugging or trying to launch in a
    // high gear. They never upshift in M; the driver keeps that control.
    if (this.gearboxMode === 'M' && this.transmission.type !== 'manual' &&
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
    const gearRatio = this.transmission.type === 'cvt' && this.gearboxMode === 'D'
      ? activeRatio : this.transmission.gearRatios[this.gear - 1] * this.transmission.finalDrive
    const boostFactor = induction === 'turbo' ? 0.65 + 0.35 * this.boost
      : induction === 'twin-turbo' ? 0.72 + 0.28 * this.boost : 1
    let engineTorque = torqueAtRpm(this.engine, this.rpm) *
      clamp(this.throttle * mode.throttle, 0, 1) * boostFactor
    if (this.limiter) engineTorque *= 0.12
    if (this.shiftTimer > 0) engineTorque *= this.shiftTransfer
    let driveForce = (engineTorque * gearRatio * DRIVETRAIN_EFFICIENCY) / this.car.wheelRadius
    if (this.transmission.type === 'manual') driveForce *= 1 - this.clutch
    if (this.transmission.type !== 'manual' &&
      this.speed < 3 && this.brake < 0.15 && this.throttle < 0.05) {
      driveForce += this.car.mass * (this.transmission.creepAcceleration ?? 0) *
        (1 - this.speed / 3)
    }
    const availableGrip = this.maxTractionForce * (this.offRoad ? 0.48 : 1)
    this.tractionLimited = driveForce > availableGrip
    if (this.tractionControl) driveForce = Math.min(driveForce, availableGrip)
    else if (this.tractionLimited) driveForce = availableGrip * 0.82

    let resistance = this.dragFactor * this.speed * this.speed + this.rollingResistance
    if (this.offRoad) resistance += 620 + this.speed * 26

    let acceleration = (driveForce - resistance) / this.car.mass
    acceleration -= this.brake * 9.6
    if (handbrake) acceleration -= 4.2

    this.speed = Math.max(0, this.speed + acceleration * step)
    this.distance += this.speed * step
    this.elapsed += step
    this.maxSpeed = Math.max(this.maxSpeed, this.speed)

    // --- Lateral movement --------------------------------------------------
    const steerAuthority = clamp(this.speed / 14, 0, 1)
    const lateralTarget = this.steer * 7.2 * steerAuthority
    this.lateralVelocity = approach(this.lateralVelocity, lateralTarget, step, 7)
    this.lateral += this.lateralVelocity * step

    if (Math.abs(this.lateral) > SHOULDER_EDGE) {
      this.lateral = Math.sign(this.lateral) * SHOULDER_EDGE
      this.lateralVelocity *= -0.2
    }
    this.offRoad = Math.abs(this.lateral) > ROAD_EDGE

    return this.snapshot()
  }

  snapshot() {
    const rpmFraction = this.rpm / this.engine.maxRpm
    return {
      speed: this.speed,
      speedKmh: this.speed * 3.6,
      rpm: Math.round(this.rpm),
      rpmFraction,
      redlineFraction: this.engine.redline / this.engine.maxRpm,
      limiter: this.limiter,
      gear: this.gear,
      gearCount: this.gearCount,
      gearRatio: (this.transmission.type === 'cvt' && this.gearboxMode === 'D'
        ? this.cvtRatio : this.transmission.gearRatios[this.gear - 1]) * this.transmission.finalDrive,
      gearboxMode: this.gearboxMode,
      driveMode: this.driveMode,
      tractionControl: this.tractionControl,
      tractionLimited: this.tractionLimited,
      boost: this.boost,
      distance: this.distance,
      distanceKm: this.distance / 1000,
      elapsed: this.elapsed,
      maxSpeedKmh: this.maxSpeed * 3.6,
      throttle: this.throttle,
      brake: this.brake,
      clutch: this.clutch,
      steer: this.steer,
      lateral: this.lateral,
      offRoad: this.offRoad,
      shiftEvent: this.shiftEvent,
      shiftActive: this.shiftTimer > 0,
      transmissionType: this.transmission.type,
    }
  }
}
